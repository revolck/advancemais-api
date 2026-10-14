const mockUsuarioFindFirst = jest.fn();
const mockEnvioFindUnique = jest.fn();
const mockEnvioUpsert = jest.fn();
const mockValidacaoUpsert = jest.fn();
const mockCarregarValidacoes = jest.fn();
const mockVerificarLocalmente = jest.fn();
const mockSend = jest.fn();
const mockLogEmail = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: { findFirst: (...a: unknown[]) => mockUsuarioFindFirst(...a) },
    comunicadosEnvios: {
      findUnique: (...a: unknown[]) => mockEnvioFindUnique(...a),
      upsert: (...a: unknown[]) => mockEnvioUpsert(...a),
    },
    emailsValidacoes: { upsert: (...a: unknown[]) => mockValidacaoUpsert(...a) },
    logEmail: { create: (...a: unknown[]) => mockLogEmail(...a) },
  },
}));
jest.mock('@/modules/candidatos/curriculos/services', () => ({ MAX_CURRICULOS: 5 }));
jest.mock('../client/email-dispatcher', () => ({
  EmailDispatcher: { getInstance: () => ({ send: (...a: unknown[]) => mockSend(...a) }) },
}));
jest.mock('../config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getRuntimeConfig: async () => ({
        urls: { passwordRecovery: 'https://auth.advancemais.com/recuperar-senha' },
        passwordRecovery: { tokenExpirationMinutes: 60 },
      }),
    }),
  },
}));
jest.mock('../validacao', () => ({
  ...jest.requireActual('../validacao/email-validacao.service'),
  carregarValidacoes: (...a: unknown[]) => mockCarregarValidacoes(...a),
  verificarLocalmente: (...a: unknown[]) => mockVerificarLocalmente(...a),
}));
jest.mock('../comunicados/primeiro-acesso.service', () => ({
  COMUNICADO_PRIMEIRO_ACESSO: 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026',
  TAG_COMUNICADO: 'comunicado-primeiro-acesso',
  filtroPopulacao: () => ({ role: 'ALUNO_CANDIDATO' }),
  montarLinks: async () => ({
    platformUrl: 'https://auth.advancemais.com/login',
    coursesUrl: 'https://advancemais.com/cursos',
    jobsUrl: 'https://advancemais.com/vagas',
    resumeUrl: 'https://advancemais.com/dashboard/curriculo',
  }),
}));

import {
  deveEnviarBoasVindas,
  enviarBoasVindasComLink,
  mascararEmail,
  registrarAcessoPeloAluno,
  verificarEnvioRecuperacao,
} from '../comunicados/primeiro-acesso.recuperacao';
import { EmailTemplates } from '../templates/email-templates';

const registro = (resultado: string, fonte = 'LOCAL', motivo: string | null = null) =>
  new Map([
    [
      'aluno@gmail.com',
      {
        email: 'aluno@gmail.com',
        resultado,
        fonte,
        motivo,
        sugestao: null,
        tentativas: 1,
        validadoEm: new Date(),
        proximaTentativaEm: null,
      },
    ],
  ]);

beforeEach(() => {
  jest.clearAllMocks();
  mockCarregarValidacoes.mockResolvedValue(new Map());
  mockVerificarLocalmente.mockResolvedValue(null);
});

describe('recuperação de senha pelo CPF: para onde pode enviar', () => {
  it('não envia para o e-mail fictício da migração', async () => {
    expect(await verificarEnvioRecuperacao('aluno.migracao.123@sem-email.local')).toMatchObject({
      permitido: false,
      codigo: 'SEM_EMAIL_CADASTRADO',
    });
    expect(mockVerificarLocalmente).not.toHaveBeenCalled();
  });

  it.each([
    ['devolvido na Brevo', registro('INVALIDO', 'BREVO', 'BREVO_HARD_BOUNCE')],
    ['bloqueado (spam/descadastro)', registro('BLOQUEADO', 'BREVO', 'BREVO_DENUNCIA_SPAM')],
    ['domínio sem e-mail', registro('INVALIDO', 'LOCAL', 'DOMINIO_SEM_MX')],
    ['domínio com erro de digitação', registro('RISCO', 'LOCAL', 'DOMINIO_COM_ERRO_DE_DIGITACAO')],
  ])('bloqueia endereço %s', async (_caso, validacoes) => {
    mockCarregarValidacoes.mockResolvedValue(validacoes);
    expect(await verificarEnvioRecuperacao('Aluno@Gmail.com')).toMatchObject({
      permitido: false,
      codigo: 'EMAIL_NAO_RECEBE',
    });
  });

  it('bloqueia o que a checagem local reprova (inclusive descartável, caixa pública)', async () => {
    mockVerificarLocalmente.mockResolvedValueOnce({
      resultado: 'RISCO',
      motivo: 'DOMINIO_DESCARTAVEL',
    });
    expect((await verificarEnvioRecuperacao('a@mailinator.com')).permitido).toBe(false);
    mockVerificarLocalmente.mockResolvedValueOnce({
      resultado: 'RISCO',
      motivo: 'DOMINIO_COM_ERRO_DE_DIGITACAO',
    });
    expect((await verificarEnvioRecuperacao('a@hotmail.com.com')).permitido).toBe(false);
  });

  it('permite endereço sem problema conhecido (o aluno é quem pede o link)', async () => {
    expect(await verificarEnvioRecuperacao('aluno@gmail.com')).toEqual({ permitido: true });
  });

  it('falha temporária de DNS não bloqueia o aluno', async () => {
    mockVerificarLocalmente.mockResolvedValue({
      resultado: 'TEMPORARIO',
      motivo: 'DNS_INDISPONIVEL',
    });
    expect((await verificarEnvioRecuperacao('aluno@gmail.com')).permitido).toBe(true);
  });

  it('mascara o e-mail mostrado ao aluno', () => {
    expect(mascararEmail(' Alysson.Melo@Gmail.com ')).toBe('al***@gmail.com');
  });
});

describe('aluno ativou o acesso sozinho', () => {
  it('sai da fila do comunicado e o e-mail fica comprovado', async () => {
    mockUsuarioFindFirst.mockResolvedValue({ email: 'Aluno@Gmail.com' });
    mockEnvioFindUnique.mockResolvedValue(null);

    await registrarAcessoPeloAluno('u1');

    expect(mockEnvioUpsert.mock.calls[0][0].create).toMatchObject({
      usuarioId: 'u1',
      email: 'aluno@gmail.com',
      status: 'CONCLUIDO_PELO_ALUNO',
    });
    expect(mockValidacaoUpsert.mock.calls[0][0]).toMatchObject({
      where: { email: 'aluno@gmail.com' },
      create: { resultado: 'VALIDO', fonte: 'PLATAFORMA' },
    });
  });

  it('não mexe em quem não é aluno migrado', async () => {
    mockUsuarioFindFirst.mockResolvedValue(null);
    await registrarAcessoPeloAluno('u-empresa');
    expect(mockEnvioUpsert).not.toHaveBeenCalled();
    expect(mockValidacaoUpsert).not.toHaveBeenCalled();
  });

  it('não interfere em envio em andamento nem sobrescreve bloqueio real da Brevo', async () => {
    mockUsuarioFindFirst.mockResolvedValue({ email: 'aluno@gmail.com' });
    mockEnvioFindUnique.mockResolvedValue({ status: 'PROCESSANDO' });
    mockCarregarValidacoes.mockResolvedValue(registro('INVALIDO', 'BREVO', 'BREVO_HARD_BOUNCE'));

    await registrarAcessoPeloAluno('u1');

    expect(mockEnvioUpsert).not.toHaveBeenCalled();
    expect(mockValidacaoUpsert).not.toHaveBeenCalled();
  });

  it('erro aqui nunca derruba a redefinição de senha', async () => {
    mockUsuarioFindFirst.mockRejectedValue(new Error('db fora'));
    await expect(registrarAcessoPeloAluno('u1')).resolves.toBeUndefined();
  });
});

describe('boas-vindas no primeiro pedido de recuperação', () => {
  it('aluno importado que nunca concluiu o primeiro acesso recebe boas-vindas', async () => {
    mockUsuarioFindFirst.mockResolvedValueOnce({ ComunicadosEnvios: [] });
    expect(await deveEnviarBoasVindas('u1')).toBe(true);
    const where = mockUsuarioFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'u1', role: 'ALUNO_CANDIDATO', ultimoLogin: null });

    // recebeu o comunicado (senha provisória ou link) mas ainda não criou a senha
    mockUsuarioFindFirst.mockResolvedValueOnce({ ComunicadosEnvios: [{ status: 'ENVIADO' }] });
    expect(await deveEnviarBoasVindas('u1')).toBe(true);
  });

  it('depois de criar a senha, ou se não é aluno importado (ou já entrou), vale o e-mail padrão', async () => {
    mockUsuarioFindFirst.mockResolvedValueOnce({
      ComunicadosEnvios: [{ status: 'CONCLUIDO_PELO_ALUNO' }],
    });
    expect(await deveEnviarBoasVindas('u1')).toBe(false);
    // fora do filtro (cadastro próprio, ou ultimoLogin preenchido)
    mockUsuarioFindFirst.mockResolvedValueOnce(null);
    expect(await deveEnviarBoasVindas('u-novo')).toBe(false);
  });

  it('envia as boas-vindas com o link de criar senha e registra no comunicado', async () => {
    mockSend.mockResolvedValue({ success: true, provider: 'brevo', messageId: '<bv1@brevo>' });
    mockEnvioFindUnique.mockResolvedValue(null);

    const r = await enviarBoasVindasComLink(
      { id: 'u1', email: 'Aluno@Gmail.com', nomeCompleto: 'Aluno Teste', cpf: '12345678909' },
      'a'.repeat(64),
    );

    expect(r.success).toBe(true);
    const [email] = mockSend.mock.calls[0];
    expect(email).toMatchObject({
      to: 'aluno@gmail.com',
      subject: 'A nova Advance+ está no ar 💻',
      tags: ['comunicado-primeiro-acesso'],
    });
    const link = `https://auth.advancemais.com/recuperar-senha?tp=${'a'.repeat(64)}&ep=Aluno%40Gmail.com`;
    expect(email.html).toContain(`href="${link}"`);
    expect(email.html).toContain('Criar minha senha');
    expect(email.html).not.toContain('Senha provisória');
    expect(email.text).toContain(link);
    expect(mockEnvioUpsert.mock.calls[0][0].create).toMatchObject({
      usuarioId: 'u1',
      status: 'ENVIADO',
      messageId: '<bv1@brevo>',
    });
    expect(mockLogEmail.mock.calls[0][0].data).toMatchObject({
      tipoEmail: 'BOAS_VINDAS',
      status: 'ENVIADO',
    });
  });

  it('não registra como enviado quando o envio falha ou é simulado', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'falhou' });
    await enviarBoasVindasComLink(
      { id: 'u1', email: 'a@gmail.com', nomeCompleto: 'A', cpf: null },
      't',
    );
    mockSend.mockResolvedValueOnce({ success: true, simulated: true, messageId: 'sim' });
    await enviarBoasVindasComLink(
      { id: 'u1', email: 'a@gmail.com', nomeCompleto: 'A', cpf: null },
      't',
    );
    expect(mockEnvioUpsert).not.toHaveBeenCalled();
  });

  it('não mexe no registro de quem já concluiu', async () => {
    mockSend.mockResolvedValue({ success: true, provider: 'smtp', messageId: 'm' });
    mockEnvioFindUnique.mockResolvedValue({ status: 'CONCLUIDO_PELO_ALUNO' });
    await enviarBoasVindasComLink(
      { id: 'u1', email: 'a@gmail.com', nomeCompleto: 'A', cpf: null },
      't',
    );
    expect(mockEnvioUpsert).not.toHaveBeenCalled();
  });
});

describe('template de boas-vindas', () => {
  const base = {
    nomeCompleto: 'Maria Souza',
    platformUrl: 'https://auth.advancemais.com/login',
    coursesUrl: 'https://advancemais.com/cursos',
    jobsUrl: 'https://advancemais.com/vagas',
    resumeUrl: 'https://advancemais.com/dashboard/curriculo',
    maxCurriculos: 5,
  };

  it('variante com link: botão "Criar minha senha", validade e nenhuma senha no corpo', () => {
    const t = EmailTemplates.generatePlatformWelcomeEmail({
      ...base,
      primeiroAcesso: {
        cpf: '12345678909',
        linkCriarSenha: 'https://x/criar?tp=abc',
        validadeHoras: 0.5,
      },
    });
    expect(t.html).toContain('href="https://x/criar?tp=abc"');
    expect(t.html).toContain('Criar minha senha');
    expect(t.html).toContain('30 minutos');
    expect(t.html).not.toContain('Senha provisória');
  });

  it('variante com senha provisória continua igual', () => {
    const t = EmailTemplates.generatePlatformWelcomeEmail({
      ...base,
      primeiroAcesso: { cpf: '12345678909', senhaProvisoria: 'Abc@2345xyZ9' },
    });
    expect(t.html).toContain('Abc@2345xyZ9');
    expect(t.html).toContain('Fazer meu primeiro acesso');
    expect(t.html).not.toContain('Criar minha senha');
  });
});

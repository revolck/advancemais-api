const mockUsuarioFindFirst = jest.fn();
const mockEnvioFindUnique = jest.fn();
const mockEnvioUpsert = jest.fn();
const mockValidacaoUpsert = jest.fn();
const mockCarregarValidacoes = jest.fn();
const mockVerificarLocalmente = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: { findFirst: (...a: unknown[]) => mockUsuarioFindFirst(...a) },
    comunicadosEnvios: {
      findUnique: (...a: unknown[]) => mockEnvioFindUnique(...a),
      upsert: (...a: unknown[]) => mockEnvioUpsert(...a),
    },
    emailsValidacoes: { upsert: (...a: unknown[]) => mockValidacaoUpsert(...a) },
  },
}));
jest.mock('../validacao', () => ({
  ...jest.requireActual('../validacao/email-validacao.service'),
  carregarValidacoes: (...a: unknown[]) => mockCarregarValidacoes(...a),
  verificarLocalmente: (...a: unknown[]) => mockVerificarLocalmente(...a),
}));
jest.mock('../comunicados/primeiro-acesso.service', () => ({
  COMUNICADO_PRIMEIRO_ACESSO: 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026',
  filtroPopulacao: () => ({ role: 'ALUNO_CANDIDATO' }),
}));

import {
  mascararEmail,
  registrarAcessoPeloAluno,
  verificarEnvioRecuperacao,
} from '../comunicados/primeiro-acesso.recuperacao';

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

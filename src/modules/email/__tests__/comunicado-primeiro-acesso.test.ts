import { Prisma } from '@prisma/client';

const mockUsuariosFindMany = jest.fn();
const mockUsuariosFindUnique = jest.fn();
const mockUsuariosUpdate = jest.fn();
const mockEnvioFindUnique = jest.fn();
const mockEnvioCreate = jest.fn();
const mockEnvioUpdate = jest.fn();
const mockEnvioUpdateMany = jest.fn();
const mockEnvioDeleteMany = jest.fn();
const mockEnvioFindMany = jest.fn();
const mockEnvioCount = jest.fn();
const mockSend = jest.fn();
const mockAudit = jest.fn();
const mockInvalidate = jest.fn();
const mockCarregarValidacoes = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findMany: (...a: unknown[]) => mockUsuariosFindMany(...a),
      findUnique: (...a: unknown[]) => mockUsuariosFindUnique(...a),
      update: (...a: unknown[]) => mockUsuariosUpdate(...a),
    },
    comunicadosEnvios: {
      findUnique: (...a: unknown[]) => mockEnvioFindUnique(...a),
      create: (...a: unknown[]) => mockEnvioCreate(...a),
      update: (...a: unknown[]) => mockEnvioUpdate(...a),
      updateMany: (...a: unknown[]) => mockEnvioUpdateMany(...a),
      deleteMany: (...a: unknown[]) => mockEnvioDeleteMany(...a),
      findMany: (...a: unknown[]) => mockEnvioFindMany(...a),
      count: (...a: unknown[]) => mockEnvioCount(...a),
    },
  },
}));
jest.mock('bcrypt', () => ({
  __esModule: true,
  default: { hash: async (s: string) => `hash(${s})` },
}));
jest.mock('@/modules/usuarios/utils/user-history', () => ({
  recordUserAuditEvent: (...a: unknown[]) => mockAudit(...a),
}));
jest.mock('@/modules/usuarios/utils/cache', () => ({
  invalidateUserCache: (...a: unknown[]) => mockInvalidate(...a),
}));
jest.mock('@/modules/candidatos/curriculos/services', () => ({ MAX_CURRICULOS: 5 }));
jest.mock('../config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getRuntimeConfig: async () => ({
        urls: {
          frontend: 'https://advancemais.com',
          verification: 'https://auth.advancemais.com/verify-email',
        },
      }),
    }),
  },
}));
jest.mock('../client/email-dispatcher', () => ({
  EmailDispatcher: { getInstance: () => ({ send: (...a: unknown[]) => mockSend(...a) }) },
}));
jest.mock('../validacao', () => ({
  ...jest.requireActual('../validacao/email-validacao.service'),
  carregarValidacoes: (...a: unknown[]) => mockCarregarValidacoes(...a),
}));

import {
  avaliarTaxaDevolucao,
  contagemJanela,
  filtroElegiveis,
  inicioDoDiaBrasilia,
  limiteDiarioRampa,
  processarLote,
  reabrirEmailsCorrigidos,
  revogarSenhaProvisoria,
  situacaoRampa,
} from '../comunicados/primeiro-acesso.service';

const agora = new Date('2026-10-14T15:00:00Z');

const aluno = (n: number) => ({
  id: `u${n}`,
  email: `Aluno${n}@Gmail.com`,
  cpf: '12345678909',
  nomeCompleto: `Aluno ${n} Silva`,
  senha: `hash-antigo-${n}`,
  precisaTrocarSenha: false,
  senhaProvisoriaEm: null,
});

/** Validação por e-mail normalizado */
const validacoes = (porEmail: Record<string, string>) =>
  new Map(
    Object.entries(porEmail).map(([email, resultado]) => [
      email,
      {
        email,
        resultado,
        fonte: 'ZEROBOUNCE',
        motivo: null,
        sugestao: null,
        tentativas: 1,
        validadoEm: agora,
        proximaTentativaEm: null,
      },
    ]),
  );

/** usuarios.findMany: 1ª chamada = candidatos (id, email); 2ª = dados completos */
function prepararAlunos(lista: ReturnType<typeof aluno>[]) {
  mockUsuariosFindMany
    .mockResolvedValueOnce(lista.map(({ id, email }) => ({ id, email })))
    .mockImplementationOnce(async ({ where }: { where: { id: { in: string[] } } }) =>
      lista.filter((a) => where.id.in.includes(a.id)),
    );
}

const atualizacoesDeSenha = () =>
  mockUsuariosUpdate.mock.calls.map(([args]) => args as { where: { id: string }; data: any });

beforeEach(() => {
  jest.clearAllMocks();
  mockEnvioFindUnique.mockResolvedValue(null);
  mockEnvioCreate.mockResolvedValue({});
  mockEnvioUpdateMany.mockResolvedValue({ count: 1 });
  mockCarregarValidacoes.mockResolvedValue(new Map());
});

describe('público e elegibilidade', () => {
  it('só alunos migrados, ativos, com e-mail real e não concluídos', () => {
    const where = filtroElegiveis(agora) as any;
    expect(where).toMatchObject({
      role: 'ALUNO_CANDIDATO',
      status: 'ATIVO',
      authId: { startsWith: 'migracao-aluno-' },
      NOT: { email: { endsWith: '@sem-email.local' } },
    });
    const regras = where.ComunicadosEnvios.none.OR;
    // nunca reenviar para quem já recebeu, voltou, está em dúvida ou foi revogado
    expect(regras[0].status.in).toEqual(
      expect.arrayContaining(['ENVIADO', 'DEVOLVIDO', 'INCERTO', 'PROCESSANDO', 'REVOGADO']),
    );
    expect(regras[0].status.in).not.toContain('REABERTO');
    expect(regras[1]).toEqual({ tentativas: { gte: 3 } });
    // falha: espera 1h; devolução temporária: espera 48h e no máximo 2 envios
    expect(regras[2].atualizadoEm.gt).toEqual(new Date('2026-10-14T14:00:00Z'));
    expect(regras[3].OR[0].atualizadoEm.gt).toEqual(new Date('2026-10-12T15:00:00Z'));
    expect(regras[3].OR[1]).toEqual({ tentativas: { gte: 2 } });
  });
});

describe('processarLote', () => {
  it('envia só para endereço VALIDADO, com senha individual, etiqueta e canal de campanhas', async () => {
    prepararAlunos([aluno(1), aluno(2), aluno(3)]);
    mockCarregarValidacoes.mockResolvedValue(
      validacoes({ 'aluno1@gmail.com': 'VALIDO', 'aluno2@gmail.com': 'PENDENTE' }),
    );
    mockSend.mockResolvedValue({ success: true, provider: 'brevo', messageId: '<m1@brevo>' });

    const r = await processarLote(10, { agora });

    expect(r).toMatchObject({
      processados: 1,
      enviados: 1,
      naoValidados: 2,
      interrompidoPor: null,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const [email, options] = mockSend.mock.calls[0];
    expect(options).toEqual({ channel: 'marketing' });
    expect(email).toMatchObject({ to: 'aluno1@gmail.com', tags: ['comunicado-primeiro-acesso'] });
    const senha = /letter-spacing: 2px[^>]*>([^<]+)</.exec(email.html)?.[1] ?? '';
    expect(senha).toHaveLength(12);
    expect(atualizacoesDeSenha()[0].data).toMatchObject({
      senha: `hash(${senha})`,
      precisaTrocarSenha: true,
    });
    // reserva antes de enviar e conclusão depois
    expect(mockEnvioCreate.mock.calls[0][0].data).toMatchObject({ status: 'PROCESSANDO' });
    expect(mockEnvioUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'ENVIADO',
      messageId: '<m1@brevo>',
      tentativas: { increment: 1 },
      entregueEm: null,
    });
    // a senha nunca vai para a auditoria
    expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(senha);
  });

  it('respeita o limite pedido', async () => {
    prepararAlunos([aluno(1), aluno(2), aluno(3)]);
    mockCarregarValidacoes.mockResolvedValue(
      validacoes({
        'aluno1@gmail.com': 'VALIDO',
        'aluno2@gmail.com': 'VALIDO',
        'aluno3@gmail.com': 'VALIDO',
      }),
    );
    mockSend.mockResolvedValue({ success: true, provider: 'brevo', messageId: 'm' });
    const r = await processarLote(2, { agora });
    expect(r.enviados).toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('não envia quando outro processo já reservou o aluno (sem duplicidade)', async () => {
    prepararAlunos([aluno(1), aluno(2)]);
    mockCarregarValidacoes.mockResolvedValue(
      validacoes({ 'aluno1@gmail.com': 'VALIDO', 'aluno2@gmail.com': 'VALIDO' }),
    );
    // aluno 1: criado por outra instância no meio do caminho (unique violado)
    mockEnvioCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    // aluno 2: tinha FALHA, mas outra instância trocou o status antes (compare-and-set falha)
    mockEnvioFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ status: 'FALHA' });
    mockEnvioUpdateMany.mockResolvedValueOnce({ count: 0 });

    const r = await processarLote(10, { agora });

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUsuariosUpdate).not.toHaveBeenCalled();
    expect(r.processados).toBe(0);
  });

  it('não reprocessa quem já foi atendido, mesmo se aparecer na lista', async () => {
    prepararAlunos([aluno(1)]);
    mockCarregarValidacoes.mockResolvedValue(validacoes({ 'aluno1@gmail.com': 'VALIDO' }));
    mockEnvioFindUnique.mockResolvedValueOnce({ status: 'ENVIADO' });
    await processarLote(10, { agora });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('recusa do destinatário: restaura a senha anterior e registra FALHA (retentativa depois)', async () => {
    prepararAlunos([aluno(1)]);
    mockCarregarValidacoes.mockResolvedValue(validacoes({ 'aluno1@gmail.com': 'VALIDO' }));
    mockSend.mockResolvedValue({ success: false, failureReason: 'INVALID_REQUEST', error: 'x' });

    const r = await processarLote(10, { agora });

    expect(r).toMatchObject({ processados: 1, falhas: 1 });
    expect(atualizacoesDeSenha()[1].data).toMatchObject({
      senha: 'hash-antigo-1',
      precisaTrocarSenha: false,
    });
    expect(mockEnvioUpdate.mock.calls[0][0].data).toMatchObject({ status: 'FALHA' });
  });

  it('falha do provedor interrompe o lote e desfaz a reserva', async () => {
    prepararAlunos([aluno(1), aluno(2)]);
    mockCarregarValidacoes.mockResolvedValue(
      validacoes({ 'aluno1@gmail.com': 'VALIDO', 'aluno2@gmail.com': 'VALIDO' }),
    );
    mockSend.mockResolvedValue({ success: false, failureReason: 'QUOTA_EXCEEDED' });

    const r = await processarLote(10, { agora });

    expect(r).toMatchObject({ processados: 0, interrompidoPor: 'QUOTA_EXCEEDED' });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockEnvioDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ usuarioId: 'u1', status: 'PROCESSANDO' }),
    });
    expect(atualizacoesDeSenha()[1].data.senha).toBe('hash-antigo-1');
  });

  it('entrega incerta: mantém a senha nova e não reenvia', async () => {
    prepararAlunos([aluno(1)]);
    mockCarregarValidacoes.mockResolvedValue(validacoes({ 'aluno1@gmail.com': 'VALIDO' }));
    mockSend.mockResolvedValue({
      success: false,
      failureReason: 'TIMEOUT',
      deliveryUncertain: true,
    });

    const r = await processarLote(10, { agora });

    expect(r.incertos).toBe(1);
    expect(atualizacoesDeSenha()).toHaveLength(1);
    expect(mockEnvioUpdate.mock.calls[0][0].data.status).toBe('INCERTO');
  });

  it('envio simulado não conta como enviado', async () => {
    prepararAlunos([aluno(1)]);
    mockCarregarValidacoes.mockResolvedValue(validacoes({ 'aluno1@gmail.com': 'VALIDO' }));
    mockSend.mockResolvedValue({ success: true, simulated: true, messageId: 'sim_1' });

    const r = await processarLote(10, { agora });

    expect(r).toMatchObject({ enviados: 0, interrompidoPor: 'SIMULATED' });
    expect(atualizacoesDeSenha().some((u) => u.data.senha === 'hash-antigo-1')).toBe(true);
  });
});

describe('aquecimento e taxa de devolução', () => {
  it('limite dobra a cada dia com envio, até o máximo', () => {
    expect([0, 1, 2, 3, 4].map((d) => limiteDiarioRampa(100, 1000, d))).toEqual([
      100, 200, 400, 800, 1000,
    ]);
  });

  it('conta dias de Brasília e envios de hoje', async () => {
    expect(inicioDoDiaBrasilia(agora).toISOString()).toBe('2026-10-14T03:00:00.000Z');
    mockEnvioFindMany.mockResolvedValue([
      { enviadoEm: new Date('2026-10-13T18:40:00Z') }, // piloto
      { enviadoEm: new Date('2026-10-14T02:59:00Z') }, // 23:59 de 13/10 em Brasília
      { enviadoEm: new Date('2026-10-14T10:00:00Z') },
    ]);
    expect(await situacaoRampa({ rampaInicial: 100, maxDiario: 1000 }, agora)).toEqual({
      diasComEnvio: 1,
      enviadosHoje: 1,
      limiteHoje: 200,
      disponivelHoje: 199,
    });
  });

  it('pausa acima do limite depois de 50 envios (piloto real: 17 de 99)', () => {
    expect(avaliarTaxaDevolucao({ enviados: 99, devolvidos: 17 }, 5)).toMatchObject({
      taxaPercentual: 17.2,
      pausado: true,
    });
    expect(avaliarTaxaDevolucao({ enviados: 100, devolvidos: 5 }, 5).pausado).toBe(false);
    expect(avaliarTaxaDevolucao({ enviados: 10, devolvidos: 5 }, 5).pausado).toBe(false);
  });

  it('a janela usa devolvidoEm, que corrigir o e-mail não apaga', async () => {
    mockEnvioCount.mockResolvedValueOnce(120).mockResolvedValueOnce(3);
    const desde = new Date('2026-10-13T15:00:00Z');
    expect(await contagemJanela(desde)).toEqual({ enviados: 120, devolvidos: 3 });
    expect(mockEnvioCount.mock.calls[0][0].where.OR).toEqual([
      { enviadoEm: { gte: desde } },
      { devolvidoEm: { gte: desde } },
    ]);
    expect(mockEnvioCount.mock.calls[1][0].where).toMatchObject({ devolvidoEm: { gte: desde } });
  });
});

describe('correção de e-mail e revogação', () => {
  it('reabre quem teve o e-mail corrigido, menos quem já trocou a senha', async () => {
    const usuario = (email: string, precisaTrocarSenha = true) => ({ email, precisaTrocarSenha });
    mockEnvioFindMany.mockResolvedValue([
      { id: 'e1', email: 'x@gmal.com', status: 'DEVOLVIDO', Usuario: usuario('x@gmail.com') },
      { id: 'e2', email: 'y@gmail.com', status: 'DEVOLVIDO', Usuario: usuario('Y@gmail.com') },
      {
        id: 'e3',
        email: 'z@hotmail.com.com',
        status: 'ENVIADO',
        Usuario: usuario('z@hotmail.com'),
      },
      { id: 'e4', email: 'w@old.com', status: 'ENVIADO', Usuario: usuario('w@new.com', false) },
    ]);

    expect(await reabrirEmailsCorrigidos()).toBe(2);
    expect(mockEnvioUpdate.mock.calls.map(([a]) => a.where.id)).toEqual(['e1', 'e3']);
    expect(mockEnvioUpdate.mock.calls[0][0].data).toMatchObject({
      status: 'REABERTO',
      tentativas: 0,
    });
  });

  it('revoga a senha provisória não usada sem registrar a senha em lugar nenhum', async () => {
    mockUsuariosFindUnique.mockResolvedValue({ id: 'u1', precisaTrocarSenha: true });
    await revogarSenhaProvisoria('u1', { motivo: 'domínio com erro de digitação', actorId: 'adm' });

    const dados = atualizacoesDeSenha()[0].data;
    expect(dados).toMatchObject({ senhaProvisoriaEm: null, refreshToken: null });
    expect(dados.senha).toMatch(/^hash\([0-9a-f]{64}\)$/);
    expect(mockEnvioUpdateMany.mock.calls[0][0].data.status).toBe('REVOGADO');
    expect(mockAudit.mock.calls[0][0]).toMatchObject({
      action: 'USUARIO_SENHA_RESETADA',
      actorId: 'adm',
    });
    expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(dados.senha.slice(5, 69));
  });

  it('não revoga quem já trocou a senha', async () => {
    mockUsuariosFindUnique.mockResolvedValue({ id: 'u1', precisaTrocarSenha: false });
    await expect(revogarSenhaProvisoria('u1', { motivo: 'x' })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mockUsuariosUpdate).not.toHaveBeenCalled();
  });
});

const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockSend = jest.fn();
const mockResolveMx = jest.fn();
const mockAudit = jest.fn();
const mockInvalidate = jest.fn();
const mockEnviosFindMany = jest.fn();
const mockEnviosUpdate = jest.fn();
const mockListarEventos = jest.fn();
const mockGroupBy = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findMany: (...a: unknown[]) => mockFindMany(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
    comunicadosEnvios: {
      upsert: (...a: unknown[]) => mockUpsert(...a),
      findMany: (...a: unknown[]) => mockEnviosFindMany(...a),
      update: (...a: unknown[]) => mockEnviosUpdate(...a),
      groupBy: (...a: unknown[]) => mockGroupBy(...a),
    },
  },
}));
jest.mock('dns', () => ({ promises: { resolveMx: (...a: unknown[]) => mockResolveMx(...a) } }));
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
jest.mock('@/modules/configuracoes-gerais', () => ({
  runtimeConfigService: {
    getComunicadoPrimeiroAcessoConfig: async () => ({ ativo: true, lote: 80 }),
  },
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
jest.mock('../client/brevo-client', () => ({
  BrevoClient: {
    getInstance: () => ({ listarEventos: (...a: unknown[]) => mockListarEventos(...a) }),
  },
}));
jest.mock('../client/email-dispatcher', () => ({
  EmailDispatcher: { getInstance: () => ({ send: (...a: unknown[]) => mockSend(...a) }) },
}));

import {
  avaliarTaxaDevolucao,
  contagemPorStatus,
  filtroElegiveis,
  inicioJanelaDevolucao,
  limparCacheMx,
  processarLote,
  sincronizarDevolucoes,
} from '../comunicados/primeiro-acesso.service';

const aluno = (n: number) => ({
  id: `u${n}`,
  email: `Aluno${n}@Gmail.com`,
  cpf: '12345678909',
  nomeCompleto: `Aluno ${n} Silva`,
  senha: `hash-antigo-${n}`,
  precisaTrocarSenha: false,
  senhaProvisoriaEm: null,
});

const passwordUpdates = () =>
  mockUpdate.mock.calls.map(([args]) => args as { where: { id: string }; data: any });

beforeEach(() => {
  jest.clearAllMocks();
  limparCacheMx();
  mockResolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
});

describe('comunicado de primeiro acesso', () => {
  it('seleciona só alunos migrados, ativos, com e-mail real e ainda não concluídos', () => {
    const where = filtroElegiveis() as any;
    expect(where).toMatchObject({
      role: 'ALUNO_CANDIDATO',
      status: 'ATIVO',
      authId: { startsWith: 'migracao-aluno-' },
      NOT: { email: { endsWith: '@sem-email.local' } },
    });
    expect(where.ComunicadosEnvios.none.OR[0].status.in).toEqual([
      'ENVIADO',
      'DESCARTADO',
      'INCERTO',
      'DEVOLVIDO',
    ]);
  });

  it('envia com senha provisória individual pelo canal de campanhas e registra ENVIADO', async () => {
    mockFindMany.mockResolvedValue([aluno(1)]);
    mockSend.mockResolvedValue({ success: true, provider: 'brevo', messageId: 'm1' });

    const r = await processarLote(10);

    expect(r).toMatchObject({ processados: 1, enviados: 1, interrompidoPor: null });
    const [email, options] = mockSend.mock.calls[0];
    expect(options).toEqual({ channel: 'marketing' });
    expect(email.to).toBe('aluno1@gmail.com');
    expect(email.subject).toBe('A nova Advance+ está no ar 💻');
    const senha = /letter-spacing: 2px[^>]*>([^<]+)</.exec(email.html)?.[1];
    expect(senha).toHaveLength(12);
    expect(passwordUpdates()[0].data).toMatchObject({
      senha: `hash(${senha})`,
      precisaTrocarSenha: true,
    });
    expect(mockUpsert.mock.calls[0][0].create).toMatchObject({ status: 'ENVIADO', tentativas: 1 });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USUARIO_SENHA_PROVISORIA_DEFINIDA' }),
    );
  });

  it('restaura a senha anterior e registra FALHA quando o destinatário é recusado', async () => {
    mockFindMany.mockResolvedValue([aluno(1), aluno(2)]);
    mockSend
      .mockResolvedValueOnce({
        success: false,
        failureReason: 'INVALID_REQUEST',
        error: 'email inválido',
      })
      .mockResolvedValueOnce({ success: true, provider: 'brevo', messageId: 'm2' });

    const r = await processarLote(10);

    expect(r).toMatchObject({ processados: 2, enviados: 1, falhas: 1 });
    const restaurado = passwordUpdates().find((u) => u.data.senha === 'hash-antigo-1');
    expect(restaurado?.data).toMatchObject({ precisaTrocarSenha: false, senhaProvisoriaEm: null });
    expect(mockUpsert.mock.calls[0][0].create).toMatchObject({ status: 'FALHA', tentativas: 1 });
  });

  it('interrompe o lote sem registrar falha quando o limite do provedor acaba', async () => {
    mockFindMany.mockResolvedValue([aluno(1), aluno(2), aluno(3)]);
    mockSend
      .mockResolvedValueOnce({ success: true, provider: 'brevo', messageId: 'm1' })
      .mockResolvedValueOnce({ success: false, failureReason: 'DAILY_LIMIT_REACHED' });

    const r = await processarLote(10);

    expect(r).toMatchObject({
      processados: 1,
      enviados: 1,
      interrompidoPor: 'DAILY_LIMIT_REACHED',
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(
      passwordUpdates().some((u) => u.where.id === 'u2' && u.data.senha === 'hash-antigo-2'),
    ).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(1); // só o enviado
  });

  it('mantém a senha nova e não reenvia quando a entrega é incerta', async () => {
    mockFindMany.mockResolvedValue([aluno(1)]);
    mockSend.mockResolvedValue({
      success: false,
      failureReason: 'TIMEOUT',
      deliveryUncertain: true,
      provider: 'brevo',
    });

    const r = await processarLote(10);

    expect(r.incertos).toBe(1);
    expect(passwordUpdates()).toHaveLength(1); // não restaura
    expect(mockUpsert.mock.calls[0][0].create.status).toBe('INCERTO');
  });

  it('descarta domínios sem servidor de e-mail sem mexer na senha', async () => {
    mockFindMany.mockResolvedValue([aluno(1)]);
    mockResolveMx.mockRejectedValue(Object.assign(new Error('nx'), { code: 'ENOTFOUND' }));

    const r = await processarLote(10);

    expect(r.descartados).toBe(1);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0].create).toMatchObject({
      status: 'DESCARTADO',
      tentativas: 0,
    });
  });

  it('não descarta quando o DNS falha temporariamente', async () => {
    mockFindMany.mockResolvedValue([aluno(1)]);
    mockResolveMx.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }));
    mockSend.mockResolvedValue({ success: true, provider: 'brevo', messageId: 'm1' });

    const r = await processarLote(10);

    expect(r.enviados).toBe(1);
  });

  it('não marca como enviado quando o envio foi apenas simulado', async () => {
    mockFindMany.mockResolvedValue([aluno(1)]);
    mockSend.mockResolvedValue({ success: true, simulated: true, messageId: 'sim_1' });

    const r = await processarLote(10);

    expect(r).toMatchObject({ enviados: 0, interrompidoPor: 'SIMULATED' });
    expect(passwordUpdates().some((u) => u.data.senha === 'hash-antigo-1')).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('marca como DEVOLVIDO os envios com hard bounce/bloqueio na Brevo', async () => {
    mockListarEventos.mockImplementation(async ({ event }: { event: string }) =>
      event === 'hardBounces'
        ? [
            {
              messageId: '<ABC@smtp-relay.mailin.fr>',
              event: 'hardBounces',
              reason: 'user unknown',
            },
          ]
        : event === 'blocked'
          ? [{ messageId: '<def@smtp-relay.mailin.fr>', event: 'blocked' }]
          : [],
    );
    mockEnviosFindMany.mockResolvedValue([
      { id: 'e1', messageId: '<abc@smtp-relay.mailin.fr>' },
      { id: 'e2', messageId: '<def@smtp-relay.mailin.fr>' },
      { id: 'e3', messageId: '<ok@smtp-relay.mailin.fr>' },
    ]);

    const r = await sincronizarDevolucoes();

    expect(r.marcados).toBe(2);
    expect(mockEnviosUpdate).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { status: 'DEVOLVIDO', erro: 'hardBounces: user unknown' },
    });
    expect(mockEnviosUpdate.mock.calls.map(([a]) => a.where.id)).toEqual(['e1', 'e2']);
  });

  it('pausa quando a taxa de devolução passa do limite após 50 envios', () => {
    // piloto real: 17 de 99 devolvidos
    expect(avaliarTaxaDevolucao({ ENVIADO: 82, DEVOLVIDO: 17 }, 5)).toMatchObject({
      taxaPercentual: 17.2,
      pausado: true,
    });
    expect(avaliarTaxaDevolucao({ ENVIADO: 97, DEVOLVIDO: 3 }, 5).pausado).toBe(false);
    // com poucos envios ainda não avalia
    expect(avaliarTaxaDevolucao({ ENVIADO: 10, DEVOLVIDO: 5 }, 5).pausado).toBe(false);
  });

  it('avalia a pausa só com os envios das últimas 24h', async () => {
    const agora = new Date('2026-10-14T12:00:00Z');
    const desde = inicioJanelaDevolucao(agora);
    expect(desde.toISOString()).toBe('2026-10-13T12:00:00.000Z');
    mockGroupBy.mockResolvedValue([
      { status: 'ENVIADO', _count: { _all: 60 } },
      { status: 'DEVOLVIDO', _count: { _all: 1 } },
    ]);

    const contagem = await contagemPorStatus(desde);

    expect(mockGroupBy.mock.calls[0][0].where).toEqual({
      comunicado: 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026',
      enviadoEm: { gte: desde },
    });
    expect(contagem).toEqual({ ENVIADO: 60, DEVOLVIDO: 1 });
  });
});

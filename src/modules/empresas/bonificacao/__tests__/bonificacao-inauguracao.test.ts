const mockUsuariosFindMany = jest.fn();
const mockUsuariosCount = jest.fn();
const mockPlanoFindFirst = jest.fn();
const mockPlanosFindMany = jest.fn();
const mockPlanoCount = jest.fn();
const mockPlanoCreateMany = jest.fn();
const mockPlanoUpdateMany = jest.fn();
const mockPlanoUpdate = jest.fn();
const mockPlanoFindFirstEmpresa = jest.fn();
const mockVagasUpdateMany = jest.fn();
const mockNotificar = jest.fn();
const mockSendGeneric = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    usuarios: {
      findMany: (...a: unknown[]) => mockUsuariosFindMany(...a),
      count: (...a: unknown[]) => mockUsuariosCount(...a),
    },
    planosEmpresariais: { findFirst: (...a: unknown[]) => mockPlanoFindFirst(...a) },
    empresasPlano: {
      findMany: (...a: unknown[]) => mockPlanosFindMany(...a),
      findFirst: (...a: unknown[]) => mockPlanoFindFirstEmpresa(...a),
      count: (...a: unknown[]) => mockPlanoCount(...a),
      createMany: (...a: unknown[]) => mockPlanoCreateMany(...a),
      updateMany: (...a: unknown[]) => mockPlanoUpdateMany(...a),
      update: (...a: unknown[]) => mockPlanoUpdate(...a),
    },
    empresasVagas: { updateMany: (...a: unknown[]) => mockVagasUpdateMany(...a) },
  },
}));
jest.mock('@/modules/notificacoes/services/notificacoes.service', () => ({
  notificacoesService: { criar: (...a: unknown[]) => mockNotificar(...a) },
}));
jest.mock('@/modules/email/services/email-service', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendGeneric: (...a: unknown[]) => mockSendGeneric(...a),
  })),
}));
jest.mock('@/modules/email/config/email-config', () => ({
  EmailConfigManager: {
    getInstance: () => ({
      getRuntimeConfig: async () => ({ urls: { frontend: 'https://advancemais.com' } }),
    }),
  },
}));

import {
  CAMPANHA_INAUGURACAO,
  FIM_INAUGURACAO,
  aplicarBonificacao,
  filtroConcessoesAdminDoMes,
  filtroEmpresasElegiveis,
  marcarBonificacaoExibida,
  processarPlanosGratuitos,
  situacaoDaEmpresa,
} from '../bonificacao-inauguracao.service';

const planoInicial = { id: 'plano-inicial', nome: 'Inicial', quantidadeVagas: 3 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockPlanoFindFirst.mockResolvedValue(planoInicial);
  mockPlanoUpdateMany.mockResolvedValue({ count: 0 });
  mockPlanoCreateMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({
    count: data.length,
  }));
  mockPlanosFindMany.mockResolvedValue([]);
  mockSendGeneric.mockResolvedValue({ success: true });
  mockVagasUpdateMany.mockResolvedValue({ count: 0 });
});

describe('quem recebe a bonificação', () => {
  it('empresas ativas, sem plano ativo e sem a bonificação, menos a Advance', () => {
    const where = filtroEmpresasElegiveis() as any;
    expect(where).toMatchObject({ role: 'EMPRESA', status: 'ATIVO' });
    expect(where.OR).toEqual([{ cnpj: null }, { cnpj: { notIn: ['25089257000192'] } }]);
    expect(where.EmpresasPlano.none.OR).toEqual([
      { status: 'ATIVO' },
      { campanha: CAMPANHA_INAUGURACAO },
    ]);
  });

  it('só converte o mês grátis lançado pelo admin como assinatura (sem Mercado Pago)', () => {
    const where = filtroConcessoesAdminDoMes() as any;
    expect(where).toMatchObject({
      origin: 'ADMIN',
      modo: 'CLIENTE',
      status: 'ATIVO',
      campanha: null,
      mpPreapprovalId: null,
      mpSubscriptionId: null,
      mpPaymentId: null,
    });
  });
});

describe('aplicar', () => {
  it('converte as concessões do admin e cria o plano Inicial em lotes, até 14/11', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-14T18:00:00Z'));
    mockPlanoUpdateMany.mockResolvedValue({ count: 7 });
    mockUsuariosFindMany
      .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => ({ id: `e${i}` })))
      .mockResolvedValueOnce([{ id: 'e500' }, { id: 'e501' }])
      .mockResolvedValueOnce([]);

    const r = await aplicarBonificacao({ actorId: 'admin' });

    expect(r).toMatchObject({ criadas: 502, convertidas: 7, plano: 'Inicial' });
    expect(mockPlanoUpdateMany.mock.calls[0][0].data).toMatchObject({
      modo: 'TESTE',
      campanha: CAMPANHA_INAUGURACAO,
      fim: FIM_INAUGURACAO,
      proximaCobranca: null,
      graceUntil: null,
    });
    const criado = mockPlanoCreateMany.mock.calls[0][0].data[0];
    expect(criado).toMatchObject({
      planosEmpresariaisId: 'plano-inicial',
      modo: 'TESTE',
      status: 'ATIVO',
      origin: 'ADMIN',
      campanha: CAMPANHA_INAUGURACAO,
      fim: FIM_INAUGURACAO,
    });
    // válido até 14/11 inclusive (Brasília)
    expect(FIM_INAUGURACAO.toISOString()).toBe('2026-11-15T03:00:00.000Z');
  });

  it('não aplica depois do fim da campanha', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-16T12:00:00Z'));
    await expect(aplicarBonificacao()).rejects.toMatchObject({ code: 'CAMPANHA_ENCERRADA' });
    expect(mockPlanoCreateMany).not.toHaveBeenCalled();
  });

  it('falha se o plano Inicial não existir', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-14T18:00:00Z'));
    mockPlanoFindFirst.mockResolvedValue(null);
    await expect(aplicarBonificacao()).rejects.toMatchObject({ code: 'PLANO_NAO_ENCONTRADO' });
  });
});

describe('situação da empresa', () => {
  const agora = new Date('2026-10-20T12:00:00Z');
  const plano = (extra: Record<string, unknown>) => ({
    id: 'p1',
    modo: 'TESTE',
    status: 'ATIVO',
    fim: FIM_INAUGURACAO,
    campanha: CAMPANHA_INAUGURACAO,
    bonificacaoExibidaEm: null,
    PlanosEmpresariais: { nome: 'Inicial', quantidadeVagas: 3 },
    ...extra,
  });

  it('bonificação ativa e ainda não exibida', async () => {
    mockPlanosFindMany.mockResolvedValue([plano({})]);
    const r = await situacaoDaEmpresa('emp', agora);
    expect(r.bonificacao).toMatchObject({ planoNome: 'Inicial', quantidadeVagas: 3, exibir: true });
    expect(new Date(r.bonificacao!.validoAte).toISOString()).toBe('2026-11-15T02:59:59.999Z');
    expect(r.gratuitoExpirado).toBeNull();
  });

  it('depois de exibida não mostra de novo', async () => {
    mockPlanosFindMany.mockResolvedValue([plano({ bonificacaoExibidaEm: new Date() })]);
    expect((await situacaoDaEmpresa('emp', agora)).bonificacao?.exibir).toBe(false);
  });

  it('plano gratuito vencido e sem outro plano: avisa para renovar', async () => {
    mockPlanosFindMany.mockResolvedValue([plano({ status: 'EXPIRADO' })]);
    const r = await situacaoDaEmpresa('emp', new Date('2026-11-20T12:00:00Z'));
    expect(r.bonificacao).toBeNull();
    expect(r.gratuitoExpirado).toMatchObject({ planoNome: 'Inicial', inauguracao: true });
  });

  it('se contratou um plano, não avisa nada', async () => {
    mockPlanosFindMany.mockResolvedValue([
      plano({ id: 'pago', modo: 'CLIENTE', fim: null, campanha: null }),
      plano({ status: 'EXPIRADO' }),
    ]);
    const r = await situacaoDaEmpresa('emp', new Date('2026-11-20T12:00:00Z'));
    expect(r).toEqual({ bonificacao: null, gratuitoExpirado: null });
  });

  it('marca a modal como exibida só na bonificação', async () => {
    mockPlanoUpdateMany.mockResolvedValue({ count: 1 });
    await marcarBonificacaoExibida('emp');
    expect(mockPlanoUpdateMany.mock.calls[0][0].where).toEqual({
      usuarioId: 'emp',
      campanha: CAMPANHA_INAUGURACAO,
      bonificacaoExibidaEm: null,
    });
  });
});

describe('fim do plano gratuito (reconciliação diária)', () => {
  const agora = new Date('2026-11-12T05:00:00Z');
  const aviso = (extra: Record<string, unknown> = {}) => ({
    id: 'p1',
    usuarioId: 'emp1',
    fim: FIM_INAUGURACAO,
    campanha: CAMPANHA_INAUGURACAO,
    PlanosEmpresariais: { nome: 'Inicial' },
    Usuarios: { email: 'rh@empresa.com', nomeCompleto: 'Empresa X', ultimoLogin: new Date() },
    ...extra,
  });

  it('lembrete 3 dias antes: notifica na plataforma e por e-mail (uma vez)', async () => {
    mockPlanosFindMany.mockResolvedValueOnce([aviso()]).mockResolvedValueOnce([]);

    const r = await processarPlanosGratuitos(agora);

    expect(r).toMatchObject({ lembretes: 1, emails: 1, expirados: 0 });
    expect(mockPlanosFindMany.mock.calls[0][0].where).toMatchObject({
      modo: 'TESTE',
      status: 'ATIVO',
      lembreteExpiracaoEm: null,
    });
    expect(mockNotificar.mock.calls[0][0]).toMatchObject({
      tipo: 'PLANO_EXPIRANDO',
      titulo: 'Seu mês grátis está acabando',
      linkAcao: '/dashboard/upgrade',
    });
    expect(mockSendGeneric.mock.calls[0][2]).toBe(
      'Faltam poucos dias para o fim do seu mês grátis na Advance+',
    );
    expect(mockPlanoUpdate.mock.calls[0][0].data).toEqual({ lembreteExpiracaoEm: agora });
  });

  it('empresa que nunca entrou recebe só o aviso na plataforma (sem e-mail em massa)', async () => {
    mockPlanosFindMany
      .mockResolvedValueOnce([
        aviso({ Usuarios: { email: 'antigo@x.com', nomeCompleto: 'Y', ultimoLogin: null } }),
      ])
      .mockResolvedValueOnce([]);

    const r = await processarPlanosGratuitos(agora);

    expect(r.emails).toBe(0);
    expect(mockSendGeneric).not.toHaveBeenCalled();
    expect(mockNotificar).toHaveBeenCalledTimes(1);
  });

  it('vencido: EXPIRADO, vagas em rascunho e aviso de fim', async () => {
    mockPlanosFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([aviso()]);
    mockPlanoFindFirstEmpresa.mockResolvedValue(null);
    mockVagasUpdateMany.mockResolvedValue({ count: 2 });

    const r = await processarPlanosGratuitos(new Date('2026-11-15T05:00:00Z'));

    expect(r).toMatchObject({ expirados: 1, vagasParaRascunho: 2, emails: 1 });
    expect(mockPlanoUpdate.mock.calls[0][0].data).toMatchObject({ status: 'EXPIRADO' });
    expect(mockVagasUpdateMany.mock.calls[0][0]).toEqual({
      where: { usuarioId: 'emp1', status: { in: ['PUBLICADO', 'EM_ANALISE', 'PAUSADA'] } },
      data: { status: 'RASCUNHO' },
    });
    expect(mockNotificar.mock.calls[0][0]).toMatchObject({
      tipo: 'PLANO_EXPIRADO',
      titulo: 'Seu mês grátis chegou ao fim',
    });
    expect(mockSendGeneric.mock.calls[0][2]).toBe('Seu mês grátis na Advance+ chegou ao fim');
  });

  it('vencido, mas a empresa já contratou outro plano: vagas continuam publicadas', async () => {
    mockPlanosFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([aviso()]);
    mockPlanoFindFirstEmpresa.mockResolvedValue({ id: 'pago' });

    const r = await processarPlanosGratuitos(new Date('2026-11-15T05:00:00Z'));

    expect(r.expirados).toBe(1);
    expect(mockVagasUpdateMany).not.toHaveBeenCalled();
    expect(mockNotificar).not.toHaveBeenCalled();
  });
});

const mockEnvioFindMany = jest.fn();
const mockEnvioUpdate = jest.fn();
const mockAudit = jest.fn();
const mockListarEventos = jest.fn();
const mockListarBloqueados = jest.fn();
const mockRegistrarSinais = jest.fn();

jest.mock('@/config/prisma', () => ({
  prisma: {
    comunicadosEnvios: {
      findMany: (...a: unknown[]) => mockEnvioFindMany(...a),
      update: (...a: unknown[]) => mockEnvioUpdate(...a),
    },
  },
}));
jest.mock('@/modules/usuarios/utils/user-history', () => ({
  recordUserAuditEvent: (...a: unknown[]) => mockAudit(...a),
}));
jest.mock('../client/brevo-client', () => ({
  BrevoClient: {
    getInstance: () => ({
      listarEventos: (...a: unknown[]) => mockListarEventos(...a),
      listarContatosBloqueados: (...a: unknown[]) => mockListarBloqueados(...a),
    }),
  },
}));
jest.mock('../validacao', () => ({
  registrarSinaisBrevo: (...a: unknown[]) => mockRegistrarSinais(...a),
}));
jest.mock('../comunicados/primeiro-acesso.service', () => ({
  COMUNICADO_PRIMEIRO_ACESSO: 'PRIMEIRO_ACESSO_NOVA_PLATAFORMA_2026',
}));

import { sincronizarComBrevo } from '../comunicados/primeiro-acesso.sincronizacao';

const agora = new Date('2026-10-14T12:00:00Z');
const eventos: Record<string, unknown[]> = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const chave of Object.keys(eventos)) delete eventos[chave];
  mockListarEventos.mockImplementation(
    async ({ event }: { event: string }) => eventos[event] ?? [],
  );
  mockListarBloqueados.mockResolvedValue({ count: 0, contacts: [] });
  mockRegistrarSinais.mockResolvedValue(0);
  mockEnvioFindMany.mockResolvedValue([]);
});

describe('sincronização com a Brevo', () => {
  it('leva a lista de bloqueio e as devoluções para a validação por endereço', async () => {
    mockListarBloqueados.mockResolvedValue({
      count: 2,
      contacts: [
        { email: 'a@gmail.com', reason: { code: 'hardBounce' } },
        { email: 'b@gmail.com', reason: { code: 'contactFlaggedAsSpam' } },
      ],
    });
    eventos.hardBounces = [{ email: 'c@hotmail.com', messageId: '<x>', event: 'hardBounces' }];

    await sincronizarComBrevo(agora);

    expect(mockRegistrarSinais.mock.calls[0][0]).toEqual([
      { email: 'a@gmail.com', resultado: 'INVALIDO', motivo: 'BREVO_HARD_BOUNCE' },
      { email: 'b@gmail.com', resultado: 'BLOQUEADO', motivo: 'BREVO_DENUNCIA_SPAM' },
      { email: 'c@hotmail.com', resultado: 'INVALIDO', motivo: 'BREVO_HARD_BOUNCE' },
    ]);
  });

  it('marca devolução definitiva (com a data do evento), temporária e entrega', async () => {
    eventos.hardBounces = [
      {
        email: 'a@gmail.com',
        messageId: '<ABC@smtp-relay.mailin.fr>',
        event: 'hardBounces',
        reason: 'user unknown',
        date: '2026-10-13T15:40:00.000-03:00',
      },
    ];
    eventos.softBounces = [{ email: 'b@x.com', messageId: '<soft@relay>', event: 'softBounces' }];
    eventos.delivered = [
      {
        email: 'c@x.com',
        messageId: '<ok@relay>',
        event: 'delivered',
        date: '2026-10-13T15:41:00Z',
      },
      { email: 'a@gmail.com', messageId: '<abc@smtp-relay.mailin.fr>', event: 'delivered' },
    ];
    mockEnvioFindMany.mockResolvedValue([
      {
        id: 'e1',
        usuarioId: 'u1',
        messageId: '<abc@smtp-relay.mailin.fr>',
        status: 'ENVIADO',
        entregueEm: null,
      },
      { id: 'e2', usuarioId: 'u2', messageId: '<soft@relay>', status: 'ENVIADO', entregueEm: null },
      { id: 'e3', usuarioId: 'u3', messageId: '<ok@relay>', status: 'ENVIADO', entregueEm: null },
    ]);

    const r = await sincronizarComBrevo(agora);

    expect(r).toMatchObject({ devolvidos: 1, devolucoesTemporarias: 1, entregues: 1 });
    const porId = Object.fromEntries(mockEnvioUpdate.mock.calls.map(([a]) => [a.where.id, a.data]));
    // a devolução vale mesmo com evento de entrega anterior (bounce assíncrono)
    expect(porId.e1).toEqual({
      status: 'DEVOLVIDO',
      devolvidoEm: new Date('2026-10-13T18:40:00.000Z'),
      erro: 'hardBounces: user unknown',
    });
    expect(porId.e2).toMatchObject({ status: 'DEVOLUCAO_TEMPORARIA' });
    expect(porId.e3).toMatchObject({
      status: 'ENVIADO',
      entregueEm: new Date('2026-10-13T15:41:00Z'),
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ targetUserId: 'u1', action: 'COMUNICADO_EMAIL_DEVOLVIDO' }),
    );
  });

  it('erro da Brevo sobe (quem chama não pode seguir enviando)', async () => {
    mockListarBloqueados.mockRejectedValue(new Error('401 unrecognised IP'));
    await expect(sincronizarComBrevo(agora)).rejects.toThrow('unrecognised IP');
    expect(mockEnvioUpdate).not.toHaveBeenCalled();
  });
});

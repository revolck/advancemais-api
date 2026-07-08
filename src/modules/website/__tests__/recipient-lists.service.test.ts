jest.mock('../../../config/prisma', () => ({
  prisma: {
    websiteRecipientList: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    websiteRecipientListFolder: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    websiteRecipientListMember: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    websitePopupLead: {
      findMany: jest.fn(),
    },
    usuarios: {
      findMany: jest.fn(),
    },
    planosEmpresariais: {
      findMany: jest.fn(),
    },
    cursos: {
      findMany: jest.fn(),
    },
    cursosTurmas: {
      findMany: jest.fn(),
    },
    websitePopup: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        websiteRecipientListMember: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        websiteRecipientList: {
          update: jest.fn(),
        },
      }),
    ),
  },
}));

jest.mock('../../../utils/cache', () => ({
  invalidateCacheByPrefix: jest.fn(),
}));

import { prisma } from '../../../config/prisma';
import { websiteRecipientListsService } from '../services/recipient-lists.service';

describe('websiteRecipientListsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.websitePopupLead.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.usuarios.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.websiteRecipientListFolder.findUnique as jest.Mock).mockResolvedValue({
      id: 'folder-1',
    });
  });

  it('lista registros com paginação', async () => {
    (prisma.websiteRecipientList.count as jest.Mock).mockResolvedValue(1);
    (prisma.websiteRecipientList.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'list-1',
        nome: 'Lista 1',
        descricao: null,
        status: 'ATIVA',
        membershipMode: 'MANUAL',
        recipientCount: 0,
        lastCalculatedAt: null,
        criadoEm: new Date('2026-06-25T10:00:00.000Z'),
        atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
        Folder: null,
      },
    ]);

    const result = await websiteRecipientListsService.list({
      page: 1,
      pageSize: 10,
    });

    expect(result.lists).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('aplica filtros de tipo e atualizado em na listagem', async () => {
    (prisma.websiteRecipientList.count as jest.Mock).mockResolvedValue(0);
    (prisma.websiteRecipientList.findMany as jest.Mock).mockResolvedValue([]);

    await websiteRecipientListsService.list({
      page: 1,
      pageSize: 10,
      membershipMode: 'DINAMICA',
      updatedFrom: new Date('2026-07-01T15:30:00.000Z'),
      updatedTo: new Date('2026-07-02T10:45:00.000Z'),
    });

    expect(prisma.websiteRecipientList.count).toHaveBeenCalledWith({
      where: {
        membershipMode: 'DINAMICA',
        atualizadoEm: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      },
    });
    expect(prisma.websiteRecipientList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          membershipMode: 'DINAMICA',
          atualizadoEm: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
      }),
    );
  });

  it('retorna snapshots leves de status por ids', async () => {
    (prisma.websiteRecipientList.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'list-1',
        recipientCount: 42,
        lastCalculatedAt: new Date('2026-07-02T20:10:00.000Z'),
        recalculationStatus: 'PROCESSING',
        recalculationStartedAt: new Date('2026-07-02T20:12:00.000Z'),
        recalculationFinishedAt: null,
        recalculationError: null,
        atualizadoEm: new Date('2026-07-02T20:12:00.000Z'),
      },
    ]);

    const result = await websiteRecipientListsService.listStatuses({
      listIds: ['list-1', 'list-2'],
    });

    expect(prisma.websiteRecipientList.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['list-1', 'list-2'] },
      },
      select: {
        id: true,
        recipientCount: true,
        lastCalculatedAt: true,
        recalculationStatus: true,
        recalculationStartedAt: true,
        recalculationFinishedAt: true,
        recalculationError: true,
        atualizadoEm: true,
      },
      orderBy: { atualizadoEm: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('list-1');
  });

  it('cria lista manual e recalcula membros', async () => {
    (prisma.websiteRecipientList.create as jest.Mock).mockResolvedValue({
      id: 'list-1',
    });
    (prisma.websiteRecipientList.findUnique as jest.Mock).mockResolvedValue({
      id: 'list-1',
      nome: 'Lista 1',
      descricao: null,
      folderId: null,
      status: 'ATIVA',
      membershipMode: 'MANUAL',
      rulesConfig: null,
      manualIncludes: [],
      manualExcludes: [],
      recipientCount: 0,
      lastCalculatedAt: null,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
      Folder: null,
      Members: [],
    });

    const result = await websiteRecipientListsService.create(
      {
        nome: 'Lista 1',
        membershipMode: 'MANUAL',
        status: 'ATIVA',
        manualIncludes: [],
        manualExcludes: [],
      },
      'user-1',
    );

    expect(prisma.websiteRecipientList.create).toHaveBeenCalled();
    expect(result?.id).toBe('list-1');
  });

  it('usa select mínimo em regra dinâmica totalmente resolvida no banco', async () => {
    (prisma.websiteRecipientList.create as jest.Mock).mockResolvedValue({
      id: 'list-dynamic-1',
    });
    (prisma.websiteRecipientList.findUnique as jest.Mock).mockResolvedValue({
      id: 'list-dynamic-1',
      nome: 'Lista dinâmica',
      descricao: null,
      folderId: null,
      status: 'ATIVA',
      membershipMode: 'DINAMICA',
      rulesConfig: {
        operator: 'AND',
        conditions: [
          {
            field: 'recipient.base.kind',
            operator: 'IS',
            value: 'USUARIO',
          },
          {
            field: 'recipient.user.status',
            operator: 'IS',
            value: 'ATIVO',
          },
        ],
        groups: [],
      },
      manualIncludes: [],
      manualExcludes: [],
      recipientCount: 0,
      lastCalculatedAt: null,
      recalculationStatus: 'IDLE',
      recalculationStartedAt: null,
      recalculationFinishedAt: null,
      recalculationError: null,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
      Folder: null,
      Members: [],
    });

    await websiteRecipientListsService.create(
      {
        nome: 'Lista dinâmica',
        membershipMode: 'DINAMICA',
        status: 'ATIVA',
        rulesConfig: {
          operator: 'AND',
          conditions: [
            {
              field: 'recipient.base.kind',
              operator: 'IS',
              value: 'USUARIO',
            },
            {
              field: 'recipient.user.status',
              operator: 'IS',
              value: 'ATIVO',
            },
          ],
          groups: [],
        },
        manualIncludes: [],
        manualExcludes: [],
      },
      'user-1',
    );

    expect(prisma.usuarios.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ status: 'ATIVO' }],
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        role: true,
      },
    });
  });

  it('não busca leads quando a regra exige campo exclusivo de usuário', async () => {
    (prisma.websiteRecipientList.create as jest.Mock).mockResolvedValue({
      id: 'list-dynamic-2',
    });
    (prisma.websiteRecipientList.findUnique as jest.Mock).mockResolvedValue({
      id: 'list-dynamic-2',
      nome: 'Lista dinâmica 2',
      descricao: null,
      folderId: null,
      status: 'ATIVA',
      membershipMode: 'DINAMICA',
      rulesConfig: {
        operator: 'AND',
        conditions: [
          {
            field: 'recipient.user.status',
            operator: 'IS',
            value: 'ATIVO',
          },
        ],
        groups: [],
      },
      manualIncludes: [],
      manualExcludes: [],
      recipientCount: 0,
      lastCalculatedAt: null,
      recalculationStatus: 'IDLE',
      recalculationStartedAt: null,
      recalculationFinishedAt: null,
      recalculationError: null,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
      Folder: null,
      Members: [],
    });

    await websiteRecipientListsService.create(
      {
        nome: 'Lista dinâmica 2',
        membershipMode: 'DINAMICA',
        status: 'ATIVA',
        rulesConfig: {
          operator: 'AND',
          conditions: [
            {
              field: 'recipient.user.status',
              operator: 'IS',
              value: 'ATIVO',
            },
          ],
          groups: [],
        },
        manualIncludes: [],
        manualExcludes: [],
      },
      'user-1',
    );

    expect(prisma.websitePopupLead.findMany).not.toHaveBeenCalled();
    expect(prisma.usuarios.findMany).toHaveBeenCalled();
  });

  it('rejeita lista dinâmica sem condição válida', async () => {
    await expect(
      websiteRecipientListsService.create(
        {
          nome: 'Lista dinâmica',
          membershipMode: 'DINAMICA',
          status: 'ATIVA',
          rulesConfig: {
            operator: 'AND',
            conditions: [],
            groups: [],
          },
          manualIncludes: [],
          manualExcludes: [],
        },
        'user-1',
      ),
    ).rejects.toMatchObject({
      message: 'Listas dinâmicas e híbridas precisam de ao menos uma condição válida.',
    });
  });

  it('rejeita lista com subgrupos aninhados', async () => {
    await expect(
      websiteRecipientListsService.create(
        {
          nome: 'Lista com grupos',
          membershipMode: 'DINAMICA',
          status: 'ATIVA',
          rulesConfig: {
            operator: 'AND',
            conditions: [
              {
                field: 'recipient.base.kind',
                operator: 'IS',
                value: 'USUARIO',
              },
            ],
            groups: [
              {
                operator: 'OR',
                conditions: [],
                groups: [],
              },
            ],
          },
          manualIncludes: [],
          manualExcludes: [],
        },
        'user-1',
      ),
    ).rejects.toMatchObject({
      message: 'Esta versão aceita apenas um grupo principal de regras, sem subgrupos aninhados.',
    });
  });

  it('rejeita híbrida com inclusão e exclusão repetidas', async () => {
    await expect(
      websiteRecipientListsService.create(
        {
          nome: 'Lista híbrida',
          membershipMode: 'HIBRIDA',
          status: 'ATIVA',
          rulesConfig: {
            operator: 'AND',
            conditions: [
              {
                field: 'recipient.base.kind',
                operator: 'IS',
                value: 'USUARIO',
              },
            ],
            groups: [],
          },
          manualIncludes: [{ recipientKind: 'USUARIO', recipientId: 'user-1' }],
          manualExcludes: [{ recipientKind: 'USUARIO', recipientId: 'user-1' }],
        },
        'user-1',
      ),
    ).rejects.toMatchObject({
      message: 'O mesmo destinatário não pode estar em inclusões e exclusões da mesma lista.',
    });
  });

  it('marca lista como PROCESSING ao solicitar recálculo', async () => {
    (prisma.websiteRecipientList.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.websiteRecipientList.findUnique as jest.Mock).mockResolvedValue({
      id: 'list-1',
      nome: 'Lista 1',
      descricao: null,
      folderId: null,
      status: 'ATIVA',
      membershipMode: 'DINAMICA',
      rulesConfig: {
        operator: 'AND',
        conditions: [
          {
            field: 'recipient.base.kind',
            operator: 'IS',
            value: 'USUARIO',
          },
        ],
        groups: [],
      },
      manualIncludes: [],
      manualExcludes: [],
      recipientCount: 0,
      lastCalculatedAt: null,
      recalculationStatus: 'PROCESSING',
      recalculationStartedAt: new Date('2026-07-02T19:35:00.000Z'),
      recalculationFinishedAt: null,
      recalculationError: null,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
      Folder: null,
      Members: [],
    });

    const result = await websiteRecipientListsService.recalculate('list-1', 'user-1');

    expect(prisma.websiteRecipientList.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'list-1' }),
        data: expect.objectContaining({
          recalculationStatus: 'PROCESSING',
        }),
      }),
    );
    expect(result?.recalculationStatus).toBe('PROCESSING');
  });
});

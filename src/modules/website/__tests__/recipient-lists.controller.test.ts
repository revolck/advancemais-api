jest.mock('@/modules/website/services/recipient-lists.service', () => ({
  websiteRecipientListsService: {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    recalculate: jest.fn(),
    listFolders: jest.fn(),
    createFolder: jest.fn(),
    updateFolder: jest.fn(),
    removeFolder: jest.fn(),
    getRuleOptions: jest.fn(),
    getRecipientsOptions: jest.fn(),
    listStatuses: jest.fn(),
  },
}));

import type { Request, Response } from 'express';

import { WebsiteRecipientListsController } from '../controllers/recipient-lists.controller';
import { websiteRecipientListsService } from '@/modules/website/services/recipient-lists.service';

const makeResponse = () =>
  ({
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as Response;

describe('WebsiteRecipientListsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista listas com paginação', async () => {
    (websiteRecipientListsService.list as jest.Mock).mockResolvedValue({
      lists: [{ id: 'list-1', nome: 'Lista 1' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    const req = {
      query: { page: '1', pageSize: '10' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.list(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      lists: [{ id: 'list-1', nome: 'Lista 1' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('retorna 400 para filtro de data inválido', async () => {
    const req = {
      query: { updatedFrom: 'data-invalida' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.list(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
      }),
    );
  });

  it('cria lista nova', async () => {
    (websiteRecipientListsService.create as jest.Mock).mockResolvedValue({
      id: 'list-1',
      nome: 'Lista 1',
    });

    const req = {
      body: {
        nome: 'Lista 1',
        membershipMode: 'MANUAL',
      },
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.create(req, res);

    expect(websiteRecipientListsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: 'Lista 1',
        membershipMode: 'MANUAL',
      }),
      'user-1',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('retorna opções de regras', async () => {
    (websiteRecipientListsService.getRuleOptions as jest.Mock).mockResolvedValue({
      categories: [],
      routines: [],
    });

    const req = {} as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.rulesOptions(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { categories: [], routines: [] },
    });
  });

  it('retorna status das listas por ids', async () => {
    (websiteRecipientListsService.listStatuses as jest.Mock).mockResolvedValue([
      {
        id: 'list-1',
        recalculationStatus: 'PROCESSING',
        recipientCount: 10,
      },
    ]);

    const req = {
      query: { listIds: 'list-1,list-2' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.statuses(req, res);

    expect(websiteRecipientListsService.listStatuses).toHaveBeenCalledWith({
      listIds: ['list-1', 'list-2'],
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          id: 'list-1',
          recalculationStatus: 'PROCESSING',
          recipientCount: 10,
        },
      ],
    });
  });

  it('dispara recálculo com actor id', async () => {
    (websiteRecipientListsService.recalculate as jest.Mock).mockResolvedValue({
      id: 'list-1',
      recalculationStatus: 'PROCESSING',
    });

    const req = {
      params: { id: 'list-1' },
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteRecipientListsController.recalculate(req, res);

    expect(websiteRecipientListsService.recalculate).toHaveBeenCalledWith('list-1', 'user-1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: 'list-1',
        recalculationStatus: 'PROCESSING',
      },
    });
  });
});

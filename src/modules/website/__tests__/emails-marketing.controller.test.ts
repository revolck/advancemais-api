jest.mock('@/modules/website/services/emails-marketing.service', () => ({
  websiteEmailsMarketingService: {
    list: jest.fn(),
    getFilterOptions: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));

import type { Request, Response } from 'express';

import { WebsiteEmailsMarketingController } from '../controllers/emails-marketing.controller';
import { websiteEmailsMarketingService } from '@/modules/website/services/emails-marketing.service';

const makeResponse = () =>
  ({
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as Response;

describe('WebsiteEmailsMarketingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista campanhas com paginação', async () => {
    (websiteEmailsMarketingService.list as jest.Mock).mockResolvedValue({
      emails: [{ id: 'email-1', nome: 'Campanha Junho' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    const req = {
      query: { page: '1', pageSize: '10', status: 'RASCUNHO' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteEmailsMarketingController.list(req, res);

    expect(websiteEmailsMarketingService.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      status: 'RASCUNHO',
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      emails: [{ id: 'email-1', nome: 'Campanha Junho' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('lista opções de filtro', async () => {
    (websiteEmailsMarketingService.getFilterOptions as jest.Mock).mockResolvedValue({
      users: [{ id: 'user-1', nomeCompleto: 'Filipe Admin', avatarUrl: null }],
    });

    const req = {} as Request;
    const res = makeResponse();

    await WebsiteEmailsMarketingController.filterOptions(req, res);

    expect(websiteEmailsMarketingService.getFilterOptions).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        users: [{ id: 'user-1', nomeCompleto: 'Filipe Admin', avatarUrl: null }],
      },
    });
  });

  it('cria uma campanha de e-mail', async () => {
    (websiteEmailsMarketingService.create as jest.Mock).mockResolvedValue({
      id: 'email-1',
      nome: 'Novo e-mail',
      status: 'RASCUNHO',
      tipo: 'CAMPANHA',
      destinatariosEstimados: 0,
    });

    const req = {
      body: {
        nome: 'Novo e-mail',
        tipo: 'CAMPANHA',
      },
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteEmailsMarketingController.create(req, res);

    expect(websiteEmailsMarketingService.create).toHaveBeenCalledWith(
      {
        nome: 'Novo e-mail',
        status: 'RASCUNHO',
        tipo: 'CAMPANHA',
      },
      'user-1',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('atualiza uma campanha de e-mail', async () => {
    (websiteEmailsMarketingService.update as jest.Mock).mockResolvedValue({
      id: 'email-1',
      status: 'PUBLICADO',
    });

    const req = {
      params: { id: 'email-1' },
      body: { status: 'PUBLICADO' },
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteEmailsMarketingController.update(req, res);

    expect(websiteEmailsMarketingService.update).toHaveBeenCalledWith(
      'email-1',
      { status: 'PUBLICADO' },
      'user-1',
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 'email-1', status: 'PUBLICADO' },
    });
  });

  it('remove uma campanha de e-mail', async () => {
    (websiteEmailsMarketingService.remove as jest.Mock).mockResolvedValue(undefined);

    const req = {
      params: { id: 'email-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsiteEmailsMarketingController.remove(req, res);

    expect(websiteEmailsMarketingService.remove).toHaveBeenCalledWith('email-1');
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

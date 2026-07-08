jest.mock('../../../config/prisma', () => ({
  prisma: {
    websiteMarketingEmail: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    websitePopupLead: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    websitePopup: {
      findMany: jest.fn(),
    },
    websiteRecipientList: {
      findMany: jest.fn(),
    },
    websiteRecipientListMember: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/cache', () => ({
  invalidateCacheByPrefix: jest.fn(),
}));

jest.mock('../../../modules/configuracoes-gerais/services/runtime-config.service', () => ({
  runtimeConfigService: {
    getBrevoConfig: jest.fn().mockResolvedValue({
      fromEmail: 'developer@advancemais.com',
      fromName: 'Advance+',
    }),
  },
}));

const scheduledHandlers: (() => Promise<void> | void)[] = [];

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    schedule: jest.fn((_expression: string, handler: () => Promise<void> | void) => {
      scheduledHandlers.push(handler);
      return { stop: jest.fn() };
    }),
  },
}));

import { prisma } from '../../../config/prisma';
import { invalidateCacheByPrefix } from '../../../utils/cache';
import {
  startMarketingEmailDeliveryWorker,
  websiteEmailsMarketingService,
} from '../services/emails-marketing.service';

describe('websiteEmailsMarketingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduledHandlers.length = 0;
    (prisma.websiteRecipientList.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.websiteRecipientListMember.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('lista campanhas com filtros e paginação', async () => {
    (prisma.websiteMarketingEmail.count as jest.Mock).mockResolvedValue(1);
    (prisma.websiteMarketingEmail.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'email-1',
        nome: 'Campanha Junho',
        status: 'RASCUNHO',
        tipo: 'CAMPANHA',
        assunto: 'Assunto',
        previewText: 'Preview',
        templateSlug: 'template-base',
        settingsConfig: null,
        destinatariosEstimados: 120,
        criadoEm: new Date('2026-06-25T10:00:00.000Z'),
        atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
        CriadoPor: null,
        AtualizadoPor: null,
      },
    ]);

    const result = await websiteEmailsMarketingService.list({
      page: 1,
      pageSize: 10,
      search: 'junho',
      status: 'RASCUNHO',
      tipo: 'CAMPANHA',
    });

    expect(prisma.websiteMarketingEmail.count).toHaveBeenCalledWith({
      where: {
        status: 'RASCUNHO',
        tipo: 'CAMPANHA',
        OR: [
          { nome: { contains: 'junho', mode: 'insensitive' } },
          { assunto: { contains: 'junho', mode: 'insensitive' } },
          { previewText: { contains: 'junho', mode: 'insensitive' } },
          { templateSlug: { contains: 'junho', mode: 'insensitive' } },
        ],
      },
    });
    expect(result.pagination.total).toBe(1);
    expect(result.emails).toHaveLength(1);
  });

  it('filtra campanhas por status derivado e período de envio', async () => {
    (prisma.websiteMarketingEmail.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'email-1',
        nome: 'Campanha enviada',
        status: 'PUBLICADO',
        tipo: 'CAMPANHA',
        assunto: 'Assunto',
        previewText: null,
        templateSlug: null,
        settingsConfig: {
          deliveryMode: 'NOW',
          deliveryStatus: 'SENT',
          lastSentAt: '2026-07-03T15:00:00.000Z',
        },
        destinatariosEstimados: 20,
        criadoEm: new Date('2026-07-03T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-03T15:00:00.000Z'),
        CriadoPor: null,
        AtualizadoPor: null,
      },
      {
        id: 'email-2',
        nome: 'Campanha agendada',
        status: 'PUBLICADO',
        tipo: 'CAMPANHA',
        assunto: 'Assunto 2',
        previewText: null,
        templateSlug: null,
        settingsConfig: {
          deliveryMode: 'SCHEDULED',
          deliveryStatus: 'IDLE',
          scheduledAt: '2026-07-05T15:00:00.000Z',
        },
        destinatariosEstimados: 10,
        criadoEm: new Date('2026-07-03T10:00:00.000Z'),
        atualizadoEm: new Date('2026-07-03T15:00:00.000Z'),
        CriadoPor: null,
        AtualizadoPor: null,
      },
    ]);

    const result = await websiteEmailsMarketingService.list({
      page: 1,
      pageSize: 10,
      workflowStatus: 'ENVIADO',
      sentFrom: '2026-07-03T00:00:00.000Z',
      sentTo: '2026-07-04T23:59:59.999Z',
    });

    expect(prisma.websiteMarketingEmail.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLICADO' },
      orderBy: { atualizadoEm: 'desc' },
      select: expect.any(Object),
    });
    expect(result.pagination.total).toBe(1);
    expect(result.emails[0]).toMatchObject({
      id: 'email-1',
      workflowStatus: 'ENVIADO',
      deliveryReferenceAt: '2026-07-03T15:00:00.000Z',
    });
  });

  it('cria campanha e invalida cache', async () => {
    (prisma.websiteMarketingEmail.create as jest.Mock).mockResolvedValue({
      id: 'email-1',
      nome: 'Novo e-mail',
      status: 'RASCUNHO',
      tipo: 'CAMPANHA',
      assunto: null,
      previewText: null,
      templateSlug: null,
      htmlContent: null,
      contentConfig: null,
      targetConfig: null,
      senderConfig: null,
      settingsConfig: null,
      destinatariosEstimados: 0,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
    });
    (prisma.websitePopupLead.count as jest.Mock).mockResolvedValue(0);

    const result = await websiteEmailsMarketingService.create(
      {
        nome: 'Novo e-mail',
        status: 'RASCUNHO',
        tipo: 'CAMPANHA',
        destinatariosEstimados: 0,
      },
      'user-1',
    );

    expect(prisma.websiteMarketingEmail.create).toHaveBeenCalled();
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith('website:emails-marketing');
    expect(result.id).toBe('email-1');
  });

  it('atualiza status de campanha existente', async () => {
    (prisma.websiteMarketingEmail.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'email-1',
      targetConfig: null,
      senderConfig: null,
    });
    (prisma.websitePopupLead.count as jest.Mock).mockResolvedValue(0);
    (prisma.websiteMarketingEmail.update as jest.Mock).mockResolvedValue({
      id: 'email-1',
      status: 'PUBLICADO',
      tipo: 'CAMPANHA',
      nome: 'Campanha',
      assunto: null,
      previewText: null,
      templateSlug: null,
      htmlContent: null,
      contentConfig: null,
      targetConfig: null,
      senderConfig: null,
      settingsConfig: null,
      destinatariosEstimados: 0,
      criadoPorId: null,
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
    });

    const result = await websiteEmailsMarketingService.update(
      'email-1',
      { status: 'PUBLICADO' },
      'user-1',
    );

    expect(prisma.websiteMarketingEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'email-1' },
        data: expect.objectContaining({
          status: 'PUBLICADO',
          atualizadoPorId: 'user-1',
        }),
      }),
    );
    expect(result.status).toBe('PUBLICADO');
  });

  it('remove campanha existente', async () => {
    (prisma.websiteMarketingEmail.findUnique as jest.Mock).mockResolvedValue({
      id: 'email-1',
      settingsConfig: null,
    });
    (prisma.websiteMarketingEmail.delete as jest.Mock).mockResolvedValue({
      id: 'email-1',
    });

    await websiteEmailsMarketingService.remove('email-1');

    expect(prisma.websiteMarketingEmail.delete).toHaveBeenCalledWith({
      where: { id: 'email-1' },
    });
    expect(invalidateCacheByPrefix).toHaveBeenCalledWith('website:emails-marketing');
  });

  it('bloqueia edição de campanha já enviada', async () => {
    (prisma.websiteMarketingEmail.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'email-1',
      nome: 'Campanha enviada',
      status: 'PUBLICADO',
      tipo: 'CAMPANHA',
      assunto: 'Assunto',
      previewText: null,
      templateSlug: null,
      htmlContent: '<p>ok</p>',
      contentConfig: null,
      targetConfig: null,
      senderConfig: null,
      settingsConfig: {
        deliveryMode: 'NOW',
        deliveryStatus: 'SENT',
        lastSentAt: '2026-07-04T12:00:00.000Z',
      },
      destinatariosEstimados: 1,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-07-04T10:00:00.000Z'),
      atualizadoEm: new Date('2026-07-04T12:00:00.000Z'),
      CriadoPor: null,
      AtualizadoPor: null,
    });

    await expect(
      websiteEmailsMarketingService.update('email-1', { nome: 'Novo nome' }, 'user-1'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'MARKETING_EMAIL_SENT_LOCKED',
    });

    expect(prisma.websiteMarketingEmail.update).not.toHaveBeenCalled();
  });

  it('bloqueia exclusão de campanha já enviada', async () => {
    (prisma.websiteMarketingEmail.findUnique as jest.Mock).mockResolvedValue({
      id: 'email-1',
      settingsConfig: {
        deliveryMode: 'NOW',
        deliveryStatus: 'SENT',
        lastSentAt: '2026-07-04T12:00:00.000Z',
      },
    });

    await expect(websiteEmailsMarketingService.remove('email-1')).rejects.toMatchObject({
      status: 409,
      code: 'MARKETING_EMAIL_SENT_LOCKED',
    });

    expect(prisma.websiteMarketingEmail.delete).not.toHaveBeenCalled();
  });

  it('conta destinatários por listas salvas', async () => {
    (prisma.websiteMarketingEmail.create as jest.Mock).mockResolvedValue({
      id: 'email-2',
      nome: 'Campanha listas',
      status: 'RASCUNHO',
      tipo: 'CAMPANHA',
      assunto: null,
      previewText: null,
      templateSlug: null,
      htmlContent: null,
      contentConfig: null,
      targetConfig: {
        audienceType: 'LISTS',
        listIds: ['list-1'],
      },
      senderConfig: null,
      settingsConfig: null,
      destinatariosEstimados: 2,
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-25T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-25T10:00:00.000Z'),
    });
    (prisma.websiteRecipientListMember.findMany as jest.Mock).mockResolvedValue([
      { email: 'alvo-1@teste.com' },
      { email: 'alvo-2@teste.com' },
      { email: 'alvo-1@teste.com' },
    ]);

    const result = await websiteEmailsMarketingService.create(
      {
        nome: 'Campanha listas',
        status: 'RASCUNHO',
        tipo: 'CAMPANHA',
        targetConfig: {
          mode: 'REGULAR',
          audienceType: 'LISTS',
          contactIds: [],
          listIds: ['list-1'],
        },
        destinatariosEstimados: 0,
      },
      'user-1',
    );

    expect(prisma.websiteRecipientListMember.findMany).toHaveBeenCalledWith({
      where: {
        listId: { in: ['list-1'] },
      },
      select: {
        email: true,
      },
    });
    expect(result.destinatariosEstimados).toBe(2);
  });

  it('lista usuários disponíveis para filtro', async () => {
    (prisma.websiteMarketingEmail.findMany as jest.Mock).mockResolvedValue([
      {
        atualizadoPorId: 'user-2',
        AtualizadoPor: {
          id: 'user-2',
          nomeCompleto: 'Bruna Souza',
          UsuariosInformation: { avatarUrl: null },
        },
      },
      {
        atualizadoPorId: 'user-1',
        AtualizadoPor: {
          id: 'user-1',
          nomeCompleto: 'Filipe Admin',
          UsuariosInformation: { avatarUrl: 'https://cdn/avatar.png' },
        },
      },
      {
        atualizadoPorId: 'user-1',
        AtualizadoPor: {
          id: 'user-1',
          nomeCompleto: 'Filipe Admin',
          UsuariosInformation: { avatarUrl: 'https://cdn/avatar.png' },
        },
      },
    ]);

    const result = await websiteEmailsMarketingService.getFilterOptions();

    expect(result.users).toEqual([
      {
        id: 'user-2',
        nomeCompleto: 'Bruna Souza',
        avatarUrl: null,
      },
      {
        id: 'user-1',
        nomeCompleto: 'Filipe Admin',
        avatarUrl: 'https://cdn/avatar.png',
      },
    ]);
  });

  it('marca como falha quando processamento assíncrono excede 5 minutos', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-04T10:06:00.000Z'));

    (prisma.websiteMarketingEmail.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'email-processing-timeout',
        settingsConfig: {
          deliveryMode: 'NOW',
          deliveryStatus: 'PROCESSING',
          processingStartedAt: '2026-07-04T10:00:00.000Z',
          lastError: null,
        },
      },
    ]);
    (prisma.websiteMarketingEmail.update as jest.Mock).mockResolvedValue({
      id: 'email-processing-timeout',
    });

    startMarketingEmailDeliveryWorker();
    await scheduledHandlers[0]?.();

    expect(prisma.websiteMarketingEmail.update).toHaveBeenCalledWith({
      where: { id: 'email-processing-timeout' },
      data: {
        settingsConfig: expect.objectContaining({
          deliveryMode: 'NOW',
          deliveryStatus: 'FAILED',
          processingStartedAt: null,
          lastError: 'Tempo limite de 5 minutos excedido durante o processamento do envio.',
        }),
      },
    });

    jest.useRealTimers();
  });
});

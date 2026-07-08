jest.mock('../../../config/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    auditoriaLogs: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    websitePopup: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    websitePopupContato: {
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    websitePopupLead: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    websitePopupLeadNote: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    websitePopupLeadInterest: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../../utils/cache', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  invalidateCacheByPrefix: jest.fn(),
}));

import { Prisma } from '@prisma/client';

import { prisma } from '../../../config/prisma';
import { getCache, invalidateCacheByPrefix, setCache } from '../../../utils/cache';
import { websitePopupsService } from '../services/popups.service';

describe('websitePopupsService.active', () => {
  const popupBase = {
    id: 'popup-1',
    nome: 'Popup teste',
    templateSlug: 'template-1',
    dispositivo: 'DESKTOP',
    escopo: 'WEBSITE',
    posicaoDesktop: 'CENTRO',
    posicaoMobile: 'CENTRO',
    gatilho: 'CLIQUE',
    atrasoSegundos: 5,
    inatividadeSegundos: null,
    scrollPercentual: null,
    seletorAlvo: '.legacy-cta',
    frequencia: 'UMA_VEZ_A_CADA_6_HORAS',
    tag: null,
    redirectUrl: null,
    redirectNovaAba: false,
    prioridade: 10,
    contentConfig: { titulo: 'Titulo', subtitulo: 'Subtitulo', botaoTexto: 'Cadastrar' },
    formFields: [],
    designConfig: { backgroundColor: '#fff' },
    pageRules: { mode: 'ALL_PAGES' },
    atualizadoEm: new Date('2026-06-15T11:31:32.321Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getCache as jest.Mock).mockResolvedValue(null);
    (setCache as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns triggerTarget when the column exists', async () => {
    (prisma.websitePopup.findMany as jest.Mock).mockResolvedValue([
      {
        ...popupBase,
        triggerTarget: 'website-nav-courses',
      },
    ]);

    const result = await websitePopupsService.active({
      scope: 'WEBSITE',
      path: '/cursos',
      device: 'DESKTOP',
    });

    expect(result).toHaveLength(1);
    expect(result[0].triggerTarget).toBe('website-nav-courses');
    expect(prisma.websitePopup.findMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy select when triggerTarget column is missing', async () => {
    const missingColumnError = new Prisma.PrismaClientKnownRequestError(
      'The column `WebsitePopup.triggerTarget` does not exist in the current database.',
      {
        code: 'P2022',
        clientVersion: '6.19.0',
      },
    );

    (prisma.websitePopup.findMany as jest.Mock)
      .mockRejectedValueOnce(missingColumnError)
      .mockResolvedValueOnce([
        {
          ...popupBase,
        },
      ]);

    const result = await websitePopupsService.active({
      scope: 'WEBSITE',
      path: '/cursos',
      device: 'DESKTOP',
    });

    expect(prisma.websitePopup.findMany).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].triggerTarget).toBeNull();
    expect(result[0].seletorAlvo).toBe('.legacy-cta');
  });

  it('filters popups by specific fixed page rule', async () => {
    (prisma.websitePopup.findMany as jest.Mock).mockResolvedValue([
      {
        ...popupBase,
        pageRules: {
          mode: 'SPECIFIC_PAGE',
          pageKey: 'ABOUT',
        },
        triggerTarget: 'website-nav-about',
      },
      {
        ...popupBase,
        id: 'popup-2',
        pageRules: {
          mode: 'SPECIFIC_PAGE',
          pageKey: 'COURSES',
        },
        triggerTarget: 'website-nav-courses',
      },
    ]);

    const result = await websitePopupsService.active({
      scope: 'WEBSITE',
      path: '/sobre',
      device: 'DESKTOP',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('popup-1');
    expect(result[0].pageRules).toEqual({
      mode: 'SPECIFIC_PAGE',
      pageKey: 'ABOUT',
    });
  });
});

describe('websitePopupsService.list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies list filters and returns pagination metadata', async () => {
    (prisma.websitePopup.count as jest.Mock).mockResolvedValue(1);
    (prisma.websitePopup.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'popup-1',
        nome: 'Popup publicado',
        templateSlug: 'template-1',
        status: 'PUBLICADO',
        dispositivo: 'DESKTOP',
        escopo: 'WEBSITE',
        gatilho: 'CLIQUE',
        cronograma: 'EXIBIR_AGORA',
        frequencia: 'UMA_VEZ_A_CADA_6_HORAS',
        prioridade: 10,
        tag: 'Campanha',
        criadoEm: new Date('2026-06-15T11:31:32.321Z'),
        atualizadoEm: new Date('2026-06-15T11:31:32.321Z'),
        _count: { WebsitePopupContatos: 3 },
      },
    ]);

    const result = await websitePopupsService.list({
      page: 1,
      pageSize: 10,
      search: 'publicado',
      status: 'PUBLICADO',
      dispositivo: 'DESKTOP',
      escopo: 'WEBSITE',
    });

    expect(prisma.websitePopup.count).toHaveBeenCalledWith({
      where: {
        status: 'PUBLICADO',
        dispositivo: 'DESKTOP',
        escopo: 'WEBSITE',
        OR: [
          { nome: { contains: 'publicado', mode: 'insensitive' } },
          { templateSlug: { contains: 'publicado', mode: 'insensitive' } },
          { tag: { contains: 'publicado', mode: 'insensitive' } },
        ],
      },
    });
    expect(result.pagination.total).toBe(1);
    expect(result.popups).toHaveLength(1);
  });
});

describe('websitePopupsService.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a legacy data-popup-target selector when triggerTarget column is missing', async () => {
    (prisma.websitePopup.create as jest.Mock).mockResolvedValue({
      id: 'popup-legacy',
      nome: 'Popup legado',
      templateSlug: 'template-legacy',
      status: 'RASCUNHO',
      dispositivo: 'DESKTOP',
      escopo: 'WEBSITE',
      posicaoDesktop: 'CENTRO',
      posicaoMobile: 'CENTRO',
      gatilho: 'CLIQUE',
      atrasoSegundos: 5,
      inatividadeSegundos: null,
      scrollPercentual: null,
      seletorAlvo: '[data-popup-target="website-nav-courses"]',
      cronograma: 'EXIBIR_AGORA',
      inicioEm: null,
      fimEm: null,
      frequencia: 'UMA_VEZ_A_CADA_6_HORAS',
      tag: null,
      redirectUrl: null,
      redirectNovaAba: false,
      prioridade: 0,
      contentConfig: { titulo: 'Titulo', subtitulo: 'Subtitulo', botaoTexto: 'Cadastrar' },
      formFields: [],
      designConfig: { backgroundColor: '#fff' },
      subscriptionConfig: null,
      pageRules: { mode: 'ALL_PAGES' },
      criadoPorId: 'user-1',
      atualizadoPorId: 'user-1',
      criadoEm: new Date('2026-06-15T11:31:32.321Z'),
      atualizadoEm: new Date('2026-06-15T11:31:32.321Z'),
      _count: { WebsitePopupContatos: 0 },
    });

    const result = await websitePopupsService.create(
      {
        nome: 'Popup legado',
        templateSlug: 'template-legacy',
        status: 'RASCUNHO',
        dispositivo: 'DESKTOP',
        escopo: 'WEBSITE',
        posicaoDesktop: 'CENTRO',
        posicaoMobile: 'CENTRO',
        gatilho: 'CLIQUE',
        atrasoSegundos: 5,
        cronograma: 'EXIBIR_AGORA',
        frequencia: 'UMA_VEZ_A_CADA_6_HORAS',
        prioridade: 0,
        contentConfig: { titulo: 'Titulo', subtitulo: 'Subtitulo', botaoTexto: 'Cadastrar' },
        formFields: [],
        designConfig: { backgroundColor: '#fff' } as any,
        subscriptionConfig: null,
        pageRules: { mode: 'ALL_PAGES' },
        triggerTarget: 'website-nav-courses',
        seletorAlvo: null,
      } as any,
      'user-1',
    );

    const createCalls = (prisma.websitePopup.create as jest.Mock).mock.calls;
    const lastCreateCall = createCalls[createCalls.length - 1]?.[0];

    expect(createCalls.length).toBeGreaterThan(0);
    expect(lastCreateCall.data.seletorAlvo).toBe('[data-popup-target="website-nav-courses"]');
    expect(result.triggerTarget).toBeNull();
    expect(result.seletorAlvo).toBe('[data-popup-target="website-nav-courses"]');
  });
});

describe('websitePopupsService.remove', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (invalidateCacheByPrefix as jest.Mock).mockResolvedValue(undefined);
  });

  it('maps missing popup deletion to 404', async () => {
    (prisma.websitePopup.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(websitePopupsService.remove('missing-popup')).rejects.toMatchObject({
      message: 'Pop-up não encontrado',
      statusCode: 404,
    });
  });

  it('keeps delete successful even when cache invalidation fails', async () => {
    (prisma.websitePopup.findUnique as jest.Mock).mockResolvedValue({
      id: 'popup-1',
      nome: 'Popup teste',
    });
    (prisma.websitePopupContato.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.websitePopup.delete as jest.Mock).mockResolvedValue({ id: 'popup-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (operations: Promise<unknown>[]) => {
        await Promise.all(operations);
        return [];
      },
    );
    (invalidateCacheByPrefix as jest.Mock).mockRejectedValue(new Error('cache down'));

    await expect(websitePopupsService.remove('popup-1')).resolves.toBeUndefined();
    expect(prisma.websitePopupContato.updateMany).toHaveBeenCalledWith({
      where: { popupId: 'popup-1' },
      data: {
        popupId: null,
        popupNome: 'Popup teste',
      },
    });
    expect(prisma.websitePopup.delete).toHaveBeenCalledWith({
      where: { id: 'popup-1' },
    });
  });
});

describe('websitePopupsService.getContactActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('combines capture records with audit events ordered by latest first', async () => {
    (prisma.websitePopupLead.findFirst as jest.Mock).mockResolvedValue({
      id: 'lead-1',
      contactKey: 'email:lead@example.com',
    });
    (prisma.websitePopupContato.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'contact-1',
        popupId: 'popup-1',
        popupNome: 'Popup legado',
        usuarioId: null,
        contactKey: 'email:lead@example.com',
        nome: 'Lead Teste',
        email: 'lead@example.com',
        telefone: null,
        whatsapp: null,
        tag: 'ebook',
        payload: { curso: 'Excel' },
        origemPath: '/lp-excel',
        userAgent: 'Mozilla',
        ipHash: 'hashed-ip',
        removidoEm: null,
        criadoEm: new Date('2026-06-20T10:00:00.000Z'),
        WebsitePopup: {
          id: 'popup-1',
          nome: 'Popup Excel',
        },
      },
    ]);
    (prisma.auditoriaLogs.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'audit-1',
        categoria: 'USUARIO',
        tipo: 'LEAD_STATUS_ALTERADO',
        acao: 'Status alterado',
        descricao: 'Status do lead alterado para Qualificado',
        dadosAnteriores: { status: 'NOVO', statusLabel: 'Novo' },
        dadosNovos: { status: 'QUALIFICADO', statusLabel: 'Qualificado' },
        metadata: { field: 'status' },
        criadoEm: new Date('2026-06-21T12:00:00.000Z'),
        Usuarios: {
          id: 'user-1',
          nomeCompleto: 'Filipe Admin',
          email: 'filipe@advance.com',
          role: 'ADMIN',
        },
      },
    ]);

    const result = await websitePopupsService.getContactActivity('lead-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'audit-1',
      tipo: 'LEAD_STATUS_ALTERADO',
      ator: {
        nome: 'Filipe Admin',
      },
    });
    expect(result[1]).toMatchObject({
      id: 'capture:contact-1',
      tipo: 'LEAD_CAPTURADO',
      contexto: {
        popupNome: 'Popup Excel',
        origemPath: '/lp-excel',
      },
    });
  });
});

describe('websitePopupsService.updateContactNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes an audit log when editing a note', async () => {
    (prisma.websitePopupLead.findFirst as jest.Mock).mockResolvedValue({ id: 'lead-1' });
    (prisma.websitePopupLeadNote.findFirst as jest.Mock).mockResolvedValue({
      id: 'note-1',
      conteudo: 'Texto antigo',
    });
    (prisma.websitePopupLeadNote.update as jest.Mock).mockResolvedValue({
      id: 'note-1',
      conteudo: 'Texto novo',
      criadoEm: new Date('2026-06-20T10:00:00.000Z'),
      atualizadoEm: new Date('2026-06-21T12:00:00.000Z'),
      Autor: null,
    });
    (prisma.auditoriaLogs.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });

    await websitePopupsService.updateContactNote(
      'lead-1',
      'note-1',
      { conteudo: 'Texto novo' },
      { userId: 'user-1', ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(prisma.auditoriaLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: 'LEAD_NOTA_EDITADA',
          acao: 'Nota editada',
          usuarioId: 'user-1',
          entidadeId: 'lead-1',
          entidadeTipo: 'WEBSITE_POPUP_LEAD',
        }),
      }),
    );
  });
});

describe('websitePopupsService.removeContactInterest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks deletion of automatic interests', async () => {
    (prisma.websitePopupLead.findFirst as jest.Mock).mockResolvedValue({ id: 'lead-1' });
    (prisma.websitePopupLeadInterest.findFirst as jest.Mock).mockResolvedValue({
      id: 'interest-1',
      source: 'AUTO',
    });

    await expect(
      websitePopupsService.removeContactInterest('lead-1', 'interest-1'),
    ).rejects.toMatchObject({
      message: 'Interesses automáticos não podem ser removidos manualmente',
      statusCode: 400,
    });

    expect(prisma.websitePopupLeadInterest.delete).not.toHaveBeenCalled();
  });
});

jest.mock('@/modules/website/services/popups.service', () => ({
  websitePopupsService: {
    create: jest.fn(),
    get: jest.fn(),
    getContactActivity: jest.fn(),
    update: jest.fn(),
  },
}));

import type { Request, Response } from 'express';

import { WebsitePopupsController } from '../controllers/popups.controller';
import { websitePopupsService } from '@/modules/website/services/popups.service';

const makeResponse = () =>
  ({
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as Response;

const createPayload = {
  nome: 'Popup sem formulario',
  status: 'PUBLICADO' as const,
  dispositivo: 'AMBOS' as const,
  escopo: 'WEBSITE' as const,
  posicaoDesktop: 'CENTRO' as const,
  posicaoMobile: 'CENTRO' as const,
  gatilho: 'ATRASO' as const,
  atrasoSegundos: 5,
  cronograma: 'EXIBIR_AGORA' as const,
  frequencia: 'UMA_VEZ_A_CADA_6_HORAS' as const,
  prioridade: 0,
  formFields: [],
  contentConfig: {
    titulo: 'Oferta',
    subtitulo: 'Gire e aproveite',
    botaoTexto: 'Girar',
    builderTree: {
      id: 'root-1',
      kind: 'ROOT',
      structure: 'SINGLE',
      areas: [
        {
          id: 'area-1',
          kind: 'AREA',
          children: [
            {
              id: 'roulette-1',
              kind: 'ATOMIC',
              type: 'ROULETTE',
              rouletteScope: 'COURSES',
              rouletteNoPrizeMessage: 'Tente novamente.',
              rouletteItems: [
                {
                  id: 'segment-1',
                  label: '15% OFF',
                  couponId: '550e8400-e29b-41d4-a716-446655440000',
                  weight: 60,
                },
                {
                  id: 'segment-2',
                  label: 'Sem prêmio',
                  isNoPrize: true,
                  weight: 40,
                },
              ],
            },
          ],
        },
      ],
    },
  },
  designConfig: {
    backgroundColor: '#ffffff',
    layout: 'IMAGEM_ESQUERDA' as const,
    imageDisposition: 'PREENCHER' as const,
    imagePosition: 'CENTRO' as const,
    imageProportion: '50' as const,
    showImageOnMobile: true,
  },
  subscriptionConfig: {
    email: 'DESCADASTRADOS_E_DESCONHECIDOS',
    whatsapp: 'QUALQUER_UM',
  },
  pageRules: {
    mode: 'ALL_PAGES' as const,
  },
};

describe('WebsitePopupsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite criar popup publicado sem campos de formulário', async () => {
    (websitePopupsService.create as jest.Mock).mockResolvedValue({
      id: 'popup-1',
      ...createPayload,
    });

    const req = {
      body: createPayload,
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsitePopupsController.create(req, res);

    expect(websitePopupsService.create).toHaveBeenCalledWith(
      {
        ...createPayload,
        redirectNovaAba: false,
      },
      'user-1',
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('permite atualizar popup publicado sem exigir campos de formulário', async () => {
    (websitePopupsService.get as jest.Mock).mockResolvedValue({
      id: 'popup-1',
      formFields: [],
    });
    (websitePopupsService.update as jest.Mock).mockResolvedValue({
      id: 'popup-1',
      ...createPayload,
    });

    const req = {
      params: { id: 'popup-1' },
      body: {
        status: 'PUBLICADO',
        formFields: [],
      },
      user: { id: 'user-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsitePopupsController.update(req, res);

    expect(websitePopupsService.get).toHaveBeenCalledWith('popup-1');
    expect(websitePopupsService.update).toHaveBeenCalledWith(
      'popup-1',
      {
        status: 'PUBLICADO',
        formFields: [],
      },
      'user-1',
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('retorna atividade consolidada do contato', async () => {
    (websitePopupsService.getContactActivity as jest.Mock).mockResolvedValue([
      {
        id: 'audit-1',
        tipo: 'LEAD_STATUS_ALTERADO',
      },
    ]);

    const req = {
      params: { id: 'lead-1' },
    } as unknown as Request;
    const res = makeResponse();

    await WebsitePopupsController.getContactActivity(req, res);

    expect(websitePopupsService.getContactActivity).toHaveBeenCalledWith('lead-1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 'audit-1', tipo: 'LEAD_STATUS_ALTERADO' }],
    });
  });
});

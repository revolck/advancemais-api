import { Request, Response } from 'express';
import { Roles } from '@prisma/client';

import { RecrutadorEntrevistasController } from '../controllers/entrevistas.controller';
import { entrevistasManageService } from '@/modules/entrevistas/services/manage.service';
import { entrevistasOverviewService } from '@/modules/entrevistas/services/overview.service';

jest.mock('@/modules/entrevistas/services/manage.service', () => ({
  entrevistasManageService: {
    listEmpresas: jest.fn(),
    listVagas: jest.fn(),
    listCandidatos: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@/modules/entrevistas/services/overview.service', () => ({
  entrevistasOverviewService: {
    list: jest.fn(),
  },
}));

describe('RecrutadorEntrevistasController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      user: {
        id: '2d8a8ff0-0d46-4478-a55c-fc0e3e232df4',
        role: Roles.RECRUTADOR,
      } as any,
      query: {},
      body: {},
    };

    res = {
      json: jsonMock,
      status: statusMock,
    };

    jest.clearAllMocks();
  });

  it('calcula capabilities reais no overview do recrutador', async () => {
    (entrevistasOverviewService.list as jest.Mock).mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
      summary: {
        totalEntrevistas: 0,
        agendadas: 0,
        confirmadas: 0,
        realizadas: 0,
        canceladas: 0,
        naoCompareceram: 0,
      },
      filtrosDisponiveis: {
        statusEntrevista: [],
        modalidades: [],
      },
      capabilities: {
        canCreate: false,
        canCreateOnline: false,
        canCreatePresencial: false,
        requiresGoogleForOnline: true,
        google: {
          connected: false,
          expired: false,
          calendarId: null,
          expiraEm: null,
          connectEndpoint: '/api/v1/auth/google/connect',
        },
      },
    });
    (entrevistasManageService.listEmpresas as jest.Mock).mockResolvedValue({
      items: [{ id: '7f5d0d66-35e5-468e-9241-0869b37a3eb8' }],
    });

    await RecrutadorEntrevistasController.listOverview(req as Request, res as Response);

    expect(entrevistasOverviewService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        viewerId: '2d8a8ff0-0d46-4478-a55c-fc0e3e232df4',
        viewerRole: Roles.RECRUTADOR,
        pageSize: 10,
      }),
    );
    expect(entrevistasManageService.listEmpresas).toHaveBeenCalledWith({
      viewerId: '2d8a8ff0-0d46-4478-a55c-fc0e3e232df4',
      viewerRole: Roles.RECRUTADOR,
    });
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        capabilities: expect.objectContaining({
          canCreate: true,
          canCreateOnline: false,
          canCreatePresencial: true,
          requiresGoogleForOnline: true,
        }),
      }),
    });
  });

  it('lista vagas elegíveis do dashboard no escopo do recrutador', async () => {
    req.query = {
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
    };

    (entrevistasManageService.listVagas as jest.Mock).mockResolvedValue({
      items: [
        {
          id: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
          titulo: 'Vaga Escopada',
        },
      ],
    });

    await RecrutadorEntrevistasController.listCreateVagas(req as Request, res as Response);

    expect(entrevistasManageService.listVagas).toHaveBeenCalledWith({
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
      viewerId: '2d8a8ff0-0d46-4478-a55c-fc0e3e232df4',
      viewerRole: Roles.RECRUTADOR,
    });
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [
          {
            id: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
            titulo: 'Vaga Escopada',
          },
        ],
      },
    });
  });

  it('cria entrevista do dashboard do recrutador com viewerRole escopado', async () => {
    req.body = {
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
      vagaId: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
      candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
      empresaAnonima: false,
      modalidade: 'PRESENCIAL',
      dataInicio: '2026-04-10T14:00:00.000Z',
      dataFim: '2026-04-10T15:00:00.000Z',
      enderecoPresencial: {
        cep: '57084-028',
        logradouro: 'Rua Manoel Pedro de Oliveira',
        numero: '245',
        bairro: 'Benedito Bentes',
        cidade: 'Maceió',
        estado: 'AL',
      },
    };

    (entrevistasManageService.create as jest.Mock).mockResolvedValue({
      id: '86ba314f-feb3-43b9-a4f0-93a6590e4954',
      candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
      modalidade: 'PRESENCIAL',
    });

    await RecrutadorEntrevistasController.createOverviewInterview(req as Request, res as Response);

    expect(entrevistasManageService.create).toHaveBeenCalledWith({
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
      vagaId: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
      candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
      empresaAnonima: false,
      modalidade: 'PRESENCIAL',
      dataInicio: '2026-04-10T14:00:00.000Z',
      dataFim: '2026-04-10T15:00:00.000Z',
      enderecoPresencial: {
        cep: '57084-028',
        logradouro: 'Rua Manoel Pedro de Oliveira',
        numero: '245',
        bairro: 'Benedito Bentes',
        cidade: 'Maceió',
        estado: 'AL',
      },
      viewerId: '2d8a8ff0-0d46-4478-a55c-fc0e3e232df4',
      viewerRole: Roles.RECRUTADOR,
    });
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        id: '86ba314f-feb3-43b9-a4f0-93a6590e4954',
        candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
        modalidade: 'PRESENCIAL',
      },
    });
  });

  it('mapeia conflito de escopo na criação do dashboard do recrutador', async () => {
    req.body = {
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
      vagaId: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
      candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
      modalidade: 'PRESENCIAL',
      dataInicio: '2026-04-10T14:00:00.000Z',
      dataFim: '2026-04-10T15:00:00.000Z',
      enderecoPresencial: {
        cep: '57084-028',
        logradouro: 'Rua Manoel Pedro de Oliveira',
        numero: '245',
        bairro: 'Benedito Bentes',
        cidade: 'Maceió',
        estado: 'AL',
      },
    };

    (entrevistasManageService.create as jest.Mock).mockRejectedValue({
      status: 409,
      code: 'RECRUITER_SCOPE_CONFLICT',
      message:
        'A candidatura informada não pertence à vaga e empresa selecionadas no escopo do recrutador.',
    });

    await RecrutadorEntrevistasController.createOverviewInterview(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      code: 'RECRUITER_SCOPE_CONFLICT',
      message:
        'A candidatura informada não pertence à vaga e empresa selecionadas no escopo do recrutador.',
    });
  });

  it('mapeia erro de escopo na criação do dashboard do recrutador', async () => {
    req.body = {
      empresaUsuarioId: 'b7b027c4-6fdb-4537-8d42-1f0445c3aadb',
      vagaId: '5c0b6f69-0175-4d79-b638-928bc8d7be3e',
      candidaturaId: '5d307f6e-f3d8-4f8f-b4ec-fb2833678ca2',
      modalidade: 'PRESENCIAL',
      dataInicio: '2026-04-10T14:00:00.000Z',
      dataFim: '2026-04-10T15:00:00.000Z',
      enderecoPresencial: {
        cep: '57084-028',
        logradouro: 'Rua Manoel Pedro de Oliveira',
        numero: '245',
        bairro: 'Benedito Bentes',
        cidade: 'Maceió',
        estado: 'AL',
      },
    };

    (entrevistasManageService.create as jest.Mock).mockRejectedValue({
      status: 403,
    });

    await RecrutadorEntrevistasController.createOverviewInterview(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      code: 'FORBIDDEN',
      message: 'Você não possui acesso para criar entrevista nesta candidatura.',
    });
  });
});

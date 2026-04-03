import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { entrevistasManageController } from '../controllers/manage.controller';
import { entrevistasManageService } from '../services/manage.service';

jest.mock('../services/manage.service', () => ({
  entrevistasManageService: {
    listEmpresas: jest.fn(),
    listVagas: jest.fn(),
    listCandidatos: jest.fn(),
    create: jest.fn(),
  },
}));

describe('entrevistasManageController.listEmpresas', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      user: {
        id: 'viewer-id',
        role: Roles.SETOR_DE_VAGAS,
      } as any,
    };

    res = {
      status: statusMock,
      json: jsonMock,
    };

    jest.clearAllMocks();
  });

  it('retorna 200 com as empresas elegíveis', async () => {
    (entrevistasManageService.listEmpresas as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'empresa-1',
          nomeExibicao: 'Empresa Teste',
        },
      ],
    });

    await entrevistasManageController.listEmpresas(req as Request, res as Response);

    expect(entrevistasManageService.listEmpresas).toHaveBeenCalledWith({
      viewerId: 'viewer-id',
      viewerRole: Roles.SETOR_DE_VAGAS,
    });
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [
          {
            id: 'empresa-1',
            nomeExibicao: 'Empresa Teste',
          },
        ],
      },
    });
  });

  it('retorna 503 com mensagem diagnóstica para P1001', async () => {
    const connectionError = new PrismaClientKnownRequestError("Can't reach database server", {
      code: 'P1001',
      clientVersion: '6.19.0',
    });

    (entrevistasManageService.listEmpresas as jest.Mock).mockRejectedValue(connectionError);

    await entrevistasManageController.listEmpresas(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
    });
  });

  it('retorna 503 com mensagem diagnóstica para P2024', async () => {
    const timeoutError = new PrismaClientKnownRequestError('Timed out', {
      code: 'P2024',
      clientVersion: '6.19.0',
    });

    (entrevistasManageService.listEmpresas as jest.Mock).mockRejectedValue(timeoutError);

    await entrevistasManageController.listEmpresas(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
    });
  });
});

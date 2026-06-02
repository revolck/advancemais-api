import { StatusDeVagas } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Roles } from '@/modules/usuarios/enums/Roles';
import { VagasController } from '../controllers/vagas.controller';
import { vagasService } from '../services/vagas.service';

jest.mock('../services/vagas.service', () => ({
  vagasService: {
    get: jest.fn(),
    getForInternalViewer: jest.fn(),
  },
}));

const mockedVagasService = vagasService as jest.Mocked<typeof vagasService>;

const createResponse = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }) as any;

const createRequest = (user?: { id: string; role: Roles }) =>
  ({
    params: { id: '17d4c8e8-fccb-4170-9559-70146bef5df1' },
    user,
  }) as any;

describe('VagasController.get', () => {
  const vaga = { id: '17d4c8e8-fccb-4170-9559-70146bef5df1', status: StatusDeVagas.EXPIRADO };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mantém público limitado a vagas publicadas', async () => {
    mockedVagasService.get.mockResolvedValue(null as any);
    const res = createResponse();

    await VagasController.get(createRequest(), res);

    expect(mockedVagasService.get).toHaveBeenCalledWith(vaga.id);
    expect(mockedVagasService.getForInternalViewer).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'VAGA_NOT_FOUND',
      message: 'Vaga não encontrada',
    });
  });

  it.each([Roles.ADMIN, Roles.MODERADOR])(
    'permite %s consultar vaga expirada por fluxo interno',
    async (role) => {
      mockedVagasService.getForInternalViewer.mockResolvedValue(vaga as any);
      const res = createResponse();

      await VagasController.get(createRequest({ id: 'admin-user-id', role }), res);

      expect(mockedVagasService.getForInternalViewer).toHaveBeenCalledWith({ id: vaga.id });
      expect(mockedVagasService.get).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(vaga);
    },
  );

  it('permite SETOR_DE_VAGAS consultar vaga expirada, mas não rascunho', async () => {
    mockedVagasService.getForInternalViewer.mockResolvedValue(vaga as any);
    const res = createResponse();

    await VagasController.get(
      createRequest({ id: 'setor-vagas-user-id', role: Roles.SETOR_DE_VAGAS }),
      res,
    );

    expect(mockedVagasService.getForInternalViewer).toHaveBeenCalledWith({
      id: vaga.id,
      status: [
        StatusDeVagas.EM_ANALISE,
        StatusDeVagas.PUBLICADO,
        StatusDeVagas.EXPIRADO,
        StatusDeVagas.DESPUBLICADA,
        StatusDeVagas.PAUSADA,
        StatusDeVagas.ENCERRADA,
      ],
    });
    expect(res.json).toHaveBeenCalledWith(vaga);
  });

  it('permite EMPRESA consultar apenas vaga própria', async () => {
    mockedVagasService.getForInternalViewer.mockResolvedValue(vaga as any);
    const res = createResponse();

    await VagasController.get(createRequest({ id: 'empresa-user-id', role: Roles.EMPRESA }), res);

    expect(mockedVagasService.getForInternalViewer).toHaveBeenCalledWith({
      id: vaga.id,
      usuarioIds: ['empresa-user-id'],
    });
    expect(res.json).toHaveBeenCalledWith(vaga);
  });

  it('retorna 404 quando EMPRESA não é dona da vaga', async () => {
    mockedVagasService.getForInternalViewer.mockResolvedValue(null as any);
    const res = createResponse();

    await VagasController.get(createRequest({ id: 'outra-empresa-id', role: Roles.EMPRESA }), res);

    expect(mockedVagasService.getForInternalViewer).toHaveBeenCalledWith({
      id: vaga.id,
      usuarioIds: ['outra-empresa-id'],
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

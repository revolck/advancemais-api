import { Request, Response } from 'express';

jest.mock('../services/admin-empresas.service');
jest.mock('@/modules/empresas/vagas-solicitacoes/services/solicitacoes.service');

import { LimiteVagasPlanoAtingidoError } from '@/modules/empresas/vagas/services/errors';
import { SolicitacoesController } from '@/modules/empresas/vagas-solicitacoes/controllers/solicitacoes.controller';
import { solicitacoesService } from '@/modules/empresas/vagas-solicitacoes/services/solicitacoes.service';
import { AdminEmpresasController } from '../controllers/admin-empresas.controller';
import { adminEmpresasService } from '../services/admin-empresas.service';

const ID = '7d3c1f4e-1111-4a2b-9c3d-000000000001';
const VAGA = '7d3c1f4e-1111-4a2b-9c3d-000000000002';

function resposta() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

describe('aprovação acima do limite do plano', () => {
  it('admin de empresas: 409 com mensagem clara (antes era erro 500)', async () => {
    (adminEmpresasService.approveVaga as jest.Mock).mockRejectedValue(
      new LimiteVagasPlanoAtingidoError(3),
    );
    const { res, status, json } = resposta();
    await AdminEmpresasController.approveVaga({ params: { id: ID, vagaId: VAGA } } as any, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PLANO_EMPRESARIAL_LIMIT_VAGAS',
        limite: 3,
        message: expect.stringContaining('3 vagas publicadas'),
      }),
    );
  });

  it('solicitações (setor de vagas): mesma resposta', async () => {
    (solicitacoesService.aprovar as jest.Mock).mockRejectedValue(
      new LimiteVagasPlanoAtingidoError(1),
    );
    const { res, status, json } = resposta();
    await SolicitacoesController.aprovar(
      { params: { id: VAGA }, body: {}, user: { id: ID } } as unknown as Request,
      res,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('1 vaga publicada,') }),
    );
  });
});

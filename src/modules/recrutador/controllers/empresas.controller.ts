import type { Request, Response } from 'express';
import { StatusDeVagas } from '@prisma/client';

import { vagasService } from '@/modules/empresas/vagas/services/vagas.service';
import {
  RecrutadorEmpresaNotFoundError,
  RecrutadorEmpresasForbiddenError,
  recrutadorEmpresasService,
} from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

const DEFAULT_RECRUITER_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
];

export class RecrutadorEmpresasController {
  static list = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const empresas = await recrutadorEmpresasService.listForDashboard(recruiterId);
      return res.json({ success: true, data: empresas });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao listar empresas do recrutador.',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { empresaUsuarioId } = req.params;
      const scopedEmpresa = await recrutadorEmpresasService.getForDashboard(
        recruiterId,
        empresaUsuarioId,
      );

      const vagaIds = await recrutadorVagasService.listVagaIdsByEmpresa(
        recruiterId,
        empresaUsuarioId,
      );
      const vagas =
        vagaIds.length === 0
          ? []
          : await vagasService.list({
              ids: vagaIds,
              status: DEFAULT_RECRUITER_STATUSES,
            });

      return res.json({
        success: true,
        data: {
          empresa: scopedEmpresa.empresa,
          escopo: {
            tipoAcesso: scopedEmpresa.possuiVinculoEmpresa ? 'EMPRESA' : 'VAGA',
            empresaVinculadaDiretamente: scopedEmpresa.possuiVinculoEmpresa,
            totalVagasNoEscopo: vagas.length,
          },
          vagas,
        },
      });
    } catch (error: any) {
      if (error instanceof RecrutadorEmpresaNotFoundError || error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada.',
        });
      }

      if (error instanceof RecrutadorEmpresasForbiddenError || error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a esta empresa.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao carregar a empresa do recrutador.',
        error: error?.message,
      });
    }
  };
}

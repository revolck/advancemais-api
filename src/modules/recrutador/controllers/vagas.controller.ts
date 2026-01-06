import type { Request, Response } from 'express';
import { StatusDeVagas } from '@prisma/client';
import { vagasService } from '@/modules/empresas/vagas/services/vagas.service';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

const VALID_STATUSES = new Set<StatusDeVagas>([
  StatusDeVagas.RASCUNHO,
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
]);

const DEFAULT_RECRUITER_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
];

const normalizeStatusInput = (input: string | string[] | undefined): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) =>
      item
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
  }
  return input
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
};

const parseStatusFilter = (raw?: string | string[]): StatusDeVagas[] => {
  const normalized = normalizeStatusInput(raw);
  if (normalized.length === 0) return DEFAULT_RECRUITER_STATUSES;

  if (normalized.some((s) => s === 'ALL' || s === 'TODAS' || s === 'TODOS')) {
    return DEFAULT_RECRUITER_STATUSES;
  }

  const chosen = normalized
    .filter((s): s is StatusDeVagas => VALID_STATUSES.has(s as StatusDeVagas))
    .map((s) => s as StatusDeVagas);

  if (chosen.includes(StatusDeVagas.RASCUNHO)) {
    throw Object.assign(new Error('Recrutador não pode consultar vagas em RASCUNHO'), {
      status: 403,
      code: 'RECRUTADOR_RASCUNHO_FORBIDDEN',
    });
  }

  return chosen.length > 0 ? chosen : DEFAULT_RECRUITER_STATUSES;
};

export class RecrutadorVagasController {
  static list = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const empresaUsuarioId =
        typeof req.query.empresaUsuarioId === 'string' ? req.query.empresaUsuarioId : undefined;

      const status = parseStatusFilter(req.query.status as any);

      let vagaIds: string[];

      if (empresaUsuarioId) {
        await recrutadorEmpresasService.assertVinculo(recruiterId, empresaUsuarioId);
        vagaIds = await recrutadorVagasService.listVagaIdsByEmpresa(recruiterId, empresaUsuarioId);
      } else {
        vagaIds = await recrutadorVagasService.listVagaIds(recruiterId);
      }

      if (vagaIds.length === 0) {
        return res.json([]);
      }

      const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) : undefined;
      const pageSize =
        typeof req.query.pageSize === 'string' ? parseInt(req.query.pageSize, 10) : undefined;

      const vagas = await vagasService.list({
        ids: vagaIds,
        status,
        page: page ? Math.max(1, page) : undefined,
        pageSize: pageSize ? Math.max(1, Math.min(100, pageSize)) : undefined,
      });

      return res.json(vagas);
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: error?.code ?? 'FORBIDDEN',
          message: error?.message ?? 'Acesso negado',
        });
      }
      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_VAGAS_LIST_ERROR',
        message: 'Erro ao listar vagas do recrutador',
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

      const { id } = req.params;
      await recrutadorVagasService.assertVinculo(recruiterId, id);

      const vaga = await vagasService.getForInternalViewer({
        id,
        status: DEFAULT_RECRUITER_STATUSES,
      });

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      return res.json(vaga);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'RECRUTADOR_VAGAS_GET_ERROR',
        message: 'Erro ao buscar vaga',
        error: error?.message,
      });
    }
  };
}

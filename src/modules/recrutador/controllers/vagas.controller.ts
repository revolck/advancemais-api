import type { Request, Response } from 'express';
import { StatusDeVagas } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/config/prisma';
import { vagasService } from '@/modules/empresas/vagas/services/vagas.service';
import {
  RecrutadorEmpresaNotFoundError,
  RecrutadorEmpresasForbiddenError,
} from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { recrutadorVagasDashboardService } from '../services/vagas.service';
import {
  recrutadorAtualizarCandidaturaStatusBodySchema,
  recrutadorVagaCandidaturaStatusParamSchema,
  recrutadorVagaCandidatosQuerySchema,
  recrutadorVagaIdParamSchema,
  recrutadorVagasListQuerySchema,
} from '../validators/vagas.schema';
import {
  RecrutadorVagaCandidaturaConflictError,
  RecrutadorVagaCandidaturaNotFoundError,
  RecrutadorVagaCandidatesNotFoundError,
  RecrutadorVagaCandidatosForbiddenError,
  RecrutadorVagaStatusNotFoundError,
  recrutadorVagaCandidatosService,
} from '../services/vaga-candidatos.service';

const DEFAULT_RECRUITER_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
];

export class RecrutadorVagasController {
  static list = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const query = recrutadorVagasListQuerySchema.parse(req.query);
      const vagas = await recrutadorVagasDashboardService.list(recruiterId, query);

      return res.json({
        success: true,
        data: vagas.data,
        pagination: vagas.pagination,
        filtrosDisponiveis: vagas.filtrosDisponiveis,
      });
    } catch (error: any) {
      const empresaUsuarioId =
        typeof req.query.empresaUsuarioId === 'string' ? req.query.empresaUsuarioId : undefined;

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar vagas do recrutador.',
          issues: error.flatten().fieldErrors,
        });
      }

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
          message: empresaUsuarioId
            ? 'Você não possui acesso a esta empresa.'
            : 'Você não possui acesso a estas vagas.',
        });
      }
      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao listar vagas do recrutador.',
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
      const vagaExists = await prisma.empresasVagas.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!vagaExists || vagaExists.status === StatusDeVagas.RASCUNHO) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada.',
        });
      }

      await recrutadorVagasService.assertVinculo(recruiterId, id);

      const vaga = await vagasService.getForInternalViewer({
        id,
        status: DEFAULT_RECRUITER_STATUSES,
      });

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada.',
        });
      }

      return res.json({ success: true, data: vaga });
    } catch (error: any) {
      if (error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a esta vaga.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao buscar vaga do recrutador.',
        error: error?.message,
      });
    }
  };

  static listCandidates = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { vagaId } = recrutadorVagaIdParamSchema.parse(req.params);
      const query = recrutadorVagaCandidatosQuerySchema.parse(req.query);
      const result = await recrutadorVagaCandidatosService.list(recruiterId, vagaId, query);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar candidatos da vaga do recrutador.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error instanceof RecrutadorVagaCandidatesNotFoundError ||
        error?.code === 'VAGA_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada.',
        });
      }

      if (error instanceof RecrutadorVagaCandidatosForbiddenError || error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso aos candidatos desta vaga.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao listar candidatos da vaga do recrutador.',
        error: error?.message,
      });
    }
  };

  static updateCandidateStatus = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { vagaId, candidaturaId } = recrutadorVagaCandidaturaStatusParamSchema.parse(
        req.params,
      );
      const { statusId } = recrutadorAtualizarCandidaturaStatusBodySchema.parse(req.body);

      const result = await recrutadorVagaCandidatosService.updateStatus({
        recrutadorId: recruiterId,
        vagaId,
        candidaturaId,
        statusId,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para atualizar o status da candidatura.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error instanceof RecrutadorVagaCandidatesNotFoundError ||
        error?.code === 'VAGA_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada.',
        });
      }

      if (
        error instanceof RecrutadorVagaCandidaturaNotFoundError ||
        error?.code === 'CANDIDATURA_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: 'CANDIDATURA_NOT_FOUND',
          message: 'Candidatura não encontrada.',
        });
      }

      if (
        error instanceof RecrutadorVagaStatusNotFoundError ||
        error?.code === 'STATUS_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: 'STATUS_NOT_FOUND',
          message: 'Status não encontrado.',
        });
      }

      if (error instanceof RecrutadorVagaCandidaturaConflictError || error?.status === 409) {
        return res.status(409).json({
          success: false,
          code: 'RECRUITER_SCOPE_CONFLICT',
          message:
            error?.message ??
            'A candidatura informada não corresponde à vaga selecionada no escopo do recrutador.',
        });
      }

      if (error instanceof RecrutadorVagaCandidatosForbiddenError || error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso para alterar o status desta candidatura.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_CANDIDATURA_STATUS_ERROR',
        message: 'Erro ao atualizar o status da candidatura da vaga do recrutador.',
        error: error?.message,
      });
    }
  };
}

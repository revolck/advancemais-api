import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  RecrutadorCandidatoForbiddenError,
  RecrutadorCandidatoNotFoundError,
  RecrutadorCurriculoNotFoundError,
  RecrutadorVagaNotFoundError,
  recrutadorCandidatosService,
} from '../services/candidatos.service';
import {
  recrutadorCandidatoIdParamSchema,
  recrutadorCandidatoCurriculoParamSchema,
  recrutadorCandidatosListQuerySchema,
} from '../validators/candidatos.schema';
import {
  RecrutadorEmpresaNotFoundError,
  RecrutadorEmpresasForbiddenError,
} from '@/modules/usuarios/services/recrutador-empresas.service';

export class RecrutadorCandidatosController {
  static list = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const query = recrutadorCandidatosListQuerySchema.parse(req.query);
      const result = await recrutadorCandidatosService.list(recruiterId, query);

      return res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar candidatos do recrutador.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error instanceof RecrutadorEmpresaNotFoundError ||
        error instanceof RecrutadorVagaNotFoundError
      ) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (
        error instanceof RecrutadorEmpresasForbiddenError ||
        error instanceof RecrutadorCandidatoForbiddenError ||
        error?.status === 403
      ) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: error?.message ?? 'Você não possui acesso a estes candidatos.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao listar candidatos do recrutador.',
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

      const { candidatoId } = recrutadorCandidatoIdParamSchema.parse(req.params);
      const result = await recrutadorCandidatosService.get(recruiterId, candidatoId);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para buscar candidato do recrutador.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof RecrutadorCandidatoNotFoundError) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof RecrutadorCandidatoForbiddenError || error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este candidato.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao buscar candidato do recrutador.',
        error: error?.message,
      });
    }
  };

  static getCurriculo = async (req: Request, res: Response) => {
    try {
      const recruiterId = (req as any).user?.id as string | undefined;
      if (!recruiterId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const { candidatoId, curriculoId } = recrutadorCandidatoCurriculoParamSchema.parse(
        req.params,
      );
      const result = await recrutadorCandidatosService.getCurriculo(
        recruiterId,
        candidatoId,
        curriculoId,
      );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para buscar currículo do recrutador.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error instanceof RecrutadorCandidatoNotFoundError ||
        error instanceof RecrutadorCurriculoNotFoundError
      ) {
        return res.status(404).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof RecrutadorCandidatoForbiddenError || error?.status === 403) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Você não possui acesso a este currículo.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'RECRUITER_SCOPE_ERROR',
        message: 'Erro ao buscar currículo do recrutador.',
        error: error?.message,
      });
    }
  };
}

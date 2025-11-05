import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  createVagaProcessoSchema,
  updateVagaProcessoSchema,
  vagaProcessoDetailParamsSchema,
  vagaProcessoListQuerySchema,
  vagaProcessoParamsSchema,
} from '@/modules/empresas/vagas-processos/validators/vagas-processos.schema';
import {
  VagaProcessoCandidatoInvalidoError,
  VagaProcessoCandidatoNaoEncontradoError,
  VagaProcessoDuplicadoError,
  VagaProcessoNaoEncontradoError,
  VagaProcessoVagaNaoEncontradaError,
} from '@/modules/empresas/vagas-processos/services/errors';
import { vagasProcessosService } from '@/modules/empresas/vagas-processos/services/vagas-processos.service';

const buildErrorResponse = (res: Response, error: Error & { status?: number; code?: string }) =>
  res.status(error.status ?? 500).json({
    success: false,
    code: error.code ?? 'VAGA_PROCESSO_ERROR',
    message: error.message,
  });

export class VagasProcessosController {
  static list = async (req: Request, res: Response) => {
    try {
      const { vagaId } = vagaProcessoParamsSchema.parse(req.params);
      const query = vagaProcessoListQuerySchema.parse({
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        origem: typeof req.query.origem === 'string' ? req.query.origem : undefined,
        candidatoId: typeof req.query.candidatoId === 'string' ? req.query.candidatoId : undefined,
      });

      const processos = await vagasProcessosService.list(
        vagaId,
        query?.status
          ? { ...query, statusIds: query.status, status: undefined as any }
          : (query as any),
      );

      res.json({
        message: 'Lista de processos seletivos vinculados à vaga.',
        vagaId,
        total: processos.length,
        processos,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar os processos seletivos da vaga.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof VagaProcessoVagaNaoEncontradaError) {
        return buildErrorResponse(res, error);
      }

      res.status(500).json({
        success: false,
        code: 'VAGA_PROCESSO_LIST_ERROR',
        message: 'Erro ao listar os processos seletivos da vaga.',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { vagaId, processoId } = vagaProcessoDetailParamsSchema.parse({
        vagaId: req.params.vagaId,
        processoId: req.params.processoId,
      });

      const processo = await vagasProcessosService.get(vagaId, processoId);

      res.json({
        message: 'Processo seletivo recuperado com sucesso.',
        processo,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para consulta do processo seletivo.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof VagaProcessoNaoEncontradoError) {
        return buildErrorResponse(res, error);
      }

      res.status(500).json({
        success: false,
        code: 'VAGA_PROCESSO_GET_ERROR',
        message: 'Erro ao buscar o processo seletivo da vaga.',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const { vagaId } = vagaProcessoParamsSchema.parse(req.params);
      const payload = createVagaProcessoSchema.parse(req.body);

      const processo = await vagasProcessosService.create(vagaId, payload);

      res.status(201).json({
        message: 'Processo seletivo criado com sucesso.',
        processo,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do processo seletivo.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (
        error instanceof VagaProcessoVagaNaoEncontradaError ||
        error instanceof VagaProcessoCandidatoNaoEncontradoError ||
        error instanceof VagaProcessoCandidatoInvalidoError ||
        error instanceof VagaProcessoDuplicadoError
      ) {
        return buildErrorResponse(res, error);
      }

      res.status(500).json({
        success: false,
        code: 'VAGA_PROCESSO_CREATE_ERROR',
        message: 'Erro ao cadastrar o processo seletivo da vaga.',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { vagaId, processoId } = vagaProcessoDetailParamsSchema.parse({
        vagaId: req.params.vagaId,
        processoId: req.params.processoId,
      });
      const payload = updateVagaProcessoSchema.parse(req.body);

      const processo = await vagasProcessosService.update(vagaId, processoId, payload);

      res.json({
        message: 'Processo seletivo atualizado com sucesso.',
        processo,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do processo seletivo.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof VagaProcessoNaoEncontradoError) {
        return buildErrorResponse(res, error);
      }

      res.status(500).json({
        success: false,
        code: 'VAGA_PROCESSO_UPDATE_ERROR',
        message: 'Erro ao atualizar o processo seletivo da vaga.',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { vagaId, processoId } = vagaProcessoDetailParamsSchema.parse({
        vagaId: req.params.vagaId,
        processoId: req.params.processoId,
      });

      await vagasProcessosService.remove(vagaId, processoId);

      res.status(204).send();
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para remover o processo seletivo.',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof VagaProcessoNaoEncontradoError) {
        return buildErrorResponse(res, error);
      }

      res.status(500).json({
        success: false,
        code: 'VAGA_PROCESSO_DELETE_ERROR',
        message: 'Erro ao remover o processo seletivo da vaga.',
        error: error?.message,
      });
    }
  };
}

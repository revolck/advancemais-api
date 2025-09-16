import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { vagasService } from '@/modules/empresas/vagas/services/vagas.service';
import {
  EmpresaSemPlanoAtivoError,
  LimiteVagasPlanoAtingidoError,
} from '@/modules/empresas/vagas/services/errors';
import { createVagaSchema, updateVagaSchema } from '@/modules/empresas/vagas/validators/vagas.schema';

export class VagasController {
  static list = async (_req: Request, res: Response) => {
    try {
      const vagas = await vagasService.list();
      res.json(vagas);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_LIST_ERROR',
        message: 'Erro ao listar vagas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const vaga = await vagasService.get(id);

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.json(vaga);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'VAGAS_GET_ERROR',
        message: 'Erro ao buscar vaga',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createVagaSchema.parse(req.body);
      const vaga = await vagasService.create(data);
      res.status(201).json(vaga);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada para vincular à vaga',
        });
      }

      if (error instanceof EmpresaSemPlanoAtivoError) {
        return res.status(403).json({
          success: false,
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof LimiteVagasPlanoAtingidoError) {
        return res.status(409).json({
          success: false,
          code: error.code,
          message: error.message,
          limite: error.limite,
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_CREATE_ERROR',
        message: 'Erro ao criar vaga',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payload = updateVagaSchema.parse(req.body);

      const hasUpdates = Object.values(payload).some((value) => value !== undefined);
      if (!hasUpdates) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização da vaga',
        });
      }

      const vaga = await vagasService.update(id, payload);
      res.json(vaga);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização da vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada para vincular à vaga',
        });
      }

      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_UPDATE_ERROR',
        message: 'Erro ao atualizar vaga',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await vagasService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'VAGAS_DELETE_ERROR',
        message: 'Erro ao remover vaga',
        error: error?.message,
      });
    }
  };
}

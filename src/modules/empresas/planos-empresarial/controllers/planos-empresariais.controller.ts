import { Request, Response } from 'express';
import { ZodError } from 'zod';

import {
  MAX_PLANOS_EMPRESARIAIS,
  PlanosEmpresariaisLimitError,
  planosEmpresariaisService,
} from '@/modules/empresas/planos-empresarial/services/planos-empresariais.service';
import {
  createPlanosEmpresariaisSchema,
  updatePlanosEmpresariaisSchema,
} from '@/modules/empresas/planos-empresarial/validators/planos-empresariais.schema';

export class PlanosEmpresariaisController {
  static list = async (_req: Request, res: Response) => {
    try {
      const planos = await planosEmpresariaisService.list();
      res.json(planos);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PLANOS_EMPRESARIAIS_LIST_ERROR',
        message: 'Erro ao listar planos empresariais',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const plano = await planosEmpresariaisService.get(id);

      if (!plano) {
        return res.status(404).json({
          success: false,
          code: 'PLANOS_EMPRESARIAIS_NOT_FOUND',
          message: 'Plano empresarial não encontrado',
        });
      }

      res.json(plano);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PLANOS_EMPRESARIAIS_GET_ERROR',
        message: 'Erro ao buscar plano empresarial',
        error: error?.message,
      });
    }
  };

  static create = async (req: Request, res: Response) => {
    try {
      const data = createPlanosEmpresariaisSchema.parse(req.body);
      const plano = await planosEmpresariaisService.create(data);
      res.status(201).json(plano);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação do plano empresarial',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error instanceof PlanosEmpresariaisLimitError) {
        return res.status(409).json({
          success: false,
          code: 'PLANOS_EMPRESARIAIS_LIMIT_REACHED',
          message: error.message,
          limite: MAX_PLANOS_EMPRESARIAIS,
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_EMPRESARIAIS_CREATE_ERROR',
        message: 'Erro ao criar plano empresarial',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = updatePlanosEmpresariaisSchema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do plano empresarial',
        });
      }

      const plano = await planosEmpresariaisService.update(id, data);
      res.json(plano);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualização do plano empresarial',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'PLANOS_EMPRESARIAIS_NOT_FOUND',
          message: 'Plano empresarial não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_EMPRESARIAIS_UPDATE_ERROR',
        message: 'Erro ao atualizar plano empresarial',
        error: error?.message,
      });
    }
  };

  static remove = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await planosEmpresariaisService.remove(id);
      res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'PLANOS_EMPRESARIAIS_NOT_FOUND',
          message: 'Plano empresarial não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_EMPRESARIAIS_DELETE_ERROR',
        message: 'Erro ao remover plano empresarial',
        error: error?.message,
      });
    }
  };
}

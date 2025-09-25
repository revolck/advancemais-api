import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { adminVagasService } from '@/modules/empresas/admin/services/admin-vagas.service';
import {
  adminVagaIdParamSchema,
  adminVagasListQuerySchema,
} from '@/modules/empresas/admin/validators/admin-vagas.schema';

export class AdminVagasController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = adminVagasListQuerySchema.parse(req.query);
      const result = await adminVagasService.list(query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar vagas',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ADMIN_VAGAS_LIST_ERROR',
        message: 'Erro ao listar vagas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const params = adminVagaIdParamSchema.parse(req.params);
      const vaga = await adminVagasService.get(params.id);

      if (!vaga) {
        return res.status(404).json({
          success: false,
          code: 'ADMIN_VAGA_NOT_FOUND',
          message: 'Vaga não encontrada',
        });
      }

      return res.json(vaga);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para buscar vaga',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ADMIN_VAGAS_GET_ERROR',
        message: 'Erro ao buscar vaga',
        error: error?.message,
      });
    }
  };
}

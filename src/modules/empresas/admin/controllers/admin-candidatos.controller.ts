import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { adminCandidatosService } from '@/modules/empresas/admin/services/admin-candidatos.service';
import {
  adminCandidatoIdParamSchema,
  adminCandidatosListQuerySchema,
} from '@/modules/empresas/admin/validators/admin-candidatos.schema';

export class AdminCandidatosController {
  static list = async (req: Request, res: Response) => {
    try {
      const query = adminCandidatosListQuerySchema.parse(req.query);
      const result = await adminCandidatosService.list(query);
      return res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar candidatos',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ADMIN_CANDIDATOS_LIST_ERROR',
        message: 'Erro ao listar candidatos',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const params = adminCandidatoIdParamSchema.parse(req.params);
      const candidato = await adminCandidatosService.get(params.id);

      if (!candidato) {
        return res.status(404).json({
          success: false,
          code: 'ADMIN_CANDIDATO_NOT_FOUND',
          message: 'Candidato não encontrado',
        });
      }

      return res.json(candidato);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para buscar candidato',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'ADMIN_CANDIDATO_GET_ERROR',
        message: 'Erro ao buscar candidato',
        error: error?.message,
      });
    }
  };
}

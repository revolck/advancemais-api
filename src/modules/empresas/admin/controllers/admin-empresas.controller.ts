import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import {
  adminEmpresasIdParamSchema,
  adminEmpresasListQuerySchema,
} from '@/modules/empresas/admin/validators/admin-empresas.schema';

export class AdminEmpresasController {
  static list = async (req: Request, res: Response) => {
    try {
      const filters = adminEmpresasListQuerySchema.parse(req.query);
      const result = await adminEmpresasService.list(filters);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de busca inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_LIST_ERROR',
        message: 'Erro ao listar empresas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const empresa = await adminEmpresasService.get(params.id);

      if (!empresa) {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.json({ empresa });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_GET_ERROR',
        message: 'Erro ao consultar a empresa',
        error: error?.message,
      });
    }
  };
}

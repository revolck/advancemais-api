import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import {
  adminEmpresasCreateSchema,
  adminEmpresasIdParamSchema,
  adminEmpresasListQuerySchema,
  adminEmpresasUpdateSchema,
} from '@/modules/empresas/admin/validators/admin-empresas.schema';

export class AdminEmpresasController {
  static create = async (req: Request, res: Response) => {
    try {
      const payload = adminEmpresasCreateSchema.parse(req.body);
      const empresa = await adminEmpresasService.create(payload);

      if (!empresa) {
        return res.status(500).json({
          success: false,
          code: 'ADMIN_EMPRESAS_CREATE_ERROR',
          message: 'Empresa criada, mas não foi possível carregar os dados atualizados',
        });
      }

      res.status(201).json({ empresa });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para criação da empresa',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2002') {
        return res.status(409).json({
          success: false,
          code: 'EMPRESA_DUPLICATED',
          message: 'Já existe uma empresa com os dados informados (e-mail, CNPJ ou Supabase ID)',
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_EMPRESARIAL_NOT_FOUND',
          message: 'Plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_CREATE_ERROR',
        message: 'Erro ao criar empresa',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const payload = adminEmpresasUpdateSchema.parse(req.body);
      const empresa = await adminEmpresasService.update(params.id, payload);

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
          message: 'Dados inválidos para atualização da empresa',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND' || error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      if (error?.code === 'P2002') {
        return res.status(409).json({
          success: false,
          code: 'EMPRESA_DUPLICATED',
          message: 'Já existe uma empresa com os dados informados (e-mail, CNPJ ou Supabase ID)',
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_EMPRESARIAL_NOT_FOUND',
          message: 'Plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_UPDATE_ERROR',
        message: 'Erro ao atualizar empresa',
        error: error?.message,
      });
    }
  };

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

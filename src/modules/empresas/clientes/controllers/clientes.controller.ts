import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import {
  createClientePlanoSchema,
  listClientePlanoQuerySchema,
  updateClientePlanoSchema,
} from '@/modules/empresas/clientes/validators/clientes.schema';

const PRISMA_NOT_FOUND_CODE = 'EMPRESA_PLANO_NOT_FOUND';

export class ClientesController {
  static list = async (req: Request, res: Response) => {
    try {
      const filters = listClientePlanoQuerySchema.parse(req.query);
      const planos = await clientesService.list(filters);
      res.json(planos);
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
        code: 'PLANOS_PARCEIRO_LIST_ERROR',
        message: 'Erro ao listar os planos vinculados às empresas',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
    try {
      const plano = await clientesService.get(req.params.id);

      if (!plano) {
        return res.status(404).json({
          success: false,
          code: 'PLANO_PARCEIRO_NOT_FOUND',
          message: 'Plano parceiro da empresa não encontrado',
        });
      }

      res.json(plano);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'PLANOS_PARCEIRO_GET_ERROR',
        message: 'Erro ao consultar o plano parceiro da empresa',
        error: error?.message,
      });
    }
  };

  static assign = async (req: Request, res: Response) => {
    try {
      const payload = createClientePlanoSchema.parse(req.body);
      const plano = await clientesService.assign(payload);
      res.status(201).json(plano);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para vincular o plano parceiro',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_PARCEIRO_REFERENCE_NOT_FOUND',
          message: 'Empresa ou plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_PARCEIRO_ASSIGN_ERROR',
        message: 'Erro ao vincular o plano parceiro à empresa',
        error: error?.message,
      });
    }
  };

  static update = async (req: Request, res: Response) => {
    try {
      const payload = updateClientePlanoSchema.parse(req.body);
      const hasUpdates = Object.values(payload).some((value) => value !== undefined);

      if (!hasUpdates) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Informe ao menos um campo para atualização do plano parceiro',
        });
      }

      const plano = await clientesService.update(req.params.id, payload);
      res.json(plano);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para atualizar o plano parceiro',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === PRISMA_NOT_FOUND_CODE || error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_PARCEIRO_NOT_FOUND',
          message: 'Plano parceiro da empresa não encontrado',
        });
      }

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_PARCEIRO_REFERENCE_NOT_FOUND',
          message: 'Empresa ou plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_PARCEIRO_UPDATE_ERROR',
        message: 'Erro ao atualizar o plano parceiro da empresa',
        error: error?.message,
      });
    }
  };

  static deactivate = async (req: Request, res: Response) => {
    try {
      await clientesService.deactivate(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === PRISMA_NOT_FOUND_CODE || error?.code === 'P2025') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_PARCEIRO_NOT_FOUND',
          message: 'Plano parceiro da empresa não encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'PLANOS_PARCEIRO_DELETE_ERROR',
        message: 'Erro ao encerrar o plano parceiro da empresa',
        error: error?.message,
      });
    }
  };
}

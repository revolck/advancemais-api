import { Request, Response } from 'express';
import { ZodError } from 'zod';

import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import {
  adminEmpresasBloqueioSchema,
  adminEmpresasCreateSchema,
  adminEmpresasDashboardListQuerySchema,
  adminEmpresasHistoryQuerySchema,
  adminEmpresasIdParamSchema,
  adminEmpresasListQuerySchema,
  adminEmpresasVagaParamSchema,
  adminEmpresasVagasQuerySchema,
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

  static unblock = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const adminId = req.user?.id;
      if (!adminId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const { observacoes } = (req.body || {}) as { observacoes?: string };
      await adminEmpresasService.revogarBloqueio(params.id, adminId, observacoes);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res
          .status(404)
          .json({ success: false, code: 'EMPRESA_NOT_FOUND', message: 'Empresa não encontrada' });
      }
      if (error?.code === 'BLOQUEIO_NOT_FOUND') {
        return res
          .status(404)
          .json({
            success: false,
            code: 'BLOQUEIO_NOT_FOUND',
            message: 'Nenhum bloqueio ativo encontrado',
          });
      }
      res
        .status(500)
        .json({
          success: false,
          code: 'ADMIN_EMPRESAS_UNBLOCK_ERROR',
          message: 'Erro ao revogar bloqueio',
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

  static listDashboard = async (req: Request, res: Response) => {
    try {
      const filters = adminEmpresasDashboardListQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listDashboard(filters);
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
        code: 'ADMIN_EMPRESAS_DASHBOARD_LIST_ERROR',
        message: 'Erro ao listar empresas para o dashboard',
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

  static getOverview = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const overview = await adminEmpresasService.getFullOverview(params.id);

      if (!overview) {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.json(overview);
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
        code: 'ADMIN_EMPRESAS_OVERVIEW_ERROR',
        message: 'Erro ao carregar visão completa da empresa',
        error: error?.message,
      });
    }
  };

  static listPagamentos = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const query = adminEmpresasHistoryQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listPagamentos(params.id, query);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_PAGAMENTOS_ERROR',
        message: 'Erro ao listar histórico de pagamentos',
        error: error?.message,
      });
    }
  };

  static listVagas = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const query = adminEmpresasVagasQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listVagas(params.id, query);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_VAGAS_ERROR',
        message: 'Erro ao listar vagas da empresa',
        error: error?.message,
      });
    }
  };

  static listVagasEmAnalise = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const query = adminEmpresasHistoryQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listVagasEmAnalise(params.id, query);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_VAGAS_ANALISE_ERROR',
        message: 'Erro ao listar vagas em análise',
        error: error?.message,
      });
    }
  };

  static approveVaga = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasVagaParamSchema.parse(req.params);

      const result = await adminEmpresasService.approveVaga(params.id, params.vagaId);
      res.json({ vaga: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      if (error?.code === 'VAGA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'VAGA_NOT_FOUND',
          message: 'Vaga não encontrada para a empresa informada',
        });
      }

      if (error?.code === 'VAGA_INVALID_STATUS') {
        return res.status(400).json({
          success: false,
          code: 'VAGA_INVALID_STATUS',
          message: 'A vaga precisa estar com status EM_ANALISE para ser aprovada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_VAGA_APROVAR_ERROR',
        message: 'Erro ao aprovar a vaga',
        error: error?.message,
      });
    }
  };

  static block = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const payload = adminEmpresasBloqueioSchema.parse(req.body);

      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const bloqueio = await adminEmpresasService.aplicarBloqueio(params.id, adminId, payload);

      if (!bloqueio) {
        return res.status(500).json({
          success: false,
          code: 'BLOQUEIO_NOT_CREATED',
          message: 'Não foi possível registrar o bloqueio',
        });
      }

      res.status(201).json({ bloqueio });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para bloqueio',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      if (error?.code === 'ADMIN_REQUIRED') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Somente administradores ou moderadores podem aplicar bloqueios',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_BLOCK_ERROR',
        message: 'Erro ao aplicar bloqueio',
        error: error?.message,
      });
    }
  };

  static listBloqueios = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const query = adminEmpresasHistoryQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listarBloqueios(params.id, query);
      res.json(result);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      if (error?.code === 'EMPRESA_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_BLOQUEIOS_ERROR',
        message: 'Erro ao listar bloqueios da empresa',
        error: error?.message,
      });
    }
  };
}

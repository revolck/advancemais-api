import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import {
  adminEmpresasBloqueioSchema,
  adminEmpresasCreateSchema,
  adminEmpresasDashboardListQuerySchema,
  adminEmpresasHistoryQuerySchema,
  adminEmpresasIdParamSchema,
  adminEmpresasListQuerySchema,
  adminEmpresasPlanoManualAssignSchema,
  adminEmpresasPlanoUpdateSchema,
  adminEmpresasVagaParamSchema,
  adminEmpresasVagasQuerySchema,
  adminEmpresasUpdateSchema,
  adminEmpresasValidateCpfQuerySchema,
  adminEmpresasValidateCnpjQuerySchema,
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

  static validateCnpj = async (req: Request, res: Response) => {
    try {
      const query = adminEmpresasValidateCnpjQuerySchema.parse(req.query);
      const result = await adminEmpresasService.validateCnpj(query.cnpj);

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

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_VALIDATE_CNPJ_ERROR',
        message: 'Erro ao validar CNPJ',
        error: error?.message,
      });
    }
  };

  static validateCpf = async (req: Request, res: Response) => {
    try {
      const query = adminEmpresasValidateCpfQuerySchema.parse(req.query);
      const result = await adminEmpresasService.validateCpf(query.cpf);

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

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_VALIDATE_CPF_ERROR',
        message: 'Erro ao validar CPF',
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
        return res.status(404).json({
          success: false,
          code: 'BLOQUEIO_NOT_FOUND',
          message: 'Nenhum bloqueio ativo encontrado',
        });
      }
      res.status(500).json({
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
      const alteradoPor = req.user?.id;
      const empresa = await adminEmpresasService.update(params.id, payload, alteradoPor);

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:210',message:'listDashboard controller entry',data:{query:req.query},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    try {
      const filters = adminEmpresasDashboardListQuerySchema.parse(req.query);
      const result = await adminEmpresasService.listDashboard(filters);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:214',message:'service call success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      res.json(result);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:216',message:'error caught in controller',data:{errorType:error?.constructor?.name,errorCode:error?.code,errorMessage:error?.message?.substring(0,200),isZodError:error instanceof ZodError,isPrismaError:error?.code?.startsWith('P')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de busca inválidos',
          issues: error.flatten().fieldErrors,
        });
      }

      // ✅ Tratar erros de conexão do Prisma (P1001) como 503 Service Unavailable
      // Verificar tanto PrismaClientKnownRequestError quanto erro genérico com code P1001
      const errorCode = (error as any)?.code;
      const errorMessage = String((error as any)?.message || '').toLowerCase();
      const isPrismaConnectionError =
        (error instanceof PrismaClientKnownRequestError &&
          (error.code === 'P1001' || error.code === 'P2024')) ||
        errorCode === 'P1001' ||
        errorCode === 'P2024' ||
        errorMessage.includes("can't reach database") ||
        errorMessage.includes('database server') ||
        errorMessage.includes('connection') ||
        errorMessage.includes("can't reach");

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:235',message:'checking connection error',data:{errorCode,isPrismaConnectionError,isPrismaClientKnownRequestError:error instanceof PrismaClientKnownRequestError,errorMessage:error?.message?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (isPrismaConnectionError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:242',message:'returning 503 for connection error',data:{errorCode},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        return res.status(503).json({
          success: false,
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.',
        });
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/34a77828-9b1a-462e-8307-874a549a1cd3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin-empresas.controller.ts:242',message:'returning 500 error',data:{errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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

  static updatePlano = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const payload = adminEmpresasPlanoUpdateSchema.parse(req.body);
      const alteradoPor = req.user?.id;
      const empresa = await adminEmpresasService.updatePlano(params.id, payload, alteradoPor);

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
          message: 'Dados inválidos para atualização do plano',
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

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_EMPRESARIAL_NOT_FOUND',
          message: 'Plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_UPDATE_PLANO_ERROR',
        message: 'Erro ao atualizar plano da empresa',
        error: error?.message,
      });
    }
  };

  static assignPlanoManual = async (req: Request, res: Response) => {
    try {
      const params = adminEmpresasIdParamSchema.parse(req.params);
      const payload = adminEmpresasPlanoManualAssignSchema.parse(req.body);
      const alteradoPor = req.user?.id;
      const empresa = await adminEmpresasService.assignPlanoManual(params.id, payload, alteradoPor);

      if (!empresa) {
        return res.status(404).json({
          success: false,
          code: 'EMPRESA_NOT_FOUND',
          message: 'Empresa não encontrada',
        });
      }

      res.status(201).json({ empresa });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para cadastro manual do plano',
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

      if (error?.code === 'P2003') {
        return res.status(404).json({
          success: false,
          code: 'PLANO_EMPRESARIAL_NOT_FOUND',
          message: 'Plano empresarial informado não foi encontrado',
        });
      }

      res.status(500).json({
        success: false,
        code: 'ADMIN_EMPRESAS_ASSIGN_PLANO_ERROR',
        message: 'Erro ao cadastrar plano da empresa manualmente',
        error: error?.message,
      });
    }
  };

  static get = async (req: Request, res: Response) => {
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
        code: 'ADMIN_EMPRESAS_GET_ERROR',
        message: 'Erro ao carregar detalhes completos da empresa',
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

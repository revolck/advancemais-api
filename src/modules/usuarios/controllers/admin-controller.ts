/**
 * Controller administrativo - Operações de gestão
 * Responsabilidade única: lógica administrativa
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { NextFunction, Request, Response } from 'express';
import { AdminService } from '../services/admin-service';
import { logger } from '../../../utils/logger';
import {
  adminCreateUserSchema,
  formatZodErrors,
  updateRoleSchema,
  updateStatusSchema,
} from '../validators/auth.schema';

export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: 'AdminController',
      correlationId: req.id,
    });
  }

  /**
   * Informações da área administrativa
   */
  public getAdminInfo = async (req: Request, res: Response) => {
    res.json({
      message: 'Área administrativa',
      usuario: req.user,
      timestamp: new Date().toISOString(),
      permissions: this.getUserPermissions(req.user?.role),
    });
  };

  /**
   * Lista usuários com paginação e filtros
   */
  public listarUsuarios = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const result = await this.adminService.listarUsuarios(req.query);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao listar usuários');
      return next(err);
    }
  };

  /**
   * Lista candidatos com paginação e filtros
   */
  public listarCandidatos = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const result = await this.adminService.listarCandidatos(req.query);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const statusCode = (error as any)?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        log.warn({ err }, 'Erro de validação ao listar candidatos');
        const errorCode = (error as any)?.code ?? 'VALIDATION_ERROR';
        return res.status(statusCode).json({
          success: false,
          code: errorCode,
          message: err.message,
          issues: {
            search: [err.message],
          },
        });
      }

      log.error({ err }, 'Erro ao listar candidatos');
      return next(err);
    }
  };

  /**
   * Lista candidatos com limite otimizado para dashboards
   */
  public listarCandidatosDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const log = this.getLogger(req);
    try {
      const result = await this.adminService.listarCandidatos(req.query, {
        defaultLimit: 10,
        maxLimit: 10,
        forceLimit: 10,
      });
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const statusCode = (error as any)?.statusCode;
      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        log.warn({ err }, 'Erro de validação ao listar candidatos para dashboard');
        const errorCode = (error as any)?.code ?? 'VALIDATION_ERROR';
        return res.status(statusCode).json({
          success: false,
          code: errorCode,
          message: err.message,
          issues: {
            search: [err.message],
          },
        });
      }

      log.error({ err }, 'Erro ao listar candidatos para dashboard');
      return next(err);
    }
  };

  /**
   * Busca usuário específico
   */
  public buscarUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const result = await this.adminService.buscarUsuario(userId);

      if (!result) {
        return res.status(404).json({
          message: 'Usuário não encontrado',
        });
      }

      res.json({
        message: 'Usuário encontrado',
        usuario: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao buscar usuário');
      return next(err);
    }
  };

  /**
   * Busca candidato específico
   */
  public buscarCandidato = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const result = await this.adminService.buscarCandidato(userId);

      if (!result) {
        return res.status(404).json({
          message: 'Candidato não encontrado',
        });
      }

      res.json({
        message: 'Candidato encontrado',
        candidato: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao buscar candidato');
      return next(err);
    }
  };

  /**
   * Atualiza status do usuário
   */
  public atualizarStatus = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const validation = updateStatusSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, 'Erro de validação ao atualizar status');
        return res.status(400).json({
          message: 'Dados inválidos para atualização de status',
          errors,
        });
      }

      const { status, motivo } = validation.data;

      const result = await this.adminService.atualizarStatus(userId, status, motivo);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao atualizar status');
      return next(err);
    }
  };

  /**
   * Atualiza role do usuário
   */
  public atualizarRole = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const validation = updateRoleSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, 'Erro de validação ao atualizar role');
        return res.status(400).json({
          message: 'Dados inválidos para atualização de role',
          errors,
        });
      }

      const { role, motivo } = validation.data;
      const adminId = req.user?.id;

      const result = await this.adminService.atualizarRole(userId, role, motivo, adminId);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao atualizar role');
      return next(err);
    }
  };

  public criarUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    const correlationId = req.id;

    try {
      const validation = adminCreateUserSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, 'Erro de validação ao criar usuário via admin');
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos para criação de usuário',
          errors,
          correlationId,
        });
      }

      const result = await this.adminService.criarUsuario(validation.data, {
        correlationId,
        adminId: req.user?.id,
      });

      return res.status(201).json({ ...result, correlationId });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const statusCode = (error as any)?.statusCode;

      if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
        log.warn({ err }, 'Falha ao criar usuário via admin');
        return res.status(statusCode).json({
          success: false,
          message: err.message,
          code: (error as any)?.code ?? 'ADMIN_USER_CREATION_ERROR',
          ...(error as any)?.details ? { errors: (error as any).details } : {},
          correlationId,
        });
      }

      log.error({ err }, 'Erro inesperado ao criar usuário via admin');
      return next(err);
    }
  };

  /**
   * Retorna permissões baseadas na role
   */
  private getUserPermissions(role?: string) {
    const permissions = {
      ADMIN: ['read', 'write', 'delete', 'manage_users', 'manage_payments'],
      MODERADOR: ['read', 'write', 'manage_users'],
      FINANCEIRO: ['read', 'manage_payments'],
    };

    return permissions[role as keyof typeof permissions] || ['read'];
  }
}

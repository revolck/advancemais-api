/**
 * Controller administrativo - Operações de gestão
 * Responsabilidade única: lógica administrativa
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AdminService } from '../services/admin-service';
import { logger } from '../../../utils/logger';
import {
  adminCreateUserSchema,
  adminAlunoBloqueioSchema,
  formatZodErrors,
  updateRoleSchema,
  updateStatusSchema,
} from '../validators/auth.schema';
import {
  aplicarBloqueioAluno,
  revogarBloqueioAluno,
  listarBloqueiosAluno,
} from '../services/aluno-bloqueios.service';
import {
  aplicarBloqueioInstrutor,
  revogarBloqueioInstrutor,
  listarBloqueiosInstrutor,
} from '../services/instrutor-bloqueios.service';
import {
  aplicarBloqueioUsuario,
  revogarBloqueioUsuario,
  listarBloqueiosUsuario,
} from '../services/usuario-bloqueios.service';
import { InstrutorController } from './instrutor-controller';

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
  public listarCandidatosDashboard = async (req: Request, res: Response, next: NextFunction) => {
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

  public listarCandidatoLogs = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const result = await this.adminService.listarCandidatoLogs(userId, req.query);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao listar logs do candidato');
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
          ...((error as any)?.details ? { errors: (error as any).details } : {}),
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

  /**
   * Aplicar bloqueio ao aluno
   */
  public aplicarBloqueioAluno = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const validation = adminAlunoBloqueioSchema.safeParse(req.body);

      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, 'Erro de validação ao aplicar bloqueio');
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para bloqueio',
          errors,
        });
      }

      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const bloqueio = await aplicarBloqueioAluno(userId, adminId, validation.data);

      if (!bloqueio) {
        return res.status(500).json({
          success: false,
          code: 'BLOQUEIO_NOT_CREATED',
          message: 'Não foi possível registrar o bloqueio',
        });
      }

      res.status(201).json({ bloqueio });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao aplicar bloqueio');

      if ((error as any)?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      if ((error as any)?.code === 'ADMIN_REQUIRED') {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Somente administradores ou moderadores podem aplicar bloqueios',
        });
      }

      return next(err);
    }
  };

  /**
   * Revogar bloqueio do aluno
   */
  public revogarBloqueioAluno = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const observacoes = (req.body.observacoes as string) || null;

      const adminId = req.user?.id;
      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      await revogarBloqueioAluno(userId, adminId, observacoes);

      res.json({
        success: true,
        message: 'Bloqueio revogado com sucesso',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao revogar bloqueio');

      if (
        (error as any)?.code === 'ALUNO_NOT_FOUND' ||
        (error as any)?.code === 'BLOQUEIO_NOT_FOUND'
      ) {
        return res.status(404).json({
          success: false,
          code: (error as any).code,
          message: err.message,
        });
      }

      return next(err);
    }
  };

  /**
   * Listar bloqueios do aluno
   */
  public listarBloqueiosAluno = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await listarBloqueiosAluno(userId, page, pageSize);

      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao listar bloqueios');

      if ((error as any)?.code === 'ALUNO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'ALUNO_NOT_FOUND',
          message: 'Aluno não encontrado',
        });
      }

      return next(err);
    }
  };

  // =============================================
  // MÉTODOS DE BLOQUEIO DE INSTRUTOR
  // =============================================

  /**
   * Aplica bloqueio a um instrutor
   */
  public aplicarBloqueioInstrutor = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const payload = adminAlunoBloqueioSchema.parse(req.body);

      const result = await aplicarBloqueioInstrutor(userId, adminId, payload);

      res.status(201).json({
        success: true,
        message: 'Bloqueio aplicado ao instrutor com sucesso',
        data: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao aplicar bloqueio ao instrutor');

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para bloqueio',
          issues: formatZodErrors(error),
        });
      }

      if ((error as any)?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado',
        });
      }

      if ((error as any)?.code === 'INVALID_USER_TYPE') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_USER_TYPE',
          message: 'Usuário não é um instrutor',
        });
      }

      return next(err);
    }
  };

  /**
   * Revoga bloqueio de um instrutor
   */
  public revogarBloqueioInstrutor = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const observacoes = (req.body.observacoes as string | undefined)?.trim() || null;

      await revogarBloqueioInstrutor(userId, adminId, observacoes);

      res.json({
        success: true,
        message: 'Bloqueio revogado do instrutor com sucesso',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao revogar bloqueio do instrutor');

      if ((error as any)?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado',
        });
      }

      if ((error as any)?.code === 'BLOQUEIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'BLOQUEIO_NOT_FOUND',
          message: 'Nenhum bloqueio ativo encontrado',
        });
      }

      return next(err);
    }
  };

  /**
   * Lista bloqueios de um instrutor
   */
  public listarBloqueiosInstrutor = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await listarBloqueiosInstrutor(userId, page, pageSize);

      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao listar bloqueios do instrutor');

      if ((error as any)?.code === 'INSTRUTOR_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'INSTRUTOR_NOT_FOUND',
          message: 'Instrutor não encontrado',
        });
      }

      return next(err);
    }
  };

  /**
   * Atualiza informações completas de um usuário
   */
  public atualizarUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;

      // Validar UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_ID',
          message: 'ID do usuário inválido. Deve ser um UUID válido.',
        });
      }

      const result = await this.adminService.atualizarUsuario(userId, req.body);

      res.json({
        success: true,
        message: 'Informações do usuário atualizadas com sucesso',
        data: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao atualizar usuário');

      if ((error as any)?.code === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      if ((error as any)?.code === 'EMAIL_ALREADY_EXISTS') {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Este e-mail já está em uso por outro usuário',
        });
      }

      if (
        (error as any)?.code === 'PASSWORD_CONFIRMATION_REQUIRED' ||
        (error as any)?.code === 'PASSWORD_MISMATCH' ||
        (error as any)?.code === 'PASSWORD_TOO_SHORT' ||
        (error as any)?.code === 'INVALID_EMAIL'
      ) {
        return res.status(400).json({
          success: false,
          code: (error as any)?.code,
          message: err.message,
        });
      }

      return next(err);
    }
  };

  // =============================================
  // MÉTODOS DE BLOQUEIO DE USUÁRIOS GERAIS
  // =============================================

  /**
   * Aplica bloqueio a um usuário (qualquer role)
   */
  public aplicarBloqueioUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const payload = adminAlunoBloqueioSchema.parse(req.body);

      const result = await aplicarBloqueioUsuario(userId, adminId, payload);

      res.status(201).json({
        success: true,
        message: 'Bloqueio aplicado ao usuário com sucesso',
        data: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao aplicar bloqueio ao usuário');

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos para bloqueio',
          issues: formatZodErrors(error),
        });
      }

      if ((error as any)?.code === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      return next(err);
    }
  };

  /**
   * Revoga bloqueio de um usuário
   */
  public revogarBloqueioUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const observacoes = (req.body.observacoes as string | undefined)?.trim() || null;

      await revogarBloqueioUsuario(userId, adminId, observacoes);

      res.json({
        success: true,
        message: 'Bloqueio revogado do usuário com sucesso',
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao revogar bloqueio do usuário');

      if ((error as any)?.code === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      if ((error as any)?.code === 'BLOQUEIO_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'BLOQUEIO_NOT_FOUND',
          message: 'Nenhum bloqueio ativo encontrado',
        });
      }

      return next(err);
    }
  };

  /**
   * Lista bloqueios de um usuário
   */
  public listarBloqueiosUsuario = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await listarBloqueiosUsuario(userId, page, pageSize);

      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao listar bloqueios do usuário');

      if ((error as any)?.code === 'USER_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuário não encontrado',
        });
      }

      return next(err);
    }
  };

  /**
   * Busca currículo específico por ID (admin/moderador)
   */
  public buscarCurriculoPorId = async (req: Request, res: Response, next: NextFunction) => {
    const log = this.getLogger(req);
    try {
      const { curriculoId } = req.params;
      const result = await this.adminService.buscarCurriculoPorId(curriculoId);

      if (!result) {
        return res.status(404).json({
          message: 'Currículo não encontrado',
        });
      }

      res.json({
        message: 'Currículo encontrado',
        curriculo: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, 'Erro ao buscar currículo');
      return next(err);
    }
  };
}

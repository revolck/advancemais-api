/**
 * Controller administrativo - Operações de gestão
 * Responsabilidade única: lógica administrativa
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { NextFunction, Request, Response } from "express";
import { AdminService } from "../services/admin-service";
import { logger } from "../../../utils/logger";
import {
  formatZodErrors,
  updateRoleSchema,
  updateStatusSchema,
} from "../validators/auth.schema";

export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: "AdminController",
      correlationId: req.id,
    });
  }

  /**
   * Informações da área administrativa
   */
  public getAdminInfo = async (req: Request, res: Response) => {
    res.json({
      message: "Área administrativa",
      usuario: req.user,
      timestamp: new Date().toISOString(),
      permissions: this.getUserPermissions(req.user?.role),
    });
  };

  /**
   * Lista usuários com paginação e filtros
   */
  public listarUsuarios = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const log = this.getLogger(req);
    try {
      const result = await this.adminService.listarUsuarios(req.query);
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, "Erro ao listar usuários");
      return next(err);
    }
  };

  /**
   * Busca usuário específico
   */
  public buscarUsuario = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const result = await this.adminService.buscarUsuario(userId);

      if (!result) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      res.json({
        message: "Usuário encontrado",
        usuario: result,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, "Erro ao buscar usuário");
      return next(err);
    }
  };

  /**
   * Atualiza status do usuário
   */
  public atualizarStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const validation = updateStatusSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, "Erro de validação ao atualizar status");
        return res.status(400).json({
          message: "Dados inválidos para atualização de status",
          errors,
        });
      }

      const { status, motivo } = validation.data;

      const result = await this.adminService.atualizarStatus(
        userId,
        status,
        motivo
      );
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, "Erro ao atualizar status");
      return next(err);
    }
  };

  /**
   * Atualiza role do usuário
   */
  public atualizarRole = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;
      const validation = updateRoleSchema.safeParse(req.body);
      if (!validation.success) {
        const errors = formatZodErrors(validation.error);
        log.warn({ errors }, "Erro de validação ao atualizar role");
        return res.status(400).json({
          message: "Dados inválidos para atualização de role",
          errors,
        });
      }

      const { role, motivo } = validation.data;
      const adminId = req.user?.id;

      const result = await this.adminService.atualizarRole(
        userId,
        role,
        motivo,
        adminId
      );
      res.json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error({ err }, "Erro ao atualizar role");
      return next(err);
    }
  };

  /**
   * Retorna permissões baseadas na role
   */
  private getUserPermissions(role?: string) {
    const permissions = {
      ADMIN: ["read", "write", "delete", "manage_users", "manage_payments"],
      MODERADOR: ["read", "write", "manage_users"],
      FINANCEIRO: ["read", "manage_payments"],
    };

    return permissions[role as keyof typeof permissions] || ["read"];
  }
}

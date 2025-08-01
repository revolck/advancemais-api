/**
 * Controller administrativo - Operações de gestão
 * Responsabilidade única: lógica administrativa
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
import { Request, Response } from "express";
import { AdminService } from "../services/admin-service";

export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  /**
   * Informações da área administrativa
   */
  public getAdminInfo = async (req: Request, res: Response) => {
    try {
      res.json({
        message: "Área administrativa",
        usuario: req.user,
        timestamp: new Date().toISOString(),
        permissions: this.getUserPermissions(req.user?.role),
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Lista usuários com paginação e filtros
   */
  public listarUsuarios = async (req: Request, res: Response) => {
    try {
      const result = await this.adminService.listarUsuarios(req.query);
      res.json(result);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({
        message: "Erro ao listar usuários",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Busca usuário específico
   */
  public buscarUsuario = async (req: Request, res: Response) => {
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
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({
        message: "Erro ao buscar usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Histórico de pagamentos do usuário
   */
  public historicoPagamentosUsuario = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const result = await this.adminService.historicoPagamentos(
        userId,
        req.query
      );
      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      res.status(500).json({
        message: "Erro ao buscar histórico de pagamentos",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Atualiza status do usuário
   */
  public atualizarStatus = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { status, motivo } = req.body;

      const result = await this.adminService.atualizarStatus(
        userId,
        status,
        motivo
      );
      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      res.status(500).json({
        message: "Erro ao atualizar status do usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Atualiza role do usuário
   */
  public atualizarRole = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role, motivo } = req.body;
      const adminId = req.user?.id;

      const result = await this.adminService.atualizarRole(
        userId,
        role,
        motivo,
        adminId
      );
      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar role:", error);
      res.status(500).json({
        message: "Erro ao atualizar role do usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
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

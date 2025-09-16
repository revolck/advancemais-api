/**
 * Controller de estatísticas - Dashboard e métricas
 * Responsabilidade única: coleta e apresentação de estatísticas
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Request, Response } from "express";
import { StatsService } from "../services/stats-service";
import { logger } from "../../../utils/logger";

export class StatsController {
  private statsService: StatsService;

  constructor() {
    this.statsService = new StatsService();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: "StatsController",
      correlationId: req.id,
    });
  }

  /**
   * Estatísticas do dashboard principal
   * GET /stats/dashboard
   */
  public getDashboardStats = async (req: Request, res: Response) => {
    const log = this.getLogger(req);
    try {
      const stats = await this.statsService.getDashboardStats();

      res.json({
        message: "Estatísticas do dashboard",
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error({ err: error }, "Erro ao obter estatísticas");
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Estatísticas específicas de usuários
   * GET /stats/usuarios
   */
  public getUserStats = async (req: Request, res: Response) => {
    const log = this.getLogger(req);
    try {
      const { periodo = "30d" } = req.query;
      const stats = await this.statsService.getUserStats(periodo as string);

      res.json({
        message: "Estatísticas de usuários",
        stats,
        periodo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error(
        { err: error },
        "Erro ao obter estatísticas de usuários"
      );
      res.status(500).json({
        message: "Erro ao obter estatísticas de usuários",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

}

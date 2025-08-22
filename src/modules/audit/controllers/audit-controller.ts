import { Request, Response } from "express";
import { AuditService } from "../services/audit-service";

export class AuditController {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  public getLogs = async (req: Request, res: Response) => {
    try {
      const empresaId = typeof req.query.empresaId === "string" ? req.query.empresaId : undefined;
      const result = await this.auditService.getLogs(empresaId);
      if (result.success) {
        res.json({ logs: result.data });
      } else {
        res.status(400).json({ message: result.error?.message, error: result.error });
      }
    } catch (error) {
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : error,
      });
    }
  };
}

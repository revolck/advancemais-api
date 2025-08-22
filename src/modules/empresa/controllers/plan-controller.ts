import { Request, Response } from "express";
import { PlanService } from "../services/plan-service";

export class PlanController {
  private planService: PlanService;

  constructor() {
    this.planService = new PlanService();
  }

  public createPlan = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const result = await this.planService.createPlan(req.body, userId);
      if (result.success) {
        res.status(201).json({ message: "Plano criado", plan: result.data });
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

  public getPlans = async (req: Request, res: Response) => {
    try {
      const result = await this.planService.getPlans();
      if (result.success) {
        res.json({ plans: result.data });
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

  public updatePlan = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const { planId } = req.params;
      const result = await this.planService.updatePlan(planId, req.body, userId);
      if (result.success) {
        res.json({ message: "Plano atualizado", plan: result.data });
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

  public assignPlan = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const { planId } = req.params;
      const result = await this.planService.assignPlan(planId, req.body, userId);
      if (result.success) {
        res.json({
          message: "Plano vinculado à empresa",
          empresaPlano: result.data,
        });
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

  public unassignPlan = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const { empresaId } = req.params;
      const result = await this.planService.unassignPlan(empresaId, userId);
      if (result.success) {
        res.json({ message: "Plano desvinculado da empresa" });
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

import { Request, Response } from "express";
import { PlanService } from "../services/plan-service";
import { FrequencyType } from "../enums";

/**
 * Controller para operações de planos do MercadoPago
 */
export class PlanController {
  private planService: PlanService;

  constructor() {
    this.planService = new PlanService();
  }

  /**
   * Define período de teste grátis para um plano
   * PUT /mercadopago/plans/:planId/free-trial
   */
  public offerFreeTrial = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { planId } = req.params;
      const { frequency, frequency_type } = req.body;

      if (!planId || !frequency || !frequency_type) {
        return res.status(400).json({
          message: "planId, frequency e frequency_type são obrigatórios",
        });
      }

      const result = await this.planService.updateFreeTrial(planId, {
        frequency,
        frequency_type: frequency_type as FrequencyType,
      });

      if (result.success) {
        res.json({
          message: "Teste grátis configurado com sucesso",
          plan: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao configurar teste grátis",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao configurar teste grátis:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}

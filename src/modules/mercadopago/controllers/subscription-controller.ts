import { Request, Response } from "express";
import { SubscriptionService } from "../services/subscription-service";
import { SubscriptionData } from "../types/order";
import { SubscriptionStatus } from "../enums";

/**
 * Controller para gerenciar Assinaturas do MercadoPago
 * Endpoints para criar, obter, atualizar e cancelar assinaturas
 */
export class SubscriptionController {
  private subscriptionService: SubscriptionService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Cria uma nova assinatura
   * POST /mercadopago/subscriptions
   */
  public createSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const subscriptionData: SubscriptionData = req.body;

      // Validação básica
      if (
        !subscriptionData.reason ||
        !subscriptionData.payer_email ||
        !subscriptionData.auto_recurring
      ) {
        return res.status(400).json({
          message: "Dados obrigatórios: reason, payer_email e auto_recurring",
        });
      }

      // Define external_reference como userId se não fornecido
      if (!subscriptionData.external_reference) {
        subscriptionData.external_reference = userId;
      }

      const result = await this.subscriptionService.createSubscription(
        subscriptionData,
        userId
      );

      if (result.success) {
        res.status(201).json({
          message: "Assinatura criada com sucesso",
          subscription: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao criar assinatura",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro no controller de criação de assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Obtém informações de uma assinatura
   * GET /mercadopago/subscriptions/:subscriptionId
   */
  public getSubscription = async (req: Request, res: Response) => {
    try {
      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório",
        });
      }

      const result = await this.subscriptionService.getSubscription(
        subscriptionId
      );

      if (result.success) {
        res.json({
          message: "Assinatura encontrada",
          subscription: result.data,
        });
      } else {
        res.status(404).json({
          message: result.error?.message || "Assinatura não encontrada",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao obter assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Atualiza uma assinatura
   * PUT /mercadopago/subscriptions/:subscriptionId
   */
  public updateSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const { subscriptionId } = req.params;
      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório",
        });
      }

      const updateData: Partial<SubscriptionData> = req.body;

      const result = await this.subscriptionService.updateSubscription(
        subscriptionId,
        updateData,
        userId
      );

      if (result.success) {
        res.json({
          message: "Assinatura atualizada com sucesso",
          subscription: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao atualizar assinatura",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Busca assinaturas na API do MercadoPago
   * GET /mercadopago/subscriptions/search
   */
  public searchSubscriptions = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const params = req.query as Record<string, string>;
      const result = await this.subscriptionService.searchSubscriptions(params);

      if (result.success) {
        res.json({
          message: "Assinaturas encontradas",
          subscriptions: result.data,
          total: result.data?.length || 0,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao buscar assinaturas",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar assinaturas:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Lista assinaturas do usuário
   * GET /mercadopago/subscriptions
   */
  public getUserSubscriptions = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { status } = req.query;
      const subscriptionStatus = status as SubscriptionStatus;

      const result = await this.subscriptionService.getUserSubscriptions(
        userId,
        subscriptionStatus
      );

      if (result.success) {
        res.json({
          message: "Assinaturas encontradas",
          subscriptions: result.data,
          total: result.data?.length || 0,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao buscar assinaturas",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar assinaturas do usuário:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Pausa uma assinatura
   * PUT /mercadopago/subscriptions/:subscriptionId/pause
   */
  public pauseSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório",
        });
      }

      const result = await this.subscriptionService.pauseSubscription(
        subscriptionId,
        userId
      );

      if (result.success) {
        res.json({
          message: "Assinatura pausada com sucesso",
          subscription: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao pausar assinatura",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao pausar assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Cancela uma assinatura
   * PUT /mercadopago/subscriptions/:subscriptionId/cancel
   */
  public cancelSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório",
        });
      }

      const result = await this.subscriptionService.cancelSubscription(
        subscriptionId,
        userId
      );

      if (result.success) {
        res.json({
          message: "Assinatura cancelada com sucesso",
          subscription: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao cancelar assinatura",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Reativa uma assinatura pausada
   * PUT /mercadopago/subscriptions/:subscriptionId/reactivate
   */
  public reactivateSubscription = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      const { subscriptionId } = req.params;

      if (!subscriptionId) {
        return res.status(400).json({
          message: "ID da assinatura é obrigatório",
        });
      }

      const result = await this.subscriptionService.reactivateSubscription(
        subscriptionId,
        userId
      );

      if (result.success) {
        res.json({
          message: "Assinatura reativada com sucesso",
          subscription: result.data,
        });
      } else {
        res.status(400).json({
          message: result.error?.message || "Erro ao reativar assinatura",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao reativar assinatura:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}

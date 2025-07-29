import { Request, Response } from "express";
import { WebhookService } from "../services/webhook-service";
import { WebhookNotification } from "../types/order";

/**
 * Controller para gerenciar Webhooks do MercadoPago
 * Endpoint para receber notificações de mudanças de status
 */
export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  /**
   * Processa notificações webhook do MercadoPago
   * POST /mercadopago/webhooks
   */
  public processWebhook = async (req: Request, res: Response) => {
    try {
      const webhookData: WebhookNotification = req.body;

      console.log("📢 Webhook recebido:", {
        id: webhookData.id,
        type: webhookData.type,
        action: webhookData.action,
        dataId: webhookData.data?.id,
      });

      // Processa o webhook
      const result = await this.webhookService.processWebhook(webhookData);

      if (result.success) {
        // MercadoPago espera status 200 para considerar que o webhook foi processado
        res.status(200).json({
          message: "Webhook processado com sucesso",
          result: result.data,
        });
      } else {
        // Mesmo com erro, retorna 200 para evitar reenvios desnecessários
        console.error("Erro ao processar webhook:", result.error);
        res.status(200).json({
          message: "Webhook recebido mas houve erro no processamento",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro crítico no processamento de webhook:", error);

      // Retorna 200 mesmo com erro crítico para evitar reenvios infinitos
      res.status(200).json({
        message: "Webhook recebido mas houve erro crítico",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Endpoint de teste para validar configuração de webhook
   * GET /mercadopago/webhooks/test
   */
  public testWebhook = async (req: Request, res: Response) => {
    try {
      res.json({
        message: "Endpoint de webhook ativo",
        timestamp: new Date().toISOString(),
        status: "OK",
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro no endpoint de teste",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}

import { Router } from "express";
import { WebhookController } from "../controllers";

/**
 * Rotas para Webhooks do MercadoPago - CORRIGIDO
 * Endpoints públicos para recebimento de notificações
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2
 */
const router = Router();
const webhookController = new WebhookController();

/**
 * Informações sobre webhooks
 * GET /webhooks
 */
router.get("/", (req, res) => {
  res.json({
    message: "MercadoPago Webhooks API",
    endpoints: {
      webhook: "POST /",
      test: "GET /test",
    },
    note: "Estes endpoints são chamados pelo MercadoPago automaticamente",
  });
});

/**
 * Receber notificações do MercadoPago
 * POST /webhooks
 */
router.post("/", webhookController.processWebhook);

/**
 * Endpoint de teste para validar configuração
 * GET /webhooks/test
 */
router.get("/test", webhookController.testWebhook);

export { router as webhooksRoutes };

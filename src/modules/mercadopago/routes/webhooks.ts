import { Router } from "express";
import { WebhookController } from "../controllers";

const router = Router();
const webhookController = new WebhookController();

/**
 * Rotas para Webhooks do MercadoPago
 * Estas rotas são públicas pois são chamadas pelo MercadoPago
 */

// POST /webhooks - Receber notificações do MercadoPago
router.post("/", webhookController.processWebhook);

// GET /webhooks/test - Endpoint de teste para validar configuração
router.get("/test", webhookController.testWebhook);

export default router;

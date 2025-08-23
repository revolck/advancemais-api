import { Router } from "express";
import { WebhookController } from "../controllers";

/**
 * Rotas para Webhooks do MercadoPago - CORRIGIDO
 * Endpoints públicos para recebimento de notificações
 *
 * @author Sistema Advance+
 * @version 3.0.2
 */
const router = Router();
const webhookController = new WebhookController();

/**
 * Informações sobre webhooks
 * GET /webhooks
 */
/**
 * @openapi
 * /api/v1/mercadopago/webhooks:
 *   get:
 *     summary: Informações sobre endpoints de webhook
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Detalhes dos webhooks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicMessage'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/webhooks"
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
/**
 * @openapi
 * /api/v1/mercadopago/webhooks:
 *   post:
 *     summary: Receber notificações do MercadoPago
 *     tags: [MercadoPago]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MercadoPagoWebhookNotification'
 *     responses:
 *       200:
 *         description: Notificação recebida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicMessage'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/mercadopago/webhooks" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"id":"123","type":"payment","action":"payment.created","data":{"id":"999"}}'
 */
router.post("/", webhookController.processWebhook);

/**
 * Endpoint de teste para validar configuração
 * GET /webhooks/test
 */
/**
 * @openapi
 * /api/v1/mercadopago/webhooks/test:
 *   get:
 *     summary: Testar configuração de webhook
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Teste bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicMessage'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/webhooks/test"
 */
router.get("/test", webhookController.testWebhook);

export { router as webhooksRoutes };

import { Router } from "express";
import { SubscriptionController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas para Assinaturas do MercadoPago - CORRIGIDO
 * Endpoints para gerenciamento de pagamentos recorrentes
 *
 * @author Sistema Advance+
 * @version 3.0.2
 */
const router = Router();
const subscriptionController = new SubscriptionController();

/**
 * Informações sobre assinaturas
 * GET /subscriptions
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions:
 *   get:
 *     summary: Listar assinaturas do usuário
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de assinaturas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionListResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/subscriptions" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  "/",
  supabaseAuthMiddleware(),
  subscriptionController.getUserSubscriptions
);

/**
 * Criar nova assinatura
 * POST /subscriptions
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions:
 *   post:
 *     summary: Criar nova assinatura
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MercadoPagoSubscriptionRequest'
 *     responses:
 *       201:
 *         description: Assinatura criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionResponse'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/mercadopago/subscriptions" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"reason":"Plano Mensal","payer_email":"user@example.com","auto_recurring":{"frequency":1,"frequency_type":"months","transaction_amount":50,"currency_id":"BRL"}}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(),
  subscriptionController.createSubscription
);

/**
 * Obter informações de uma assinatura
 * GET /subscriptions/:subscriptionId
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions/{subscriptionId}:
 *   get:
 *     summary: Obter assinatura específica
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados da assinatura
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionResponse'
 *       404:
 *         description: Assinatura não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/subscriptions/{subscriptionId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  "/:subscriptionId",
  supabaseAuthMiddleware(),
  subscriptionController.getSubscription
);

/**
 * Pausar assinatura
 * PUT /subscriptions/:subscriptionId/pause
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions/{subscriptionId}/pause:
 *   put:
 *     summary: Pausar assinatura
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assinatura pausada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionResponse'
 *       400:
 *         description: Erro ao pausar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/mercadopago/subscriptions/{subscriptionId}/pause" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.put(
  "/:subscriptionId/pause",
  supabaseAuthMiddleware(),
  subscriptionController.pauseSubscription
);

/**
 * Cancelar assinatura
 * PUT /subscriptions/:subscriptionId/cancel
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions/{subscriptionId}/cancel:
 *   put:
 *     summary: Cancelar assinatura
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assinatura cancelada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionResponse'
 *       400:
 *         description: Erro ao cancelar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/mercadopago/subscriptions/{subscriptionId}/cancel" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.put(
  "/:subscriptionId/cancel",
  supabaseAuthMiddleware(),
  subscriptionController.cancelSubscription
);

/**
 * Reativar assinatura
 * PUT /subscriptions/:subscriptionId/reactivate
 */
/**
 * @openapi
 * /api/v1/mercadopago/subscriptions/{subscriptionId}/reactivate:
 *   put:
 *     summary: Reativar assinatura
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Assinatura reativada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MercadoPagoSubscriptionResponse'
 *       400:
 *         description: Erro ao reativar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/mercadopago/subscriptions/{subscriptionId}/reactivate" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.put(
  "/:subscriptionId/reactivate",
  supabaseAuthMiddleware(),
  subscriptionController.reactivateSubscription
);

export { router as subscriptionsRoutes };

import { Router } from "express";
import { SubscriptionController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas para Assinaturas do MercadoPago - CORRIGIDO
 * Endpoints para gerenciamento de pagamentos recorrentes
 *
 * @author Sistema AdvanceMais
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
 *     responses:
 *       201:
 *         description: Assinatura criada
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
 */
router.put(
  "/:subscriptionId/reactivate",
  supabaseAuthMiddleware(),
  subscriptionController.reactivateSubscription
);

export { router as subscriptionsRoutes };

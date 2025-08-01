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
router.get(
  "/",
  supabaseAuthMiddleware(),
  subscriptionController.getUserSubscriptions
);

/**
 * Criar nova assinatura
 * POST /subscriptions
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
router.get(
  "/:subscriptionId",
  supabaseAuthMiddleware(),
  subscriptionController.getSubscription
);

/**
 * Pausar assinatura
 * PUT /subscriptions/:subscriptionId/pause
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
router.put(
  "/:subscriptionId/cancel",
  supabaseAuthMiddleware(),
  subscriptionController.cancelSubscription
);

/**
 * Reativar assinatura
 * PUT /subscriptions/:subscriptionId/reactivate
 */
router.put(
  "/:subscriptionId/reactivate",
  supabaseAuthMiddleware(),
  subscriptionController.reactivateSubscription
);

export { router as subscriptionsRoutes };

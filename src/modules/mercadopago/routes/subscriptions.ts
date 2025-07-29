import { Router } from "express";
import { SubscriptionController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();
const subscriptionController = new SubscriptionController();

/**
 * Rotas para gerenciamento de Assinaturas do MercadoPago
 * Todas as rotas requerem autenticação
 */

// POST /subscriptions - Criar nova assinatura
router.post(
  "/",
  supabaseAuthMiddleware(),
  subscriptionController.createSubscription
);

// GET /subscriptions - Listar assinaturas do usuário
router.get(
  "/",
  supabaseAuthMiddleware(),
  subscriptionController.getUserSubscriptions
);

// GET /subscriptions/:subscriptionId - Obter informações de uma assinatura
router.get(
  "/:subscriptionId",
  supabaseAuthMiddleware(),
  subscriptionController.getSubscription
);

// PUT /subscriptions/:subscriptionId/pause - Pausar assinatura
router.put(
  "/:subscriptionId/pause",
  supabaseAuthMiddleware(),
  subscriptionController.pauseSubscription
);

// PUT /subscriptions/:subscriptionId/cancel - Cancelar assinatura
router.put(
  "/:subscriptionId/cancel",
  supabaseAuthMiddleware(),
  subscriptionController.cancelSubscription
);

// PUT /subscriptions/:subscriptionId/reactivate - Reativar assinatura
router.put(
  "/:subscriptionId/reactivate",
  supabaseAuthMiddleware(),
  subscriptionController.reactivateSubscription
);

export default router;

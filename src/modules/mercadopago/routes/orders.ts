import { Router } from "express";
import { OrdersController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();
const ordersController = new OrdersController();

/**
 * Rotas para gerenciamento de Orders do MercadoPago
 * Todas as rotas requerem autenticação
 */

// POST /orders - Criar nova order
router.post("/", supabaseAuthMiddleware(), ordersController.createOrder);

// GET /orders/:orderId - Obter informações de uma order
router.get("/:orderId", supabaseAuthMiddleware(), ordersController.getOrder);

// PUT /orders/:orderId/cancel - Cancelar uma order
router.put(
  "/:orderId/cancel",
  supabaseAuthMiddleware(),
  ordersController.cancelOrder
);

// POST /orders/:orderId/refund - Processar reembolso de uma order
router.post(
  "/:orderId/refund",
  supabaseAuthMiddleware(),
  ordersController.refundOrder
);

export default router;

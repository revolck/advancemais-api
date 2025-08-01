import { Router } from "express";
import { OrdersController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas para Orders do MercadoPago - CORRIGIDO
 * Endpoints para gerenciamento de pagamentos únicos
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2
 */
const router = Router();
const ordersController = new OrdersController();

/**
 * Informações sobre orders
 * GET /orders
 */
router.get("/", (req, res) => {
  res.json({
    message: "MercadoPago Orders API",
    endpoints: {
      create: "POST /",
      get: "GET /:orderId",
      cancel: "PUT /:orderId/cancel",
      refund: "POST /:orderId/refund",
    },
  });
});

/**
 * Criar nova order
 * POST /orders
 */
router.post("/", supabaseAuthMiddleware(), ordersController.createOrder);

/**
 * Obter informações de uma order
 * GET /orders/:orderId
 */
router.get("/:orderId", supabaseAuthMiddleware(), ordersController.getOrder);

/**
 * Cancelar uma order
 * PUT /orders/:orderId/cancel
 */
router.put(
  "/:orderId/cancel",
  supabaseAuthMiddleware(),
  ordersController.cancelOrder
);

/**
 * Processar reembolso de uma order
 * POST /orders/:orderId/refund
 */
router.post(
  "/:orderId/refund",
  supabaseAuthMiddleware(),
  ordersController.refundOrder
);

export { router as ordersRoutes };

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
/**
 * @openapi
 * /api/v1/mercadopago/orders:
 *   get:
 *     summary: Informações gerais sobre orders
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Detalhes das rotas de orders
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
/**
 * @openapi
 * /api/v1/mercadopago/orders:
 *   post:
 *     summary: Criar nova order
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Order criada
 */
router.post("/", supabaseAuthMiddleware(), ordersController.createOrder);

/**
 * Obter informações de uma order
 * GET /orders/:orderId
 */
/**
 * @openapi
 * /api/v1/mercadopago/orders/{orderId}:
 *   get:
 *     summary: Obter informações de uma order
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados da order
 */
router.get("/:orderId", supabaseAuthMiddleware(), ordersController.getOrder);

/**
 * Cancelar uma order
 * PUT /orders/:orderId/cancel
 */
/**
 * @openapi
 * /api/v1/mercadopago/orders/{orderId}/cancel:
 *   put:
 *     summary: Cancelar uma order
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order cancelada
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
/**
 * @openapi
 * /api/v1/mercadopago/orders/{orderId}/refund:
 *   post:
 *     summary: Processar reembolso de uma order
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reembolso processado
 */
router.post(
  "/:orderId/refund",
  supabaseAuthMiddleware(),
  ordersController.refundOrder
);

export { router as ordersRoutes };

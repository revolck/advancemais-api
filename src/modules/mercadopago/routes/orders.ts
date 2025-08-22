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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/orders"
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               total_amount:
 *                 type: number
 *                 example: 100
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "1" }
 *                     title: { type: string, example: "Produto" }
 *                     quantity: { type: integer, example: 1 }
 *                     unit_price: { type: number, example: 100 }
 *                     currency_id: { type: string, example: "BRL" }
 *               payments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     payment_method_id: { type: string, example: "pix" }
 *                     payment_type_id: { type: string, example: "instant_payment" }
 *                     payer:
 *                       type: object
 *                       properties:
 *                         email: { type: string, example: "user@example.com" }
 *     responses:
 *       201:
 *         description: Order criada
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/mercadopago/orders" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"total_amount":100,"items":[{"id":"1","title":"Produto","quantity":1,"unit_price":100,"currency_id":"BRL"}],"payments":[{"payment_method_id":"pix","payment_type_id":"instant_payment","payer":{"email":"user@example.com"}}]}'
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/mercadopago/orders/{orderId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/mercadopago/orders/{orderId}/cancel" \\
 *            -H "Authorization: Bearer <TOKEN>"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/mercadopago/orders/{orderId}/refund" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"amount":100}'
 */
router.post(
  "/:orderId/refund",
  supabaseAuthMiddleware(),
  ordersController.refundOrder
);

export { router as ordersRoutes };

import { Router } from "express";
import { ConfigController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas para configurações do MercadoPago - CORRIGIDO
 * Endpoints para configuração e informações do módulo
 *
 * @author Sistema Advance+
 * @version 3.0.2
 */
const router = Router();
const configController = new ConfigController();

/**
 * Informações sobre configurações
 * GET /config
 */
/**
 * @openapi
 * /api/v1/mercadopago/config:
 *   get:
 *     summary: Informações de configuração do MercadoPago
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Detalhes das rotas de configuração
 */
router.get("/", (req, res) => {
  res.json({
    message: "MercadoPago Config API",
    endpoints: {
      publicKey: "GET /public-key",
      paymentMethods: "GET /payment-methods",
      accountInfo: "GET /account-info (ADMIN)",
      testConnection: "GET /test-connection (ADMIN)",
    },
  });
});

/**
 * Obter chave pública (rota pública para frontend)
 * GET /config/public-key
 */
/**
 * @openapi
 * /api/v1/mercadopago/config/public-key:
 *   get:
 *     summary: Obter chave pública
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Chave pública retornada
 */
router.get("/public-key", configController.getPublicKey);

/**
 * Obter métodos de pagamento (rota pública)
 * GET /config/payment-methods
 */
/**
 * @openapi
 * /api/v1/mercadopago/config/payment-methods:
 *   get:
 *     summary: Listar métodos de pagamento
 *     tags: [MercadoPago]
 *     responses:
 *       200:
 *         description: Métodos de pagamento
 */
router.get("/payment-methods", configController.getPaymentMethods);

/**
 * Obter informações da conta (apenas ADMIN/FINANCEIRO)
 * GET /config/account-info
 */
router.get(
  "/account-info",
  supabaseAuthMiddleware(["ADMIN", "FINANCEIRO"]),
  configController.getAccountInfo
);
/**
 * @openapi
 * /api/v1/mercadopago/config/account-info:
 *   get:
 *     summary: Obter informações da conta MercadoPago
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informações da conta
 */

/**
 * Testar conexão (apenas ADMIN/FINANCEIRO)
 * GET /config/test-connection
 */
router.get(
  "/test-connection",
  supabaseAuthMiddleware(["ADMIN", "FINANCEIRO"]),
  configController.testConnection
);
/**
 * @openapi
 * /api/v1/mercadopago/config/test-connection:
 *   get:
 *     summary: Testar conexão com MercadoPago
 *     tags: [MercadoPago]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conexão bem-sucedida
 */

export { router as configRoutes };

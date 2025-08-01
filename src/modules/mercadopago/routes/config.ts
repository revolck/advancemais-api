import { Router } from "express";
import { ConfigController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas para configurações do MercadoPago - CORRIGIDO
 * Endpoints para configuração e informações do módulo
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2
 */
const router = Router();
const configController = new ConfigController();

/**
 * Informações sobre configurações
 * GET /config
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
router.get("/public-key", configController.getPublicKey);

/**
 * Obter métodos de pagamento (rota pública)
 * GET /config/payment-methods
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
 * Testar conexão (apenas ADMIN/FINANCEIRO)
 * GET /config/test-connection
 */
router.get(
  "/test-connection",
  supabaseAuthMiddleware(["ADMIN", "FINANCEIRO"]),
  configController.testConnection
);

export { router as configRoutes };

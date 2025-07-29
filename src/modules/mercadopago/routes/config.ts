import { Router } from "express";
import { ConfigController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();
const configController = new ConfigController();

/**
 * Rotas para configurações do MercadoPago
 */

// GET /config/public-key - Obter chave pública (rota pública para frontend)
router.get("/public-key", configController.getPublicKey);

// GET /config/payment-methods - Obter métodos de pagamento (rota pública)
router.get("/payment-methods", configController.getPaymentMethods);

// GET /config/account-info - Obter informações da conta (apenas ADMIN/FINANCEIRO)
router.get(
  "/account-info",
  supabaseAuthMiddleware(["ADMIN", "FINANCEIRO"]),
  configController.getAccountInfo
);

// GET /config/test-connection - Testar conexão (apenas ADMIN/FINANCEIRO)
router.get(
  "/test-connection",
  supabaseAuthMiddleware(["ADMIN", "FINANCEIRO"]),
  configController.testConnection
);

export default router;

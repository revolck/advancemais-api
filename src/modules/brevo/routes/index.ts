import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas simplificadas do módulo Brevo
 *
 * @author Sistema AdvanceMais
 * @version 5.0.1 - Adição de teste de SMS
 */
const router = Router();
const brevoController = new BrevoController();

/**
 * Informações do módulo
 * GET /brevo
 */
router.get("/", brevoController.getModuleInfo);

/**
 * Health check
 * GET /brevo/health
 */
router.get("/health", brevoController.healthCheck);

/**
 * Estatísticas (apenas para admins)
 * GET /brevo/stats
 */
router.get(
  "/stats",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.getStatistics
);

/**
 * Testes de desenvolvimento
 */
if (process.env.NODE_ENV !== "production") {
  /**
   * Teste de email
   * POST /brevo/test/email
   */
  router.post("/test/email", brevoController.testEmail);

  /**
   * Teste de SMS
   * POST /brevo/test/sms
   */
  router.post("/test/sms", brevoController.testSMS);
}

export { router as brevoRoutes };

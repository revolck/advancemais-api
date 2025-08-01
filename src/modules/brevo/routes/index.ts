import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas do módulo Brevo - CORRIGIDO
 * API RESTful para comunicação via email e SMS
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2
 */
const router = Router();
const brevoController = new BrevoController();

/**
 * Informações do módulo
 * GET /brevo
 */
router.get("/", (req, res) => {
  res.json({
    module: "Brevo Communication Module",
    version: "3.0.2",
    status: "active",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      config: "GET /config (ADMIN)",
      stats: "GET /stats (ADMIN/MODERADOR)",
      testEmail: "POST /test/email (development)",
      testSMS: "POST /test/sms (development)",
    },
  });
});

/**
 * Health check
 * GET /brevo/health
 */
router.get("/health", brevoController.healthCheck);

/**
 * Configurações (apenas ADMIN)
 * GET /brevo/config
 */
router.get(
  "/config",
  supabaseAuthMiddleware(["ADMIN"]),
  brevoController.getConfig
);

/**
 * Estatísticas (ADMIN e MODERADOR)
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
  router.post("/test/email", brevoController.testEmail);
  router.post("/test/sms", brevoController.testSMS);
}

export { router as brevoRoutes };

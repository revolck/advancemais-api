import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

/**
 * Rotas do módulo Brevo
 * API RESTful para comunicação via email e SMS
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
const router = Router();

// Instancia controller
const brevoController = new BrevoController();

/**
 * Informações do módulo
 * GET /brevo
 */
router.get("/", (req, res) => {
  res.json({
    module: "Brevo Communication Module",
    version: "3.0.0",
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
  // POST /brevo/test/email
  router.post("/test/email", brevoController.testEmail);

  // POST /brevo/test/sms
  router.post("/test/sms", brevoController.testSMS);
}

/**
 * Middleware de tratamento de erros
 */
router.use((error: any, req: any, res: any, next: any) => {
  console.error("❌ Erro no módulo Brevo:", error);

  res.status(500).json({
    module: "brevo",
    message: "Erro interno do módulo",
    error:
      process.env.NODE_ENV === "development" ? error.message : "Erro interno",
    timestamp: new Date().toISOString(),
  });
});

export default router;

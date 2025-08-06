import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { EmailVerificationController } from "../controllers/email-verification-controller";
import { prisma } from "../../../config/prisma";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();

const brevoController = new BrevoController();
const emailVerificationController = new EmailVerificationController();

router.get("/", brevoController.getModuleInfo);
router.get("/health", brevoController.healthCheck);
router.get(
  "/config",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.getConfigStatus
);
router.get("/verificar-email", emailVerificationController.verifyEmail);
router.post(
  "/reenviar-verificacao",
  emailVerificationController.resendVerification
);
router.get(
  "/status-verificacao/:userId",
  emailVerificationController.getVerificationStatus
);

router.get(
  "/status/:email",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email é obrigatório",
          code: "MISSING_EMAIL",
        });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          emailVerificado: true,
          status: true,
          emailVerificationTokenExp: true,
        },
      });

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
          code: "USER_NOT_FOUND",
        });
      }

      const hasValidToken = usuario.emailVerificationTokenExp
        ? usuario.emailVerificationTokenExp > new Date()
        : false;

      res.json({
        success: true,
        data: {
          userId: usuario.id,
          email: usuario.email,
          emailVerified: usuario.emailVerificado,
          accountStatus: usuario.status,
          hasValidToken,
          tokenExpiration: usuario.emailVerificationTokenExp,
        },
      });
    } catch (error) {
      console.error("❌ Erro ao buscar status por email:", error);
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor",
        code: "INTERNAL_ERROR",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

router.post(
  "/test/email",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.testEmail
);
router.post(
  "/test/sms",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.testSMS
);
router.get("/verificar", emailVerificationController.verifyEmail);
router.post("/reenviar", emailVerificationController.resendVerification);

router.use((err: any, req: any, res: any, next: any) => {
  const correlationId = req.headers["x-correlation-id"] || "unknown";
  const errorId = `brevo-err-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)}`;

  console.error(`❌ [${correlationId}] Erro no módulo Brevo:`, {
    errorId,
    method: req.method,
    path: req.path,
    error: err.message || err,
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Erro interno no módulo Brevo",
    code: err.code || "BREVO_ERROR",
    errorId,
    correlationId,
    timestamp: new Date().toISOString(),
  });
});

export { router as brevoRoutes };
export default router;

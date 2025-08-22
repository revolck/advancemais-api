import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { EmailVerificationController } from "../controllers/email-verification-controller";
import { prisma } from "../../../config/prisma";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();

const brevoController = new BrevoController();
const emailVerificationController = new EmailVerificationController();

/**
 * @openapi
 * /api/v1/brevo:
 *   get:
 *     summary: Informações do módulo Brevo
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 */
router.get("/", brevoController.getModuleInfo);

/**
 * @openapi
 * /api/v1/brevo/health:
 *   get:
 *     summary: Health check do módulo Brevo
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Status de saúde
 */
router.get("/health", brevoController.healthCheck);
/**
 * @openapi
 * /api/v1/brevo/config:
 *   get:
 *     summary: Obter status de configuração do Brevo
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do Brevo
 */
router.get(
  "/config",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.getConfigStatus
);
/**
 * @openapi
 * /api/v1/brevo/verificar-email:
 *   get:
 *     summary: Verificar email de usuário
 *     tags: [Brevo]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verificado
 */
router.get("/verificar-email", emailVerificationController.verifyEmail);
/**
 * @openapi
 * /api/v1/brevo/reenviar-verificacao:
 *   post:
 *     summary: Reenviar email de verificação
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Email reenviado
 */
router.post(
  "/reenviar-verificacao",
  emailVerificationController.resendVerification
);
router.get(
  "/status-verificacao/:userId",
  emailVerificationController.getVerificationStatus
);

/**
 * @openapi
 * /api/v1/brevo/status-verificacao/{userId}:
 *   get:
 *     summary: Consultar status de verificação de email
 *     tags: [Brevo]
  *     parameters:
  *       - in: path
  *         name: userId
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       200:
  *         description: Status retornado
 */

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

/**
 * @openapi
 * /api/v1/brevo/status/{email}:
 *   get:
 *     summary: Consultar status por email
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status do usuário
 */

router.post(
  "/test/email",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.testEmail
);

/**
 * @openapi
 * /api/v1/brevo/test/email:
 *   post:
 *     summary: Enviar email de teste
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email enviado
 */
router.post(
  "/test/sms",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  brevoController.testSMS
);

/**
 * @openapi
 * /api/v1/brevo/test/sms:
 *   post:
 *     summary: Enviar SMS de teste
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SMS enviado
 */
router.get("/verificar", emailVerificationController.verifyEmail);
router.post("/reenviar", emailVerificationController.resendVerification);

/**
 * @openapi
 * /api/v1/brevo/verificar:
 *   get:
 *     summary: Verificar email (alias)
 *     tags: [Brevo]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verificado
 * /api/v1/brevo/reenviar:
 *   post:
 *     summary: Reenviar verificação (alias)
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Reenvio realizado
 */

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

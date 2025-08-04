import { Router } from "express";
import { BrevoController } from "../controllers/brevo-controller";
import { EmailVerificationController } from "../controllers/email-verification-controller";
import { prisma } from "../../../config/prisma";

/**
 * Rotas do módulo Brevo
 * Endpoints para email, verificação e testes
 *
 * @author Sistema AdvanceMais
 * @version 7.2.0 - CORRIGIDO - Import com extensão .js
 */
const router = Router();

// Instâncias dos controllers
const brevoController = new BrevoController();
const emailVerificationController = new EmailVerificationController();

// ===========================
// ROTAS DE STATUS E HEALTH
// ===========================

/**
 * Informações do módulo
 * GET /brevo
 */
router.get("/", brevoController.getModuleInfo);

/**
 * Health check do módulo
 * GET /brevo/health
 */
router.get("/health", brevoController.healthCheck);

/**
 * Status da configuração (desenvolvimento)
 * GET /brevo/config
 */
router.get("/config", brevoController.getConfigStatus);

// ===========================
// ROTAS DE VERIFICAÇÃO DE EMAIL
// ===========================

/**
 * Verifica token de email
 * GET /brevo/verificar-email?token=xxx
 */
router.get("/verificar-email", emailVerificationController.verifyEmail);

/**
 * Reenvia email de verificação
 * POST /brevo/reenviar-verificacao
 * Body: { email: string }
 */
router.post(
  "/reenviar-verificacao",
  emailVerificationController.resendVerification
);

/**
 * Status de verificação do usuário
 * GET /brevo/status-verificacao/:userId
 */
router.get(
  "/status-verificacao/:userId",
  emailVerificationController.getVerificationStatus
);

/**
 * Rota alternativa para compatibilidade
 * GET /brevo/status/:email
 */
router.get("/status/:email", async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email é obrigatório",
        code: "MISSING_EMAIL",
      });
    }

    // Busca usuário pelo email
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
});

// ===========================
// ROTAS DE TESTE (APENAS DESENVOLVIMENTO)
// ===========================

/**
 * Teste de email (apenas desenvolvimento)
 * POST /brevo/test/email
 * Body: { email: string, name?: string, type?: string }
 */
router.post("/test/email", brevoController.testEmail);

/**
 * Teste de SMS (apenas desenvolvimento)
 * POST /brevo/test/sms
 * Body: { to: string, message?: string }
 */
router.post("/test/sms", brevoController.testSMS);

// ===========================
// ROTAS DE CONVENIÊNCIA
// ===========================

/**
 * Rota simplificada para verificação (sem /brevo/)
 * GET /verificar?token=xxx
 */
router.get("/verificar", emailVerificationController.verifyEmail);

/**
 * Rota simplificada para reenvio (sem /brevo/)
 * POST /reenviar
 */
router.post("/reenviar", emailVerificationController.resendVerification);

// ===========================
// MIDDLEWARE DE TRATAMENTO DE ERROS
// ===========================

/**
 * Middleware de tratamento de erros específico para Brevo
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
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  // Resposta de erro padronizada
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Erro interno no módulo Brevo",
    code: err.code || "BREVO_ERROR",
    errorId,
    correlationId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
});

export { router as brevoRoutes };
export default router;

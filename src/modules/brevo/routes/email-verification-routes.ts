import { Router } from "express";
import { EmailVerificationController } from "../controllers/email-verification-controller";

/**
 * Rotas para verificação de email
 * Endpoints públicos para confirmação de conta
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Sistema completo de verificação
 */
const router = Router();
const emailVerificationController = new EmailVerificationController();

/**
 * Verifica email através de token
 * GET /verificar-email?token=xxx
 */
router.get("/", emailVerificationController.verifyEmail);

/**
 * Reenvia email de verificação
 * POST /reenviar-verificacao
 */
router.post("/reenviar", emailVerificationController.resendVerification);

/**
 * Verifica status de verificação
 * GET /status/:email
 */
router.get(
  "/status/:email",
  emailVerificationController.checkVerificationStatus
);

export { router as emailVerificationRoutes };

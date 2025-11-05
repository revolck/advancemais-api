import { Router } from 'express';
import { EmailVerificationController } from '../controllers/email-verification-controller';

/**
 * Rotas para verificação de email
 * Endpoints públicos para confirmação de conta
 */
const router = Router();
const UsuariosVerificacaoEmailController = new EmailVerificationController();

/**
 * Verifica email através de token
 * GET /verificar-email?token=xxx
 */
router.get('/', UsuariosVerificacaoEmailController.verifyEmail);

/**
 * Reenvia email de verificação
 * POST /reenviar-verificacao
 */
router.post('/reenviar', UsuariosVerificacaoEmailController.resendVerification);

/**
 * Verifica status de verificação
 * GET /status/:email
 */
router.get('/status/:email', UsuariosVerificacaoEmailController.checkVerificationStatus);

export { router as UsuariosVerificacaoEmailRoutes };

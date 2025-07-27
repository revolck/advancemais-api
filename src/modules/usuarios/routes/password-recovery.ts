import { Router } from "express";
import { PasswordRecoveryController } from "../controllers/password-recovery-controller";

const router = Router();
const passwordRecoveryController = new PasswordRecoveryController();

/**
 * Rotas públicas para recuperação de senha
 */

// POST /recuperar-senha - Solicita recuperação de senha
router.post("/", passwordRecoveryController.solicitarRecuperacao);

// GET /recuperar-senha/validar/:token - Valida token de recuperação
router.get("/validar/:token", passwordRecoveryController.validarToken);

// POST /recuperar-senha/redefinir - Redefine senha com token
router.post("/redefinir", passwordRecoveryController.redefinirSenha);

export default router;

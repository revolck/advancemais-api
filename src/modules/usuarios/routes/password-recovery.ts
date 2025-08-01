/**
 * Rotas de recuperação de senha
 * Responsabilidade única: reset de senha via email
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
import { Router } from "express";
import { PasswordRecoveryController } from "../controllers/password-recovery-controller";

const router = Router();
const passwordRecoveryController = new PasswordRecoveryController();

/**
 * Rotas públicas para recuperação de senha
 */

/**
 * Solicita recuperação de senha
 * POST /recuperar-senha
 */
router.post("/", passwordRecoveryController.solicitarRecuperacao);

/**
 * Valida token de recuperação
 * GET /recuperar-senha/validar/:token
 */
router.get("/validar/:token", passwordRecoveryController.validarToken);

/**
 * Redefine senha com token
 * POST /recuperar-senha/redefinir
 */
router.post("/redefinir", passwordRecoveryController.redefinirSenha);

export default router;

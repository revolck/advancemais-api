/**
 * Rotas de recuperação de senha - CORRIGIDO
 * Responsabilidade única: reset de senha via email
 *
 * @author Sistema AdvanceMais
 * @version 3.0.3 - Correção path-to-regexp
 */
import { Router } from "express";
import { PasswordRecoveryController } from "../controllers/password-recovery-controller";

const router = Router();
const passwordRecoveryController = new PasswordRecoveryController();

/**
 * Solicita recuperação de senha
 * POST /recuperar-senha
 */
router.post("/", passwordRecoveryController.solicitarRecuperacao);

/**
 * Valida token de recuperação - ROTA CORRIGIDA
 * GET /recuperar-senha/validar/:token
 */
router.get(
  "/validar/:token([a-fA-F0-9]{64})",
  passwordRecoveryController.validarToken
);

/**
 * Redefine senha com token
 * POST /recuperar-senha/redefinir
 */
router.post("/redefinir", passwordRecoveryController.redefinirSenha);

export default router;

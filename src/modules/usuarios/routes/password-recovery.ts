import { Router } from "express";
import { PasswordRecoveryController } from "../controllers/password-recovery-controller";

/**
 * Rotas para recuperação de senha - CORRIGIDAS
 * Endpoints públicos para reset de senha
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
const router = Router();
const passwordRecoveryController = new PasswordRecoveryController();

/**
 * Informações sobre recuperação de senha
 * GET /recuperar-senha
 */
router.get("/", (req, res) => {
  res.json({
    message: "Módulo de recuperação de senha",
    endpoints: {
      request: "POST /",
      validate: "GET /validar/:token",
      reset: "POST /redefinir",
    },
  });
});

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

/**
 * Rotas de recuperação de senha - CORRIGIDO
 * Responsabilidade única: reset de senha via email
 *
 * @author Sistema Advance+
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
/**
 * @openapi
 * /api/v1/usuarios/recuperar-senha:
 *   post:
 *     summary: Solicitar recuperação de senha
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: "user@example.com" }
 *     responses:
 *       200:
 *         description: Solicitação enviada
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/recuperar-senha" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */
router.post("/", passwordRecoveryController.solicitarRecuperacao);

/**
 * Valida token de recuperação - ROTA CORRIGIDA
 * GET /recuperar-senha/validar/:token
 */
/**
 * @openapi
 * /api/v1/usuarios/recuperar-senha/validar/{token}:
 *   get:
 *     summary: Validar token de recuperação
 *     tags: [Usuários]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token válido
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/recuperar-senha/validar/{token}"
 */
router.get(
  "/validar/:token([a-fA-F0-9]{64})",
  passwordRecoveryController.validarToken
);

/**
 * Redefine senha com token
 * POST /recuperar-senha/redefinir
 */
/**
 * @openapi
 * /api/v1/usuarios/recuperar-senha/redefinir:
 *   post:
 *     summary: Redefinir senha utilizando token
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string, example: "<token>" }
 *               novaSenha: { type: string, example: "senha123" }
 *     responses:
 *       200:
 *         description: Senha redefinida
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/recuperar-senha/redefinir" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"token":"<token>","novaSenha":"senha123"}'
 */
router.post("/redefinir", passwordRecoveryController.redefinirSenha);

export default router;

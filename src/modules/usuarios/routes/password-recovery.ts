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
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Solicitação enviada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: {
 *                   type: string,
 *                   example: "E-mail de recuperação enviado"
 *                 }
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "E-mail inválido"
 *               code: "VALIDATION_ERROR"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Usuário não encontrado"
 *               code: "NOT_FOUND"
 *       429:
 *         description: Muitas tentativas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Muitas tentativas. Tente novamente mais tarde"
 *               code: "RATE_LIMIT_EXCEEDED"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
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
 *         example: "<token>"
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Token válido" }
 *       400:
 *         description: Token em formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Token inválido"
 *               code: "VALIDATION_ERROR"
 *       404:
 *         description: Token não encontrado ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Token não encontrado"
 *               code: "NOT_FOUND"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
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
 *             required:
 *               - token
 *               - novaSenha
 *             properties:
 *               token:
 *                 type: string
 *                 example: "<token>"
 *               novaSenha:
 *                 type: string
 *                 format: password
 *                 example: "senha123"
 *     responses:
 *       200:
 *         description: Senha redefinida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Senha alterada com sucesso" }
 *       400:
 *         description: Dados inválidos ou token incorreto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Token inválido"
 *               code: "VALIDATION_ERROR"
 *       404:
 *         description: Token não encontrado ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Token não encontrado"
 *               code: "NOT_FOUND"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
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

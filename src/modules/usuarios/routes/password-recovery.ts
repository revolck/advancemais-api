/**
 * Rotas de recuperação de senha - CORRIGIDO
 * Responsabilidade única: reset de senha via email
 *
 * @author Sistema Advance+
 * @version 3.0.3 - Correção path-to-regexp
 */
import { Router } from 'express';
import { PasswordRecoveryController } from '../controllers/password-recovery-controller';

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
 *     summary: Solicitar recuperação de senha por email, CPF ou CNPJ
 *     description: |
 *       Inicia o fluxo de recuperação de senha e registra tentativas no recurso `UsuarioRecuperacaoSenha`.
 *       O token é enviado por e-mail e expira conforme a configuração `passwordRecovery.tokenExpirationMinutes`.
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identificador:
 *                 type: string
 *                 description: Email, CPF ou CNPJ associado à conta
 *                 example: "user@example.com"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Alternativa para enviar diretamente o email cadastrado
 *                 example: "user@example.com"
 *               cpf:
 *                 type: string
 *                 description: CPF com ou sem máscara
 *                 example: "12345678909"
 *               cnpj:
 *                 type: string
 *                 description: CNPJ com ou sem máscara
 *                 example: "12345678000199"
 *             oneOf:
 *               - required:
 *                   - identificador
 *               - required:
 *                   - email
 *               - required:
 *                   - cpf
 *               - required:
 *                   - cnpj
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
 *               message: "Informe um email, CPF ou CNPJ válido"
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
 *            -d '{"identificador":"user@example.com"}'
 *       - lang: cURL
 *         label: Exemplo com CPF
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/recuperar-senha" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"cpf":"123.456.789-09"}'
 */
router.post('/', passwordRecoveryController.solicitarRecuperacao);

/**
 * Valida token de recuperação - ROTA CORRIGIDA
 * GET /recuperar-senha/validar/:token
 */
/**
 * @openapi
 * /api/v1/usuarios/recuperar-senha/validar/{token}:
 *   get:
 *     summary: Validar token de recuperação
 *     description: |
 *       Consulta a entidade `UsuarioRecuperacaoSenha` para confirmar se o token ainda é válido e não expirou.
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
router.get('/validar/:token([a-fA-F0-9]{64})', passwordRecoveryController.validarToken);

/**
 * Redefine senha com token
 * POST /recuperar-senha/redefinir
 */
/**
 * @openapi
 * /api/v1/usuarios/recuperar-senha/redefinir:
 *   post:
 *     summary: Redefinir senha utilizando token
 *     description: |
 *       Consome o token persistido em `UsuarioRecuperacaoSenha`, atualiza a senha do usuário e limpa o estado de recuperação.
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
router.post('/redefinir', passwordRecoveryController.redefinirSenha);

export default router;

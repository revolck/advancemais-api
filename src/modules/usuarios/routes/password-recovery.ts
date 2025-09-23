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
 *             $ref: '#/components/schemas/UserPasswordRecoveryRequest'
 *     responses:
 *       200:
 *         description: Solicitação enviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPasswordRecoveryResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Informe um email, CPF ou CNPJ para recuperar a senha"
 *             examples:
 *               identificadorAusente:
 *                 summary: Nenhum identificador enviado
 *                 value:
 *                   message: "Informe um email, CPF ou CNPJ para recuperar a senha"
 *               documentoInvalido:
 *                 summary: Documento sem formato válido
 *                 value:
 *                   message: "Identificador deve ser um email válido, CPF (11 dígitos) ou CNPJ (14 dígitos)"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Usuário não encontrado com este identificador" }
 *       429:
 *         description: Muitas tentativas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Muitas tentativas de recuperação. Tente novamente em 15 minutos"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Erro interno ao enviar email de recuperação" }
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
 *               $ref: '#/components/schemas/UserPasswordRecoveryValidateResponse'
 *       400:
 *         description: Token em formato inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Token é obrigatório" }
 *       404:
 *         description: Token não encontrado ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Token inválido ou expirado" }
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Erro interno do servidor" }
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
 *             $ref: '#/components/schemas/UserPasswordResetRequest'
 *     responses:
 *       200:
 *         description: Senha redefinida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPasswordResetResponse'
 *       400:
 *         description: Dados inválidos ou token incorreto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Token inválido ou expirado" }
 *                 detalhes:
 *                   type: array
 *                   items: { type: string }
 *                   example:
 *                     - "Senha deve conter pelo menos 8 caracteres"
 *       404:
 *         description: Token não encontrado ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Token expirado. Solicite uma nova recuperação" }
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Erro interno do servidor" }
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/recuperar-senha/redefinir" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"token":"<token>","novaSenha":"Senha@1234","confirmarSenha":"Senha@1234"}'
 */
router.post('/redefinir', passwordRecoveryController.redefinirSenha);

export default router;

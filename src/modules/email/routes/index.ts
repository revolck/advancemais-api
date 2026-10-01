import { Router } from 'express';
import { EmailController } from '../controllers/email-controller';
import { EmailVerificationController } from '../controllers/email-verification-controller';
import { prisma } from '../../../config/prisma';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { logger } from '@/utils/logger';
import {
  UsuariosVerificacaoEmailSelect,
  normalizeEmailVerification,
} from '@/modules/usuarios/utils/email-verification';

const router = Router();

const emailController = new EmailController();
const UsuariosVerificacaoEmailController = new EmailVerificationController();
const emailRoutesLogger = logger.child({ module: 'EmailRoutes' });

/**
 * @openapi
 * /api/v1/email:
 *   get:
 *     summary: Informações do módulo de e-mail
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailModuleInfo"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email"
 */
router.get('/', emailController.getModuleInfo);

/**
 * @openapi
 * /api/v1/email/health:
 *   get:
 *     summary: Health check do módulo de e-mail (SMTP)
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Status de saúde
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailHealthResponse"
 *       503:
 *         description: Serviço indisponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailHealthResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/health"
 */
router.get('/health', emailController.healthCheck);
/**
 * @openapi
 * /api/v1/email/config:
 *   get:
 *     summary: Obter status de configuração do SMTP
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do SMTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailConfigStatus"
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/config" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/config',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  emailController.getConfigStatus,
);
/**
 * @openapi
 * /api/v1/email/verificar-email:
 *   get:
 *     summary: Verificar email de usuário
 *     tags: [Email]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Email verificado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailVerifyEmailResponse"
 *       400:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/verificar-email?token=TOKEN"
 */
router.get('/verificar-email', UsuariosVerificacaoEmailController.verifyEmail);
/**
 * @openapi
 * /api/v1/email/reenviar-verificacao:
 *   post:
 *     summary: Reenviar email de verificação
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EmailResendVerificationRequest"
 *     responses:
 *       200:
 *         description: Email reenviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailResendVerificationResponse"
 *       400:
 *         description: Requisição inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/email/reenviar-verificacao" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */
router.post('/reenviar-verificacao', UsuariosVerificacaoEmailController.resendVerification);
router.get('/status-verificacao/:userId', UsuariosVerificacaoEmailController.getVerificationStatus);

/**
 * @openapi
 * /api/v1/email/status-verificacao/{userId}:
 *   get:
 *     summary: Consultar status de verificação de email
 *     tags: [Email]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status retornado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailVerificationStatusResponse"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/status-verificacao/USER_ID"
 */

router.get('/status/:email', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), async (req, res) => {
  const log = emailRoutesLogger.child({
    correlationId: req.id,
    path: req.path,
    method: req.method,
  });

  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email é obrigatório',
        code: 'MISSING_EMAIL',
      });
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        status: true,
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
      },
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND',
      });
    }

    const verification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

    const hasValidToken = verification.emailVerificationTokenExp
      ? verification.emailVerificationTokenExp > new Date()
      : false;

    res.json({
      success: true,
      data: {
        userId: usuario.id,
        email: usuario.email,
        emailVerified: verification.emailVerificado,
        accountStatus: usuario.status,
        hasValidToken,
        tokenExpiration: verification.emailVerificationTokenExp,
        UsuariosVerificacaoEmail: {
          verified: verification.emailVerificado,
          verifiedAt: verification.emailVerificadoEm,
          tokenExpiration: verification.emailVerificationTokenExp,
          attempts: verification.emailVerificationAttempts,
          lastAttemptAt: verification.ultimaTentativaVerificacao,
        },
      },
    });
  } catch (error) {
    log.error({ err: error }, '❌ Erro ao buscar status por email');
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @openapi
 * /api/v1/email/status/{email}:
 *   get:
 *     summary: Consultar status por email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailVerificationStatusResponse"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/status/user%40example.com" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */

router.post('/sandbox/email', supabaseAuthMiddleware(['ADMIN']), emailController.sendSandboxEmail);

router.get(
  '/sandbox/email-rotinas',
  supabaseAuthMiddleware(['ADMIN']),
  emailController.listSandboxEmailRotinas,
);

router.post(
  '/test/email',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  emailController.testEmail,
);

/**
 * @openapi
 * /api/v1/email/test/email:
 *   post:
 *     summary: Enviar email de teste
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EmailTestEmailRequest"
 *     responses:
 *       200:
 *         description: Email enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailTestEmailResponse"
 *       400:
 *         description: Requisição inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       403:
 *         description: Bloqueado em produção
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/email/test/email" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */
router.get('/verificar', UsuariosVerificacaoEmailController.verifyEmail);
router.post('/reenviar', UsuariosVerificacaoEmailController.resendVerification);

/**
 * @openapi
 * /api/v1/email/verificar:
 *   get:
 *     summary: Verificar email (alias)
 *     tags: [Email]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verificado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailVerifyEmailResponse"
 *       400:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/email/verificar?token=TOKEN"
 * /api/v1/email/reenviar:
 *   post:
 *     summary: Reenviar verificação (alias)
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/EmailResendVerificationRequest"
 *     responses:
 *       200:
 *         description: Reenvio realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/EmailResendVerificationResponse"
 *       400:
 *         description: Requisição inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/ErrorResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/email/reenviar" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */

router.use((err: any, req: any, res: any, _next: any) => {
  const rawCorrelationId = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(rawCorrelationId)
    ? rawCorrelationId[0]
    : rawCorrelationId || req.id || 'unknown';
  const errorId = `email-err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const log = emailRoutesLogger.child({
    correlationId,
    path: req.path,
    method: req.method,
    errorId,
  });

  log.error({ err }, '❌ Erro no módulo de e-mail');

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno no módulo de e-mail',
    code: err.code || 'EMAIL_ERROR',
    errorId,
    correlationId,
    timestamp: new Date().toISOString(),
  });
});

export { router as emailRoutes };
export default router;

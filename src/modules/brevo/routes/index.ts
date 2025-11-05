import { Router } from 'express';
import { BrevoController } from '../controllers/brevo-controller';
import { EmailVerificationController } from '../controllers/email-verification-controller';
import { prisma } from '../../../config/prisma';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { logger } from '@/utils/logger';
import {
  UsuariosVerificacaoEmailSelect,
  normalizeEmailVerification,
} from '@/modules/usuarios/utils/email-verification';

const router = Router();

const brevoController = new BrevoController();
const UsuariosVerificacaoEmailController = new EmailVerificationController();
const brevoRoutesLogger = logger.child({ module: 'BrevoRoutes' });

/**
 * @openapi
 * /api/v1/brevo:
 *   get:
 *     summary: Informações do módulo Brevo
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoModuleInfo"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/brevo"
 */
router.get('/', brevoController.getModuleInfo);

/**
 * @openapi
 * /api/v1/brevo/health:
 *   get:
 *     summary: Health check do módulo Brevo
 *     tags: [Brevo]
 *     responses:
 *       200:
 *         description: Status de saúde
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoHealthResponse"
 *       503:
 *         description: Serviço indisponível
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoHealthResponse"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/brevo/health"
 */
router.get('/health', brevoController.healthCheck);
/**
 * @openapi
 * /api/v1/brevo/config:
 *   get:
 *     summary: Obter status de configuração do Brevo
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do Brevo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoConfigStatus"
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
 *           curl -X GET "http://localhost:3000/api/v1/brevo/config" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/config',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  brevoController.getConfigStatus,
);
/**
 * @openapi
 * /api/v1/brevo/verificar-email:
 *   get:
 *     summary: Verificar email de usuário
 *     tags: [Brevo]
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
 *               $ref: "#/components/schemas/BrevoVerifyEmailResponse"
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
 *           curl -X GET "http://localhost:3000/api/v1/brevo/verificar-email?token=TOKEN"
 */
router.get('/verificar-email', UsuariosVerificacaoEmailController.verifyEmail);
/**
 * @openapi
 * /api/v1/brevo/reenviar-verificacao:
 *   post:
 *     summary: Reenviar email de verificação
 *     tags: [Brevo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BrevoResendVerificationRequest"
 *     responses:
 *       200:
 *         description: Email reenviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoResendVerificationResponse"
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
 *           curl -X POST "http://localhost:3000/api/v1/brevo/reenviar-verificacao" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */
router.post('/reenviar-verificacao', UsuariosVerificacaoEmailController.resendVerification);
router.get('/status-verificacao/:userId', UsuariosVerificacaoEmailController.getVerificationStatus);

/**
 * @openapi
 * /api/v1/brevo/status-verificacao/{userId}:
 *   get:
 *     summary: Consultar status de verificação de email
 *     tags: [Brevo]
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
 *               $ref: "#/components/schemas/BrevoVerificationStatusResponse"
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
 *           curl -X GET "http://localhost:3000/api/v1/brevo/status-verificacao/USER_ID"
 */

router.get('/status/:email', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), async (req, res) => {
  const log = brevoRoutesLogger.child({
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
 * /api/v1/brevo/status/{email}:
 *   get:
 *     summary: Consultar status por email
 *     tags: [Brevo]
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
 *               $ref: "#/components/schemas/BrevoVerificationStatusResponse"
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
 *           curl -X GET "http://localhost:3000/api/v1/brevo/status/user%40example.com" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */

router.post(
  '/test/email',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  brevoController.testEmail,
);

/**
 * @openapi
 * /api/v1/brevo/test/email:
 *   post:
 *     summary: Enviar email de teste
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BrevoTestEmailRequest"
 *     responses:
 *       200:
 *         description: Email enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoTestEmailResponse"
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
 *           curl -X POST "http://localhost:3000/api/v1/brevo/test/email" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */
router.post('/test/sms', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), brevoController.testSMS);

/**
 * @openapi
 * /api/v1/brevo/test/sms:
 *   post:
 *     summary: Enviar SMS de teste
 *     tags: [Brevo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BrevoTestSMSRequest"
 *     responses:
 *       200:
 *         description: SMS enviado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoTestSMSResponse"
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
 *           curl -X POST "http://localhost:3000/api/v1/brevo/test/sms" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"to":"+5511999999999"}'
 */
router.get('/verificar', UsuariosVerificacaoEmailController.verifyEmail);
router.post('/reenviar', UsuariosVerificacaoEmailController.resendVerification);

/**
 * @openapi
 * /api/v1/brevo/verificar:
 *   get:
 *     summary: Verificar email (alias)
 *     tags: [Brevo]
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
 *               $ref: "#/components/schemas/BrevoVerifyEmailResponse"
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
 *           curl -X GET "http://localhost:3000/api/v1/brevo/verificar?token=TOKEN"
 * /api/v1/brevo/reenviar:
 *   post:
 *     summary: Reenviar verificação (alias)
 *     tags: [Brevo]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/BrevoResendVerificationRequest"
 *     responses:
 *       200:
 *         description: Reenvio realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/BrevoResendVerificationResponse"
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
 *           curl -X POST "http://localhost:3000/api/v1/brevo/reenviar" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"email":"user@example.com"}'
 */

router.use((err: any, req: any, res: any, _next: any) => {
  const rawCorrelationId = req.headers['x-correlation-id'];
  const correlationId = Array.isArray(rawCorrelationId)
    ? rawCorrelationId[0]
    : rawCorrelationId || req.id || 'unknown';
  const errorId = `brevo-err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const log = brevoRoutesLogger.child({
    correlationId,
    path: req.path,
    method: req.method,
    errorId,
  });

  log.error({ err }, '❌ Erro no módulo Brevo');

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno no módulo Brevo',
    code: err.code || 'BREVO_ERROR',
    errorId,
    correlationId,
    timestamp: new Date().toISOString(),
  });
});

export { router as brevoRoutes };
export default router;

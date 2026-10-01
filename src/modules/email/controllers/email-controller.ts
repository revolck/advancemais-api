import { Request, Response } from 'express';
import { EmailService } from '../services/email-service';
import { EmailDispatcher } from '../client/email-dispatcher';
import { EmailConfigManager, resolveEmailEnvironment } from '../config/email-config';
import { logger } from '../../../utils/logger';
import { emailSandboxService } from '../services/email-sandbox.service';

/**
 * Controller principal do módulo de e-mail (SMTP + Brevo)
 * Gerencia endpoints de status, testes e informações
 */
export class EmailController {
  private emailService: EmailService;
  private client: EmailDispatcher;
  private config: EmailConfigManager;

  constructor() {
    this.emailService = new EmailService();
    this.client = EmailDispatcher.getInstance();
    this.config = EmailConfigManager.getInstance();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: 'EmailController',
      correlationId: req.id,
    });
  }

  /**
   * Health check completo do módulo
   * GET /email/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      log.info('🔍 Executando health check dos canais de e-mail...');

      const [report, config] = await Promise.all([
        this.client.getHealthReport(),
        this.config.getRuntimeConfig(),
      ]);

      const overall = report.status !== 'unhealthy';
      const failing = report.providers.find((provider) => provider.configured && !provider.healthy);
      const lastIssue = failing?.lastIssue ?? null;
      const configuredProviders = report.providers.filter((provider) => provider.configured);

      const healthData = {
        status: report.status,
        module: 'email',
        configured: configuredProviders.length > 0,
        simulated: report.simulated,
        operational: configuredProviders.some((provider) => provider.healthy),
        timestamp: new Date().toISOString(),

        services: {
          email: overall ? 'operational' : 'degraded',
          ...Object.fromEntries(
            report.providers.map((provider) => [
              provider.name,
              !provider.configured
                ? 'not_configured'
                : provider.healthy
                  ? 'operational'
                  : 'degraded',
            ]),
          ),
        },
        providers: report.providers.map((provider) => ({
          name: provider.name,
          configured: provider.configured,
          healthy: provider.healthy,
          dailyLimit: provider.dailyLimit,
          usedToday: provider.usedToday,
          failureReason: provider.lastIssue?.failureReason ?? null,
        })),
        routing: report.routing,
        failureReason: report.status === 'healthy' ? null : lastIssue?.failureReason || 'UNKNOWN',
        lastError:
          report.status === 'healthy' || !lastIssue
            ? null
            : {
                provider: failing?.name,
                operation: lastIssue.operation,
                code: lastIssue.code,
                responseCode: lastIssue.responseCode,
                message: lastIssue.message,
                occurredAt: lastIssue.occurredAt,
              },

        configuration: {
          UsuariosVerificacaoEmailEnabled: config.UsuariosVerificacaoEmail.enabled,
          environment: config.environment,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          smtpHost: config.smtp.host,
          smtpPort: config.smtp.port,
          frontendUrl: config.urls.frontend,
        },

        features: {
          transactionalEmails: true,
          UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
        },
      };

      log.info(
        {
          status: healthData.status,
          configured: healthData.configured,
          simulated: healthData.simulated,
          failureReason: healthData.failureReason,
        },
        '✅ Health check concluído',
      );

      res.status(overall ? 200 : 503).json(healthData);
    } catch (error) {
      log.error({ err: error }, '❌ Erro no health check');

      res.status(503).json({
        status: 'unhealthy',
        module: 'email',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Informações do módulo
   * GET /email
   */
  public getModuleInfo = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const config = this.config.getConfig();

      res.json({
        module: 'Email Module (SMTP + Brevo)',
        version: '8.1.0',
        description: 'Sistema completo de comunicação e verificação de email',
        status: 'active',
        configured: config.isConfigured || config.brevo.isConfigured,
        simulated: !config.isConfigured && !config.brevo.isConfigured,
        providers: {
          smtp: config.isConfigured,
          brevo: config.brevo.isConfigured,
        },
        routing: config.routing,

        features: {
          transactionalEmails: true,
          UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
          templates: true,
        },

        services: ['email', 'verification'],

        endpoints: {
          health: 'GET /health',
          verification: {
            verify: 'GET /verificar-email?token=xxx',
            resend: 'POST /reenviar-verificacao',
            status: 'GET /status-verificacao/:userId',
          },
          testing: {
            email: 'POST /test/email (development only)',
          },
        },

        configuration: {
          environment: config.environment,
          UsuariosVerificacaoEmailEnabled: config.UsuariosVerificacaoEmail.enabled,
          tokenExpirationHours: config.UsuariosVerificacaoEmail.tokenExpirationHours,
          maxResendAttempts: config.UsuariosVerificacaoEmail.maxResendAttempts,
          resendCooldownMinutes: config.UsuariosVerificacaoEmail.resendCooldownMinutes,
        },

        urls: config.urls,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao buscar informações do módulo');

      res.status(500).json({
        error: 'Erro ao buscar informações do módulo',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * POST /email/test/email
   * Body: { email: string, name?: string, type?: string }
   */
  public testEmail = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    // Bloqueio em produção
    if (resolveEmailEnvironment() === 'production') {
      res.status(403).json({
        success: false,
        message: 'Testes não disponíveis em produção',
        code: 'PRODUCTION_BLOCKED',
      });
      return;
    }

    try {
      const { email, name, type = 'welcome' } = req.body;

      // Validação
      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email é obrigatório',
          code: 'MISSING_EMAIL',
        });
        return;
      }

      if (!this.isValidEmail(email)) {
        res.status(400).json({
          success: false,
          message: 'Formato de email inválido',
          code: 'INVALID_EMAIL',
        });
        return;
      }

      log.info({ type, email }, '🧪 Teste de email');

      const testUserData = {
        id: `test_user_${Date.now()}`, // Prefixo especial para detecção
        email: email.toLowerCase().trim(),
        nomeCompleto: name || 'Usuário Teste',
        tipoUsuario: 'PESSOA_FISICA',
      };

      log.info({ testUserId: testUserData.id }, '🧪 Enviando teste de email');

      // Envia email usando o sistema normal (mas detectará como teste)
      const result = await this.emailService.sendWelcomeEmail(testUserData);

      log.info({ result }, '📧 Resultado do teste de email');

      res.json({
        success: result.success,
        message: `Teste de email ${type} executado`,
        data: {
          type,
          recipient: email,
          simulated: result.simulated,
          messageId: result.messageId,
          error: result.error,
          testUser: testUserData.id, // Para debug
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro no teste de email');

      res.status(500).json({
        success: false,
        message: 'Erro no teste de email',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      });
    }
  };

  public listSandboxEmailRotinas = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      res.json({
        success: true,
        data: emailSandboxService.listRotinas(),
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao listar rotinas de email sandbox');
      res.status(500).json({
        success: false,
        message: 'Erro ao listar rotinas de email sandbox',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        code: 'INTERNAL_ERROR',
      });
    }
  };

  public sendSandboxEmail = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const result = await emailSandboxService.sendSandboxEmail(req.user?.id, req.body ?? {}, {
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });

      res.json({
        success: true,
        message: 'Email de sandbox enviado com sucesso',
        data: result,
      });
    } catch (error) {
      const statusCode = Number((error as any)?.statusCode || (error as any)?.status || 500);
      const code = (error as any)?.code || 'INTERNAL_ERROR';
      const message = error instanceof Error ? error.message : 'Erro ao enviar email de sandbox';

      log.error({ err: error, statusCode, code }, '❌ Erro ao enviar email sandbox');
      res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
        success: false,
        message,
        code,
      });
    }
  };

  /**
   * Status da configuração (desenvolvimento)
   * GET /email/config
   */
  public getConfigStatus = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    if (resolveEmailEnvironment() === 'production') {
      res.status(403).json({
        message: 'Informações de configuração não disponíveis em produção',
      });
      return;
    }

    try {
      const config = await this.config.getRuntimeConfig();
      const healthInfo = this.config.getHealthInfo();

      res.json({
        module: 'Email Configuration Status',
        timestamp: new Date().toISOString(),

        configuration: {
          isConfigured: config.isConfigured,
          environment: config.environment,
          smtpHost: config.smtp.host,
          smtpPort: config.smtp.port,
          smtpUser: config.smtp.user,
          smtpPasswordProvided: !!config.smtp.password,
          smtpDailyLimit: config.smtp.dailyLimit,
          brevoApiKeyProvided: config.brevo.isConfigured,
          brevoDailyLimit: config.brevo.dailyLimit,
          routing: config.routing,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
        },

        UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail,
        urls: config.urls,

        client: {
          operational: config.isConfigured || config.brevo.isConfigured,
          simulated: !config.isConfigured && !config.brevo.isConfigured,
        },

        healthInfo,
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao buscar status da configuração');

      res.status(500).json({
        error: 'Erro ao buscar status da configuração',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

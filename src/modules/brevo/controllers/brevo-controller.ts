import { Request, Response } from 'express';
import { EmailService } from '../services/email-service';
import { SMSService } from '../services/sms-service';
import { BrevoClient } from '../client/brevo-client';
import { BrevoConfigManager } from '../config/brevo-config';
import { logger } from '../../../utils/logger';

/**
 * Controller principal do módulo Brevo
 * Gerencia endpoints de status, testes e informações
 */
export class BrevoController {
  private emailService: EmailService;
  private smsService: SMSService;
  private client: BrevoClient;
  private config: BrevoConfigManager;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.client = BrevoClient.getInstance();
    this.config = BrevoConfigManager.getInstance();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: 'BrevoController',
      correlationId: req.id,
    });
  }

  /**
   * Health check completo do módulo
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      log.info('🔍 Executando health check do Brevo...');

      const [emailHealthy, smsHealthy, clientHealthy] = await Promise.all([
        this.emailService.checkHealth(),
        this.smsService.checkHealth(),
        this.client.healthCheck(),
      ]);

      const config = this.config.getConfig();
      const overall = (emailHealthy && clientHealthy) || this.client.isSimulated();

      const healthData = {
        status: overall ? 'healthy' : 'degraded',
        module: 'brevo',
        configured: config.isConfigured,
        simulated: this.client.isSimulated(),
        operational: this.client.isOperational(),
        timestamp: new Date().toISOString(),

        services: {
          email: emailHealthy ? 'operational' : 'degraded',
          sms: smsHealthy ? 'operational' : 'degraded',
          client: clientHealthy ? 'operational' : 'degraded',
        },

        configuration: {
          UsuariosVerificacaoEmailEnabled: config.UsuariosVerificacaoEmail.enabled,
          environment: config.environment,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          frontendUrl: config.urls.frontend,
        },

        features: {
          transactionalEmails: true,
          UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
          smsSupport: true,
        },
      };

      log.info(
        {
          status: healthData.status,
          configured: healthData.configured,
          simulated: healthData.simulated,
        },
        '✅ Health check concluído',
      );

      res.status(overall ? 200 : 503).json(healthData);
    } catch (error) {
      log.error({ err: error }, '❌ Erro no health check');

      res.status(503).json({
        status: 'unhealthy',
        module: 'brevo',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Informações do módulo
   * GET /brevo
   */
  public getModuleInfo = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const config = this.config.getConfig();

      res.json({
        module: 'Brevo Communication Module',
        version: '7.3.0',
        description: 'Sistema completo de comunicação e verificação de email',
        status: 'active',
        configured: config.isConfigured,
        simulated: this.client.isSimulated(),

        features: {
          transactionalEmails: true,
          UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
          smsSupport: true,
          templates: true,
        },

        services: ['email', 'sms', 'verification'],

        endpoints: {
          health: 'GET /health',
          verification: {
            verify: 'GET /verificar-email?token=xxx',
            resend: 'POST /reenviar-verificacao',
            status: 'GET /status-verificacao/:userId',
          },
          testing: {
            email: 'POST /test/email (development only)',
            sms: 'POST /test/sms (development only)',
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
   * POST /brevo/test/email
   * Body: { email: string, name?: string, type?: string }
   */
  public testEmail = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    // Bloqueio em produção
    if (process.env.NODE_ENV === 'production') {
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

  /**
   * Teste de SMS (apenas desenvolvimento)
   * POST /brevo/test/sms
   * Body: { to: string, message?: string }
   */
  public testSMS = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    // Bloqueio em produção
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        success: false,
        message: 'Testes não disponíveis em produção',
        code: 'PRODUCTION_BLOCKED',
      });
      return;
    }

    try {
      const { to, message } = req.body;

      // Validação
      if (!to) {
        res.status(400).json({
          success: false,
          message: 'Número de telefone é obrigatório',
          code: 'MISSING_PHONE',
        });
        return;
      }

      log.info({ to }, '🧪 Teste de SMS');

      const testMessage = message || 'Teste de SMS do Advance+ - Sistema funcionando!';

      const result = await this.smsService.sendSMS({
        to,
        message: testMessage,
        sender: 'Advance+',
      });

      log.info({ result }, '📱 Resultado do teste SMS');

      res.json({
        success: result.success,
        message: 'Teste de SMS executado',
        data: {
          recipient: to,
          message: testMessage,
          simulated: result.simulated,
          messageId: result.messageId,
          error: result.error,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro no teste de SMS');

      res.status(500).json({
        success: false,
        message: 'Erro no teste de SMS',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Status da configuração (desenvolvimento)
   * GET /brevo/config
   */
  public getConfigStatus = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({
        message: 'Informações de configuração não disponíveis em produção',
      });
      return;
    }

    try {
      const config = this.config.getConfig();
      const healthInfo = this.config.getHealthInfo();

      res.json({
        module: 'Brevo Configuration Status',
        timestamp: new Date().toISOString(),

        configuration: {
          isConfigured: config.isConfigured,
          environment: config.environment,
          apiKeyProvided: !!config.apiKey,
          fromEmailConfigured: !!config.fromEmail,
          fromName: config.fromName,
        },

        UsuariosVerificacaoEmail: config.UsuariosVerificacaoEmail,
        urls: config.urls,

        client: {
          operational: this.client.isOperational(),
          simulated: this.client.isSimulated(),
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

import { Request, Response } from "express";
import { EmailService } from "../services/email-service";
import { SMSService } from "../services/sms-service";
import { BrevoClient } from "../client/brevo-client";
import { BrevoConfigManager } from "../config/brevo-config";

/**
 * Controller principal do módulo Brevo
 * Gerencia endpoints de status, testes e informações
 *
 * @author Sistema Advance+
 * @version 7.3.0 - CORRIGIDO - Testes sem salvar no banco
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

  /**
   * Health check completo do módulo
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("🔍 Executando health check do Brevo...");

      const [emailHealthy, smsHealthy, clientHealthy] = await Promise.all([
        this.emailService.checkHealth(),
        this.smsService.checkHealth(),
        this.client.healthCheck(),
      ]);

      const config = this.config.getConfig();
      const overall =
        (emailHealthy && clientHealthy) || this.client.isSimulated();

      const healthData = {
        status: overall ? "healthy" : "degraded",
        module: "brevo",
        configured: config.isConfigured,
        simulated: this.client.isSimulated(),
        operational: this.client.isOperational(),
        timestamp: new Date().toISOString(),

        services: {
          email: emailHealthy ? "operational" : "degraded",
          sms: smsHealthy ? "operational" : "degraded",
          client: clientHealthy ? "operational" : "degraded",
        },

        configuration: {
          emailVerificationEnabled: config.emailVerification.enabled,
          environment: config.environment,
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          frontendUrl: config.urls.frontend,
        },

        features: {
          transactionalEmails: true,
          emailVerification: config.emailVerification.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
          smsSupport: true,
        },
      };

      console.log("✅ Health check concluído:", {
        status: healthData.status,
        configured: healthData.configured,
        simulated: healthData.simulated,
      });

      res.status(overall ? 200 : 503).json(healthData);
    } catch (error) {
      console.error("❌ Erro no health check:", error);

      res.status(503).json({
        status: "unhealthy",
        module: "brevo",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Informações do módulo
   * GET /brevo
   */
  public getModuleInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = this.config.getConfig();

      res.json({
        module: "Brevo Communication Module",
        version: "7.3.0",
        description: "Sistema completo de comunicação e verificação de email",
        status: "active",
        configured: config.isConfigured,
        simulated: this.client.isSimulated(),

        features: {
          transactionalEmails: true,
          emailVerification: config.emailVerification.enabled,
          welcomeEmails: true,
          passwordRecovery: true,
          smsSupport: true,
          templates: true,
        },

        services: ["email", "sms", "verification"],

        endpoints: {
          health: "GET /health",
          verification: {
            verify: "GET /verificar-email?token=xxx",
            resend: "POST /reenviar-verificacao",
            status: "GET /status-verificacao/:userId",
          },
          testing: {
            email: "POST /test/email (development only)",
            sms: "POST /test/sms (development only)",
          },
        },

        configuration: {
          environment: config.environment,
          emailVerificationEnabled: config.emailVerification.enabled,
          tokenExpirationHours: config.emailVerification.tokenExpirationHours,
          maxResendAttempts: config.emailVerification.maxResendAttempts,
          resendCooldownMinutes: config.emailVerification.resendCooldownMinutes,
        },

        urls: config.urls,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Erro ao buscar informações do módulo:", error);

      res.status(500).json({
        error: "Erro ao buscar informações do módulo",
        message: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * ✅ CORRIGIDO: Teste de email (apenas desenvolvimento)
   * POST /brevo/test/email
   * Body: { email: string, name?: string, type?: string }
   */
  public testEmail = async (req: Request, res: Response): Promise<void> => {
    // Bloqueio em produção
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        success: false,
        message: "Testes não disponíveis em produção",
        code: "PRODUCTION_BLOCKED",
      });
      return;
    }

    try {
      const { email, name, type = "welcome" } = req.body;

      // Validação
      if (!email) {
        res.status(400).json({
          success: false,
          message: "Email é obrigatório",
          code: "MISSING_EMAIL",
        });
        return;
      }

      if (!this.isValidEmail(email)) {
        res.status(400).json({
          success: false,
          message: "Formato de email inválido",
          code: "INVALID_EMAIL",
        });
        return;
      }

      console.log(`🧪 Teste de email: ${type} para ${email}`);

      // ✅ CORREÇÃO: Dados de teste que NÃO tentam salvar no banco
      const testUserData = {
        id: `test_user_${Date.now()}`, // Prefixo especial para detecção
        email: email.toLowerCase().trim(),
        nomeCompleto: name || "Usuário Teste",
        tipoUsuario: "PESSOA_FISICA",
      };

      console.log(`🧪 Enviando teste para usuário: ${testUserData.id}`);

      // Envia email usando o sistema normal (mas detectará como teste)
      const result = await this.emailService.sendWelcomeEmail(testUserData);

      console.log(`📧 Resultado do teste:`, result);

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
      console.error("❌ Erro no teste de email:", error);

      res.status(500).json({
        success: false,
        message: "Erro no teste de email",
        error: error instanceof Error ? error.message : "Erro desconhecido",
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
    // Bloqueio em produção
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        success: false,
        message: "Testes não disponíveis em produção",
        code: "PRODUCTION_BLOCKED",
      });
      return;
    }

    try {
      const { to, message } = req.body;

      // Validação
      if (!to) {
        res.status(400).json({
          success: false,
          message: "Número de telefone é obrigatório",
          code: "MISSING_PHONE",
        });
        return;
      }

      console.log(`🧪 Teste de SMS para: ${to}`);

      const testMessage =
        message || "Teste de SMS do Advance+ - Sistema funcionando!";

      const result = await this.smsService.sendSMS({
        to,
        message: testMessage,
        sender: "Advance+",
      });

      console.log(`📱 Resultado do teste SMS:`, result);

      res.json({
        success: result.success,
        message: "Teste de SMS executado",
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
      console.error("❌ Erro no teste de SMS:", error);

      res.status(500).json({
        success: false,
        message: "Erro no teste de SMS",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Status da configuração (desenvolvimento)
   * GET /brevo/config
   */
  public getConfigStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        message: "Informações de configuração não disponíveis em produção",
      });
      return;
    }

    try {
      const config = this.config.getConfig();
      const healthInfo = this.config.getHealthInfo();

      res.json({
        module: "Brevo Configuration Status",
        timestamp: new Date().toISOString(),

        configuration: {
          isConfigured: config.isConfigured,
          environment: config.environment,
          apiKeyProvided: !!config.apiKey,
          fromEmailConfigured: !!config.fromEmail,
          fromName: config.fromName,
        },

        emailVerification: config.emailVerification,
        urls: config.urls,

        client: {
          operational: this.client.isOperational(),
          simulated: this.client.isSimulated(),
        },

        healthInfo,
      });
    } catch (error) {
      console.error("❌ Erro ao buscar status da configuração:", error);

      res.status(500).json({
        error: "Erro ao buscar status da configuração",
        message: error instanceof Error ? error.message : "Erro desconhecido",
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

/**
 * Módulo Brevo - Exportações principais
 * Sistema completo de email e verificação
 *
 * @author Sistema AdvanceMais
 * @version 7.0.0 - Sistema de verificação de email completo
 */

// Serviços principais
export { EmailService } from "./services/email-service";
export { SMSService } from "./services/sms-service";

// Cliente e configuração
export { BrevoClient } from "./client/brevo-client";
export { BrevoConfigManager } from "./config/brevo-config";

// Templates
export { EmailTemplates } from "./templates/email-templates";

// Middlewares
export { WelcomeEmailMiddleware } from "./middlewares/welcome-email-middleware";

// Controllers
export { BrevoController } from "./controllers/brevo-controller";
export { EmailVerificationController } from "./controllers/email-verification-controller";

// Rotas
export { brevoRoutes } from "./routes";

// Tipos e interfaces
export * from "./types/interfaces";

// Imports para classe principal
import { EmailService } from "./services/email-service";
import { SMSService } from "./services/sms-service";
import { BrevoClient } from "./client/brevo-client";
import { BrevoConfigManager } from "./config/brevo-config";

/**
 * Classe principal do módulo Brevo
 * Singleton que gerencia todos os serviços
 */
export class BrevoModule {
  private static instance: BrevoModule;
  private emailService: EmailService;
  private smsService: SMSService;
  private client: BrevoClient;
  private config: BrevoConfigManager;

  private constructor() {
    this.config = BrevoConfigManager.getInstance();
    this.client = BrevoClient.getInstance();
    this.emailService = new EmailService();
    this.smsService = new SMSService();

    console.log("🏭 BrevoModule: Instância criada com sucesso");
  }

  public static getInstance(): BrevoModule {
    if (!BrevoModule.instance) {
      BrevoModule.instance = new BrevoModule();
    }
    return BrevoModule.instance;
  }

  /**
   * Retorna serviço de email
   */
  public getEmailService(): EmailService {
    return this.emailService;
  }

  /**
   * Retorna serviço de SMS
   */
  public getSMSService(): SMSService {
    return this.smsService;
  }

  /**
   * Retorna cliente Brevo
   */
  public getClient(): BrevoClient {
    return this.client;
  }

  /**
   * Retorna configuração
   */
  public getConfig(): BrevoConfigManager {
    return this.config;
  }

  /**
   * Health check completo do módulo
   */
  public async healthCheck() {
    try {
      const [emailHealthy, smsHealthy, clientHealthy] = await Promise.all([
        this.emailService.checkHealth(),
        this.smsService.checkHealth(),
        this.client.healthCheck(),
      ]);

      const overall =
        (emailHealthy && clientHealthy) || this.client.isSimulated();

      return {
        overall,
        status: overall ? "healthy" : "degraded",
        module: "brevo",
        timestamp: new Date().toISOString(),
        services: {
          email: emailHealthy ? "operational" : "degraded",
          sms: smsHealthy ? "operational" : "degraded",
          client: clientHealthy ? "operational" : "degraded",
        },
        configuration: {
          configured: this.config.isConfigured(),
          simulated: this.client.isSimulated(),
          emailVerificationEnabled: this.config.isEmailVerificationEnabled(),
          environment: this.config.getConfig().environment,
        },
      };
    } catch (error) {
      console.error("❌ Erro no health check do BrevoModule:", error);
      return {
        overall: false,
        status: "unhealthy",
        module: "brevo",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  /**
   * Informações resumidas do módulo
   */
  public getModuleInfo() {
    const config = this.config.getConfig();

    return {
      module: "Brevo Communication Module",
      version: "7.0.0",
      status: "active",
      configured: config.isConfigured,
      simulated: this.client.isSimulated(),
      features: {
        transactionalEmails: true,
        emailVerification: config.emailVerification.enabled,
        welcomeEmails: true,
        passwordRecovery: true,
        smsSupport: true,
      },
      services: ["email", "sms", "verification"],
      environment: config.environment,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Envia email de boas-vindas (método de conveniência)
   */
  public async sendWelcomeEmail(userData: {
    id: string;
    email: string;
    nomeCompleto: string;
    tipoUsuario: string;
  }) {
    return await this.emailService.sendWelcomeEmail(userData);
  }

  /**
   * Verifica token de email (método de conveniência)
   */
  public async verifyEmailToken(token: string) {
    return await this.emailService.verifyEmailToken(token);
  }
}

// Instância padrão para uso direto
export const brevoModule = BrevoModule.getInstance();

// Export default da instância principal
export default brevoModule;

/**
 * Módulo Brevo - Exportações principais
 *
 * @author Sistema AdvanceMais
 * @version 5.0.1 - Correção de imports
 */

// Serviços principais
export { EmailService } from "./services/email-service";
export { SMSService } from "./services/sms-service";
export { BrevoClient } from "./client/brevo-client";
export { EmailTemplates } from "./templates/email-templates";

// Middleware
export { WelcomeEmailMiddleware } from "./middlewares/welcome-email-middleware";

// Controller e rotas
export { BrevoController } from "./controllers/brevo-controller";
export { brevoRoutes } from "./routes";

// Configuração e tipos
export { BrevoConfigManager } from "./config/brevo-config";
export * from "./types/interfaces";

// Imports corretos para a classe principal
import { EmailService } from "./services/email-service";
import { SMSService } from "./services/sms-service";
import { BrevoClient } from "./client/brevo-client";

/**
 * Classe principal do módulo
 */
export class BrevoModule {
  private static instance: BrevoModule;
  private emailService: EmailService;
  private smsService: SMSService;
  private client: BrevoClient;

  private constructor() {
    this.client = BrevoClient.getInstance();
    this.emailService = new EmailService();
    this.smsService = new SMSService();
  }

  public static getInstance(): BrevoModule {
    if (!BrevoModule.instance) {
      BrevoModule.instance = new BrevoModule();
    }
    return BrevoModule.instance;
  }

  public getEmailService(): EmailService {
    return this.emailService;
  }

  public getSMSService(): SMSService {
    return this.smsService;
  }

  public getClient(): BrevoClient {
    return this.client;
  }

  public async healthCheck() {
    const [emailHealthy, smsHealthy] = await Promise.all([
      this.emailService.checkHealth(),
      this.smsService.checkHealth(),
    ]);

    return {
      client: this.client.isOperational(),
      email: emailHealthy,
      sms: smsHealthy,
      simulated: this.client.isSimulated(),
      overall: (emailHealthy && smsHealthy) || this.client.isSimulated(),
    };
  }
}

// Instância padrão para uso direto
export const brevoModule = BrevoModule.getInstance();

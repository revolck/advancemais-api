/**
 * Módulo Brevo - Ponto de entrada principal
 * Exportações organizadas e interface limpa
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1 - Correção de exports e simplificação
 */

// Exportações principais
export { BrevoClient } from "./client/brevo-client";
export { EmailService } from "./services/email-service";
export { SMSService } from "./services/sms-service";
export { EmailTemplates } from "./templates/email-templates";
export { WelcomeEmailMiddleware } from "./middlewares/welcome-email-middleware";
export { BrevoController } from "./controllers/brevo-controller";

// Exportações de tipos
export * from "./types/interfaces";

// CORREÇÃO: Export das rotas sem default
export { brevoRoutes } from "./routes";

/**
 * Classe principal do módulo para uso simplificado
 */
import { BrevoClient } from "./client/brevo-client";
import { EmailService } from "./services/email-service";
import { SMSService } from "./services/sms-service";

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
    const clientHealthy = await this.client.checkHealth();
    const emailHealthy = await this.emailService.checkConnectivity();
    const smsHealthy = await this.smsService.checkConnectivity();

    return {
      client: clientHealthy,
      email: emailHealthy,
      sms: smsHealthy,
      overall: clientHealthy && emailHealthy && smsHealthy,
    };
  }
}

// Instância padrão para uso direto
export const brevoModule = BrevoModule.getInstance();

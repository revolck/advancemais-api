import { BrevoClient } from "./client/brevo-client";
import { EmailService } from "./services/email-service";
import { SMSService } from "./services/sms-service";
import { EmailTemplates } from "./templates/email-templates";
import { WelcomeEmailMiddleware } from "./middlewares/welcome-email-middleware";

/**
 * Módulo Brevo - Versão Simplificada
 *
 * Interface mínima para evitar conflitos de importação
 *
 * @author Sistema AdvanceMais
 * @version 2.0.1
 */
class BrevoModule {
  private emailService: EmailService | null = null;
  private smsService: SMSService | null = null;
  private client: BrevoClient | null = null;

  /**
   * Inicializa serviços sob demanda para evitar problemas de importação circular
   */
  private getEmailService() {
    if (!this.emailService) {
      this.emailService = new EmailService();
    }
    return this.emailService;
  }

  private getSMSService() {
    if (!this.smsService) {
      this.smsService = new SMSService();
    }
    return this.smsService;
  }

  private getClient() {
    if (!this.client) {
      this.client = BrevoClient.getInstance();
    }
    return this.client;
  }

  /**
   * Envia email
   */
  async sendEmail(emailData: {
    to: string;
    toName?: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    tags?: string[];
  }) {
    try {
      return await this.getEmailService().enviarEmail(emailData);
    } catch (error) {
      console.error("Erro ao enviar email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia SMS
   */
  async sendSMS(smsData: {
    to: string;
    message: string;
    type?: "transac" | "marketing";
    tag?: string;
  }) {
    try {
      return await this.getSMSService().enviarSMS({
        to: smsData.to,
        message: smsData.message,
        sender: smsData.tag || "AdvanceMais",
      });
    } catch (error) {
      console.error("Erro ao enviar SMS:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Obtém estatísticas básicas
   */
  async getStats() {
    try {
      const emailStats = await this.getEmailService()
        .obterEstatisticasEnvio()
        .catch(() => null);
      const smsStats = await this.getSMSService()
        .obterEstatisticasEnvio()
        .catch(() => null);

      return {
        email: emailStats,
        sms: smsStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        email: null,
        sms: null,
        error:
          error instanceof Error ? error.message : "Erro ao obter estatísticas",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Verifica saúde dos serviços
   */
  async healthCheck() {
    try {
      const clientOk = await this.getClient()
        .isConfigured()
        .catch(() => false);
      const emailOk = await this.getEmailService()
        .testarConectividade()
        .catch(() => false);
      const smsOk = await this.getSMSService()
        .testarConectividade()
        .catch(() => false);

      return {
        client: clientOk,
        email: emailOk,
        sms: smsOk,
        overall: clientOk && emailOk && smsOk,
      };
    } catch (error) {
      return {
        client: false,
        email: false,
        sms: false,
        overall: false,
        error: error instanceof Error ? error.message : "Erro no health check",
      };
    }
  }

  /**
   * Reinicializa o módulo
   */
  async refresh() {
    try {
      EmailTemplates.clearCache();
      this.emailService = null;
      this.smsService = null;
      this.client = null;
      console.log("🔄 Módulo Brevo reinicializado");
    } catch (error) {
      console.error("Erro ao reinicializar módulo Brevo:", error);
    }
  }
}

// Instância singleton
const brevoModule = new BrevoModule();

// Exportações individuais
export { BrevoClient } from "./client/brevo-client";
export { EmailService } from "./services/email-service";
export { SMSService } from "./services/sms-service";
export { EmailTemplates } from "./templates/email-templates";
export { WelcomeEmailMiddleware } from "./middlewares/welcome-email-middleware";

// Exporta instância do módulo
export { brevoModule };

// Exportação padrão
export default brevoModule;

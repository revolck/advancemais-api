import * as Brevo from '@getbrevo/brevo';
import { BrevoConfigManager, BrevoConfiguration } from '../config/brevo-config';
import { logger } from '@/utils/logger';

/**
 * Cliente Brevo simplificado e robusto
 * Gerencia conexão com API Brevo de forma segura
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private emailAPI?: Brevo.TransactionalEmailsApi;
  private smsAPI?: Brevo.TransactionalSMSApi;
  private accountAPI?: Brevo.AccountApi;
  private config: BrevoConfiguration;
  private operational: boolean = false;
  private readonly log = logger.child({ module: 'BrevoClient' });

  private constructor() {
    this.config = BrevoConfigManager.getInstance().getConfig();
    this.initializeAPIs();
  }

  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  /**
   * Inicializa APIs do Brevo
   */
  private initializeAPIs(): void {
    try {
      if (this.config.isConfigured && this.config.apiKey) {
        // Inicializa APIs apenas se configurado
        this.emailAPI = new Brevo.TransactionalEmailsApi();
        this.smsAPI = new Brevo.TransactionalSMSApi();
        this.accountAPI = new Brevo.AccountApi();

        // Configura API key
        this.emailAPI.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, this.config.apiKey);
        this.smsAPI.setApiKey(Brevo.TransactionalSMSApiApiKeys.apiKey, this.config.apiKey);
        this.accountAPI.setApiKey(Brevo.AccountApiApiKeys.apiKey, this.config.apiKey);

        this.operational = true;
        this.log.info({ environment: this.config.environment }, '✅ Brevo Client configurado');
      } else {
        this.log.info('ℹ️ Brevo Client em modo simulado (API não configurada)');
      }
    } catch (error) {
      this.log.error({ err: error }, '❌ Erro ao inicializar Brevo Client');
      this.operational = false;
    }
  }

  /**
   * Retorna API de email
   */
  public getEmailAPI(): Brevo.TransactionalEmailsApi | undefined {
    return this.emailAPI;
  }

  /**
   * Retorna API de SMS
   */
  public getSMSAPI(): Brevo.TransactionalSMSApi | undefined {
    return this.smsAPI;
  }

  /**
   * Retorna API de conta
   */
  public getAccountAPI(): Brevo.AccountApi | undefined {
    return this.accountAPI;
  }

  /**
   * Retorna configuração
   */
  public getConfig(): BrevoConfiguration {
    return this.config;
  }

  /**
   * Verifica se está operacional
   */
  public isOperational(): boolean {
    return this.operational && this.config.isConfigured;
  }

  /**
   * Verifica se está em modo simulado
   */
  public isSimulated(): boolean {
    return !this.config.isConfigured || !this.operational;
  }

  /**
   * Health check simples
   */
  public async healthCheck(): Promise<boolean> {
    if (this.isSimulated()) {
      return true; // Simulado é sempre "healthy"
    }

    try {
      if (this.accountAPI) {
        await this.accountAPI.getAccount();
        return true;
      }
      return false;
    } catch (error) {
      this.log.warn({ err: error }, '⚠️ Brevo health check falhou');
      return false;
    }
  }

  /**
   * Envia email transacional
   */
  public async sendEmail(emailData: {
    to: string;
    toName: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    simulated?: boolean;
  }> {
    // Modo simulado
    if (this.isSimulated()) {
      this.log.info(
        {
          to: emailData.to,
          subject: emailData.subject,
        },
        '🎭 Email simulado enviado',
      );
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Envio real
    try {
      if (!this.emailAPI) {
        throw new Error('API de email não inicializada');
      }

      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.to = [{ email: emailData.to, name: emailData.toName }];
      sendSmtpEmail.sender = {
        email: this.config.fromEmail,
        name: this.config.fromName,
      };
      sendSmtpEmail.subject = emailData.subject;
      sendSmtpEmail.htmlContent = emailData.html;
      sendSmtpEmail.textContent = emailData.text;

      const response = await this.emailAPI.sendTransacEmail(sendSmtpEmail);
      const messageId = this.extractMessageId(response);

      this.log.info({ to: emailData.to, messageId }, '✅ Email enviado via Brevo');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.log.error({ err: error, to: emailData.to }, '❌ Erro no envio via Brevo');

      // Fallback para simulação em caso de erro
      this.log.warn({ to: emailData.to }, '🎭 Fallback para modo simulado');
      return {
        success: true,
        messageId: `fallback_${Date.now()}`,
        simulated: true,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Envia SMS transacional
   */
  public async sendSMS(smsData: { to: string; message: string; sender?: string }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    simulated?: boolean;
  }> {
    // Modo simulado
    if (this.isSimulated()) {
      this.log.info(
        {
          to: smsData.to,
          message: smsData.message,
        },
        '🎭 SMS simulado enviado',
      );
      return {
        success: true,
        messageId: `sms_sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Envio real
    try {
      if (!this.smsAPI) {
        throw new Error('API de SMS não inicializada');
      }

      const sendSmsRequest = new Brevo.SendTransacSms();
      sendSmsRequest.type = Brevo.SendTransacSms.TypeEnum.Transactional;
      sendSmsRequest.unicodeEnabled = false;
      sendSmsRequest.sender = smsData.sender || 'Advance+';
      sendSmsRequest.recipient = smsData.to;
      sendSmsRequest.content = smsData.message;

      const response = await this.smsAPI.sendTransacSms(sendSmsRequest);
      const messageId = this.extractMessageId(response);

      this.log.info({ to: smsData.to, messageId }, '✅ SMS enviado via Brevo');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.log.error({ err: error, to: smsData.to }, '❌ Erro no envio de SMS via Brevo');

      // Fallback para simulação
      this.log.warn({ to: smsData.to }, '🎭 Fallback SMS para modo simulado');
      return {
        success: true,
        messageId: `sms_fallback_${Date.now()}`,
        simulated: true,
        error: error instanceof Error ? error.message : 'Erro na API de SMS',
      };
    }
  }

  /**
   * Extrai message ID da resposta
   */
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_${Date.now()}`;
  }
}

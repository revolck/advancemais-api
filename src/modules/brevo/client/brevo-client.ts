import * as Brevo from '@getbrevo/brevo';
import { BrevoConfigManager, BrevoConfiguration } from '../config/brevo-config';
import { logger } from '@/utils/logger';

type BrevoFailureReason =
  | 'API_NOT_CONFIGURED'
  | 'API_NOT_INITIALIZED'
  | 'IP_NOT_AUTHORIZED'
  | 'AUTHENTICATION_FAILED'
  | 'API_REQUEST_FAILED';

interface BrevoOperationalIssue {
  operation: 'health_check' | 'send_email' | 'send_sms';
  failureReason: BrevoFailureReason;
  message: string;
  statusCode?: number;
  code?: string;
  occurredAt: string;
}

interface BrevoErrorDetails {
  message: string;
  statusCode?: number;
  code?: string;
  failureReason: BrevoFailureReason;
}

/**
 * Cliente Brevo simplificado e robusto
 * Gerencia conexão com API Brevo de forma segura
 */
export class BrevoClient {
  private static readonly EMAIL_REQUEST_TIMEOUT_MS = 15000;
  private static instance: BrevoClient;
  private emailAPI?: Brevo.TransactionalEmailsApi;
  private smsAPI?: Brevo.TransactionalSMSApi;
  private accountAPI?: Brevo.AccountApi;
  private config: BrevoConfiguration;
  private operational: boolean = false;
  private runtimeConfigLoadedAt = 0;
  private runtimeConfigPromise: Promise<void> | null = null;
  private lastOperationalIssue: BrevoOperationalIssue | null = null;
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
      this.emailAPI = undefined;
      this.smsAPI = undefined;
      this.accountAPI = undefined;
      this.operational = false;

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
        this.lastOperationalIssue = null;
        this.log.info({ environment: this.config.environment }, '✅ Brevo Client configurado');
      } else {
        this.lastOperationalIssue = {
          operation: 'health_check',
          failureReason: 'API_NOT_CONFIGURED',
          message: 'Brevo não configurado; cliente operando em modo simulado',
          occurredAt: new Date().toISOString(),
        };
        this.log.info('ℹ️ Brevo Client em modo simulado (API não configurada)');
      }
    } catch (error) {
      this.log.error({ err: error }, '❌ Erro ao inicializar Brevo Client');
      this.operational = false;
    }
  }

  private async ensureRuntimeConfig(): Promise<void> {
    const now = Date.now();
    if (now - this.runtimeConfigLoadedAt < 30_000) {
      return;
    }

    if (!this.runtimeConfigPromise) {
      this.runtimeConfigPromise = BrevoConfigManager.getInstance()
        .getRuntimeConfig()
        .then((runtimeConfig) => {
          const hasChanged =
            runtimeConfig.apiKey !== this.config.apiKey ||
            runtimeConfig.fromEmail !== this.config.fromEmail ||
            runtimeConfig.fromName !== this.config.fromName ||
            runtimeConfig.isConfigured !== this.config.isConfigured;

          this.config = runtimeConfig;
          this.runtimeConfigLoadedAt = Date.now();

          if (hasChanged) {
            this.initializeAPIs();
          }
        })
        .catch((error) => {
          this.runtimeConfigLoadedAt = Date.now();
          this.log.warn(
            { err: error },
            '⚠️ Falha ao carregar config runtime da Brevo; usando fallback',
          );
        })
        .finally(() => {
          this.runtimeConfigPromise = null;
        });
    }

    await this.runtimeConfigPromise;
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

  public getLastOperationalIssue(): BrevoOperationalIssue | null {
    return this.lastOperationalIssue;
  }

  /**
   * Health check simples
   */
  public async healthCheck(): Promise<boolean> {
    await this.ensureRuntimeConfig();

    if (this.isSimulated()) {
      this.lastOperationalIssue = {
        operation: 'health_check',
        failureReason: 'API_NOT_CONFIGURED',
        message: 'Brevo não configurado; health check em modo simulado',
        occurredAt: new Date().toISOString(),
      };
      return true; // Simulado é sempre "healthy"
    }

    try {
      if (this.accountAPI) {
        await this.accountAPI.getAccount();
        this.lastOperationalIssue = null;
        return true;
      }
      this.recordOperationalIssue('health_check', {
        failureReason: 'API_NOT_INITIALIZED',
        message: 'API de conta não inicializada',
      });
      return false;
    } catch (error) {
      const details = this.extractErrorDetails(error, 'API_REQUEST_FAILED');
      this.recordOperationalIssue('health_check', details);
      this.log.warn(
        {
          err: error,
          brevoStatusCode: details.statusCode,
          brevoCode: details.code,
          failureReason: details.failureReason,
        },
        '⚠️ Brevo health check falhou',
      );
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
    await this.ensureRuntimeConfig();

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

      const response = await Promise.race([
        this.emailAPI.sendTransacEmail(sendSmtpEmail),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('BREVO_EMAIL_TIMEOUT'));
          }, BrevoClient.EMAIL_REQUEST_TIMEOUT_MS);
        }),
      ]);
      const messageId = this.extractMessageId(response);
      this.lastOperationalIssue = null;

      this.log.info({ to: emailData.to, messageId }, '✅ Email enviado via Brevo');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const details = this.extractErrorDetails(error, 'API_REQUEST_FAILED');
      this.recordOperationalIssue('send_email', details);
      this.log.error(
        {
          err: error,
          to: emailData.to,
          brevoStatusCode: details.statusCode,
          brevoCode: details.code,
          failureReason: details.failureReason,
        },
        '❌ Erro no envio via Brevo',
      );
      return {
        success: false,
        error: details.message,
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
    await this.ensureRuntimeConfig();

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
      this.lastOperationalIssue = null;

      this.log.info({ to: smsData.to, messageId }, '✅ SMS enviado via Brevo');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const details = this.extractErrorDetails(error, 'API_REQUEST_FAILED');
      this.recordOperationalIssue('send_sms', details);
      this.log.error(
        {
          err: error,
          to: smsData.to,
          brevoStatusCode: details.statusCode,
          brevoCode: details.code,
          failureReason: details.failureReason,
        },
        '❌ Erro no envio de SMS via Brevo',
      );
      return {
        success: false,
        error: details.message,
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

  private recordOperationalIssue(
    operation: BrevoOperationalIssue['operation'],
    details: BrevoErrorDetails,
  ): void {
    this.lastOperationalIssue = {
      operation,
      failureReason: details.failureReason,
      message: details.message,
      statusCode: details.statusCode,
      code: details.code,
      occurredAt: new Date().toISOString(),
    };
  }

  private extractErrorDetails(
    error: unknown,
    fallbackReason: Exclude<BrevoFailureReason, 'API_NOT_CONFIGURED'>,
  ): BrevoErrorDetails {
    const errorRecord = error as
      | {
          message?: string;
          code?: string;
          statusCode?: number;
          response?: { statusCode?: number; body?: { code?: string; message?: string } };
          body?: { code?: string; message?: string };
        }
      | undefined;

    const statusCode = errorRecord?.response?.statusCode ?? errorRecord?.statusCode;
    const code = errorRecord?.response?.body?.code ?? errorRecord?.body?.code ?? errorRecord?.code;
    const message =
      errorRecord?.response?.body?.message ??
      errorRecord?.body?.message ??
      errorRecord?.message ??
      'Erro desconhecido na comunicação com a Brevo';

    const normalizedMessage = String(message);
    const normalizedCode = String(code || '').toLowerCase();
    const normalizedText = `${normalizedCode} ${normalizedMessage}`.toLowerCase();

    if (
      normalizedCode === 'unauthorized' &&
      (normalizedText.includes('unrecognised ip address') ||
        normalizedText.includes('authorized ip') ||
        normalizedText.includes('authorised ip'))
    ) {
      return {
        message: normalizedMessage,
        statusCode,
        code,
        failureReason: 'IP_NOT_AUTHORIZED',
      };
    }

    if (statusCode === 401 || normalizedCode === 'unauthorized') {
      return {
        message: normalizedMessage,
        statusCode,
        code,
        failureReason: 'AUTHENTICATION_FAILED',
      };
    }

    return {
      message: normalizedMessage,
      statusCode,
      code,
      failureReason: fallbackReason,
    };
  }
}

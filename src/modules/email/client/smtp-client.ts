import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPPool from 'nodemailer/lib/smtp-pool';
import { EmailConfigManager, EmailConfiguration } from '../config/email-config';
import { logger } from '@/utils/logger';

type SmtpFailureReason =
  | 'SMTP_NOT_CONFIGURED'
  | 'SMTP_NOT_INITIALIZED'
  | 'AUTHENTICATION_FAILED'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'RECIPIENT_REJECTED'
  | 'SEND_FAILED';

interface SmtpOperationalIssue {
  operation: 'health_check' | 'send_email';
  failureReason: SmtpFailureReason;
  message: string;
  responseCode?: number;
  code?: string;
  occurredAt: string;
}

interface SmtpErrorDetails {
  message: string;
  responseCode?: number;
  code?: string;
  failureReason: SmtpFailureReason;
}

/**
 * Cliente SMTP (nodemailer)
 * Mantém um pool de conexões autenticadas com o servidor de e-mail
 */
export class SmtpClient {
  private static instance: SmtpClient;
  private transporter?: Transporter<SMTPPool.SentMessageInfo>;
  private config: EmailConfiguration;
  private runtimeConfigLoadedAt = 0;
  private runtimeConfigPromise: Promise<void> | null = null;
  private lastOperationalIssue: SmtpOperationalIssue | null = null;
  private readonly log = logger.child({ module: 'SmtpClient' });

  private constructor() {
    this.config = EmailConfigManager.getInstance().getConfig();
    this.initializeTransport();
  }

  public static getInstance(): SmtpClient {
    if (!SmtpClient.instance) {
      SmtpClient.instance = new SmtpClient();
    }
    return SmtpClient.instance;
  }

  /**
   * Inicializa o transporter SMTP
   */
  private initializeTransport(): void {
    try {
      this.transporter?.close();
      this.transporter = undefined;

      if (!this.config.isConfigured) {
        this.lastOperationalIssue = {
          operation: 'health_check',
          failureReason: 'SMTP_NOT_CONFIGURED',
          message: 'SMTP não configurado; cliente operando em modo simulado',
          occurredAt: new Date().toISOString(),
        };
        this.log.info('ℹ️ SMTP Client em modo simulado (credenciais não configuradas)');
        return;
      }

      const { smtp, timeout } = this.config;
      this.transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
        connectionTimeout: timeout,
        greetingTimeout: timeout,
        socketTimeout: timeout,
      });

      this.lastOperationalIssue = null;
      this.log.info(
        { environment: this.config.environment, host: smtp.host, port: smtp.port },
        '✅ SMTP Client configurado',
      );
    } catch (error) {
      this.log.error({ err: error }, '❌ Erro ao inicializar SMTP Client');
      this.transporter = undefined;
    }
  }

  private async ensureRuntimeConfig(): Promise<void> {
    const now = Date.now();
    if (now - this.runtimeConfigLoadedAt < 30_000) {
      return;
    }

    if (!this.runtimeConfigPromise) {
      this.runtimeConfigPromise = EmailConfigManager.getInstance()
        .getRuntimeConfig()
        .then((runtimeConfig) => {
          const hasChanged =
            runtimeConfig.smtp.host !== this.config.smtp.host ||
            runtimeConfig.smtp.port !== this.config.smtp.port ||
            runtimeConfig.smtp.secure !== this.config.smtp.secure ||
            runtimeConfig.smtp.user !== this.config.smtp.user ||
            runtimeConfig.smtp.password !== this.config.smtp.password ||
            runtimeConfig.timeout !== this.config.timeout ||
            runtimeConfig.isConfigured !== this.config.isConfigured;

          this.config = runtimeConfig;
          this.runtimeConfigLoadedAt = Date.now();

          if (hasChanged) {
            this.initializeTransport();
          }
        })
        .catch((error) => {
          this.runtimeConfigLoadedAt = Date.now();
          this.log.warn(
            { err: error },
            '⚠️ Falha ao carregar config runtime do SMTP; usando fallback',
          );
        })
        .finally(() => {
          this.runtimeConfigPromise = null;
        });
    }

    await this.runtimeConfigPromise;
  }

  /**
   * Retorna configuração
   */
  public getConfig(): EmailConfiguration {
    return this.config;
  }

  /**
   * Verifica se está operacional
   */
  public isOperational(): boolean {
    return Boolean(this.transporter) && this.config.isConfigured;
  }

  /**
   * Verifica se está em modo simulado
   */
  public isSimulated(): boolean {
    return !this.config.isConfigured || !this.transporter;
  }

  public getLastOperationalIssue(): SmtpOperationalIssue | null {
    return this.lastOperationalIssue;
  }

  /**
   * Health check: abre conexão e autentica no servidor SMTP
   */
  public async healthCheck(): Promise<boolean> {
    await this.ensureRuntimeConfig();

    if (this.isSimulated()) {
      this.lastOperationalIssue = {
        operation: 'health_check',
        failureReason: 'SMTP_NOT_CONFIGURED',
        message: 'SMTP não configurado; health check em modo simulado',
        occurredAt: new Date().toISOString(),
      };
      return true; // Simulado é sempre "healthy"
    }

    try {
      if (!this.transporter) {
        this.recordOperationalIssue('health_check', {
          failureReason: 'SMTP_NOT_INITIALIZED',
          message: 'Transporter SMTP não inicializado',
        });
        return false;
      }

      await this.transporter.verify();
      this.lastOperationalIssue = null;
      return true;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.recordOperationalIssue('health_check', details);
      this.log.warn(
        {
          err: error,
          smtpResponseCode: details.responseCode,
          smtpCode: details.code,
          failureReason: details.failureReason,
        },
        '⚠️ SMTP health check falhou',
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
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!this.transporter) {
        throw new Error('Transporter SMTP não inicializado');
      }

      const info = await Promise.race([
        this.transporter.sendMail({
          from: { name: this.config.fromName, address: this.config.fromEmail },
          to: { name: emailData.toName || '', address: emailData.to },
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(Object.assign(new Error('SMTP_EMAIL_TIMEOUT'), { code: 'ETIMEDOUT' }));
          }, this.config.timeout);
        }),
      ]);

      if (info.rejected.length > 0) {
        throw Object.assign(
          new Error(`Destinatário recusado pelo servidor SMTP: ${info.response}`),
          {
            code: 'EENVELOPE',
          },
        );
      }

      const messageId = info.messageId || `smtp_${Date.now()}`;
      this.lastOperationalIssue = null;

      this.log.info({ to: emailData.to, messageId }, '✅ Email enviado via SMTP');

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.recordOperationalIssue('send_email', details);
      this.log.error(
        {
          err: error,
          to: emailData.to,
          smtpResponseCode: details.responseCode,
          smtpCode: details.code,
          failureReason: details.failureReason,
        },
        '❌ Erro no envio via SMTP',
      );
      return {
        success: false,
        error: details.message,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private recordOperationalIssue(
    operation: SmtpOperationalIssue['operation'],
    details: SmtpErrorDetails,
  ): void {
    this.lastOperationalIssue = {
      operation,
      failureReason: details.failureReason,
      message: details.message,
      responseCode: details.responseCode,
      code: details.code,
      occurredAt: new Date().toISOString(),
    };
  }

  private extractErrorDetails(error: unknown): SmtpErrorDetails {
    const errorRecord = error as
      | { message?: string; code?: string; responseCode?: number; response?: string }
      | undefined;

    const code = errorRecord?.code;
    const responseCode = errorRecord?.responseCode;
    const message = String(
      errorRecord?.response ||
        errorRecord?.message ||
        'Erro desconhecido na comunicação com o servidor SMTP',
    );

    let failureReason: SmtpFailureReason = 'SEND_FAILED';
    if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
      failureReason = 'AUTHENTICATION_FAILED';
    } else if (code === 'ETIMEDOUT') {
      failureReason = 'TIMEOUT';
    } else if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'EDNS' || code === 'ETLS') {
      failureReason = 'CONNECTION_FAILED';
    } else if (code === 'EENVELOPE') {
      failureReason = 'RECIPIENT_REJECTED';
    }

    return { message, responseCode, code, failureReason };
  }
}

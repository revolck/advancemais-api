import { EmailConfigManager, EmailConfiguration } from '../config/email-config';
import type { EmailProviderIssue, EmailSendInput, EmailSendResult } from './types';
import { logger } from '@/utils/logger';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

type BrevoFailureReason =
  | 'BREVO_NOT_CONFIGURED'
  | 'IP_NOT_AUTHORIZED'
  | 'AUTHENTICATION_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR';

interface BrevoErrorDetails {
  message: string;
  responseCode?: number;
  code?: string;
  failureReason: BrevoFailureReason;
  deliveryUncertain: boolean;
}

class BrevoHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Cliente da API transacional da Brevo (HTTPS, porta 443)
 * Usado como canal de reserva do SMTP e como canal das campanhas
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private config: EmailConfiguration;
  private runtimeConfigLoadedAt = 0;
  private runtimeConfigPromise: Promise<void> | null = null;
  private lastOperationalIssue: EmailProviderIssue | null = null;
  private readonly log = logger.child({ module: 'BrevoClient' });

  private constructor() {
    this.config = EmailConfigManager.getInstance().getConfig();
  }

  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  private async ensureRuntimeConfig(): Promise<void> {
    if (Date.now() - this.runtimeConfigLoadedAt < 30_000) {
      return;
    }

    if (!this.runtimeConfigPromise) {
      this.runtimeConfigPromise = EmailConfigManager.getInstance()
        .getRuntimeConfig()
        .then((runtimeConfig) => {
          this.config = runtimeConfig;
          this.runtimeConfigLoadedAt = Date.now();
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

  public getConfig(): EmailConfiguration {
    return this.config;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.brevo.apiKey);
  }

  public getLastOperationalIssue(): EmailProviderIssue | null {
    return this.lastOperationalIssue;
  }

  /**
   * Health check: consulta a conta (não consome a cota de envio)
   */
  public async healthCheck(): Promise<boolean> {
    await this.ensureRuntimeConfig();

    if (!this.isConfigured()) {
      this.lastOperationalIssue = {
        operation: 'health_check',
        failureReason: 'BREVO_NOT_CONFIGURED',
        message: 'BREVO_API_KEY não configurada',
        occurredAt: new Date().toISOString(),
      };
      return false;
    }

    try {
      await this.request('GET', '/account');
      this.lastOperationalIssue = null;
      return true;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.recordOperationalIssue('health_check', details);
      this.log.warn(
        { err: error, brevoStatus: details.responseCode, failureReason: details.failureReason },
        '⚠️ Brevo health check falhou',
      );
      return false;
    }
  }

  /**
   * Envia email transacional pela API da Brevo
   */
  public async sendEmail(emailData: EmailSendInput): Promise<EmailSendResult> {
    await this.ensureRuntimeConfig();

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'BREVO_API_KEY não configurada',
        failureReason: 'BREVO_NOT_CONFIGURED',
      };
    }

    try {
      const body = await this.request('POST', '/smtp/email', {
        sender: { name: this.config.fromName, email: this.config.fromEmail },
        to: [{ email: emailData.to, name: emailData.toName || undefined }],
        subject: emailData.subject,
        htmlContent: emailData.html,
        textContent: emailData.text,
      });

      const messageId = String(body?.messageId || `brevo_${Date.now()}`);
      this.lastOperationalIssue = null;
      this.log.info({ to: emailData.to, messageId }, '✅ Email enviado via Brevo');

      return { success: true, messageId };
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.recordOperationalIssue('send_email', details);
      this.log.error(
        {
          err: error,
          to: emailData.to,
          brevoStatus: details.responseCode,
          brevoCode: details.code,
          failureReason: details.failureReason,
        },
        '❌ Erro no envio via Brevo',
      );
      return {
        success: false,
        error: details.message,
        failureReason: details.failureReason,
        deliveryUncertain: details.deliveryUncertain,
      };
    }
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<any> {
    const controller = new globalThis.AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${BREVO_API_BASE}${path}`, {
        method,
        headers: {
          'api-key': this.config.brevo.apiKey,
          accept: 'application/json',
          ...(payload ? { 'content-type': 'application/json' } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (!response.ok) {
        throw new BrevoHttpError(
          response.status,
          body?.code,
          String(body?.message || text || `HTTP ${response.status}`),
        );
      }

      return body;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private recordOperationalIssue(
    operation: EmailProviderIssue['operation'],
    details: BrevoErrorDetails,
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

  private extractErrorDetails(error: unknown): BrevoErrorDetails {
    if (error instanceof BrevoHttpError) {
      const text = `${error.code ?? ''} ${error.message}`.toLowerCase();
      let failureReason: BrevoFailureReason = 'PROVIDER_ERROR';

      if (error.status === 401 && /unrecogni[sz]ed ip|authori[sz]ed ip/.test(text)) {
        failureReason = 'IP_NOT_AUTHORIZED';
      } else if (error.status === 401) {
        failureReason = 'AUTHENTICATION_FAILED';
      } else if (error.status === 402 || /credit|quota|limit/.test(text)) {
        failureReason = 'QUOTA_EXCEEDED';
      } else if (error.status === 429) {
        failureReason = 'RATE_LIMITED';
      } else if (error.status >= 400 && error.status < 500) {
        failureReason = 'INVALID_REQUEST';
      }

      return {
        message: error.message,
        responseCode: error.status,
        code: error.code,
        failureReason,
        // 504 (gateway timeout) pode ter sido processado do outro lado
        deliveryUncertain: error.status === 504,
      };
    }

    const errorRecord = error as { name?: string; message?: string } | undefined;
    if (errorRecord?.name === 'AbortError') {
      return {
        message: 'Timeout na chamada à API da Brevo',
        failureReason: 'TIMEOUT',
        deliveryUncertain: true,
      };
    }

    // Falha de rede sem resposta. Só é seguro trocar de canal se a conexão
    // nem chegou a ser aberta (DNS, recusa, timeout de conexão).
    const causeCode = String((error as { cause?: { code?: string } })?.cause?.code || '');
    const failedBeforeConnect = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
    ].includes(causeCode);

    return {
      message: String(errorRecord?.message || 'Erro desconhecido na comunicação com a Brevo'),
      code: causeCode || undefined,
      failureReason: 'CONNECTION_FAILED',
      deliveryUncertain: !failedBeforeConnect,
    };
  }
}

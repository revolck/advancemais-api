import { EmailConfigManager, EmailConfiguration } from '../config/email-config';
import { BrevoClient } from './brevo-client';
import { SmtpClient } from './smtp-client';
import { emailUsageCounter } from './email-usage-counter';
import type {
  EmailChannel,
  EmailProviderIssue,
  EmailProviderName,
  EmailSendInput,
  EmailSendResult,
} from './types';
import { logger } from '@/utils/logger';

interface EmailProviderClient {
  sendEmail(emailData: EmailSendInput): Promise<EmailSendResult>;
  healthCheck(): Promise<boolean>;
  getLastOperationalIssue(): EmailProviderIssue | null;
}

export interface EmailProviderHealth {
  name: EmailProviderName;
  configured: boolean;
  healthy: boolean | null;
  dailyLimit: number;
  usedToday: number;
  lastIssue: EmailProviderIssue | null;
}

export interface EmailHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  simulated: boolean;
  providers: EmailProviderHealth[];
  routing: EmailConfiguration['routing'];
}

const ALL_PROVIDERS: EmailProviderName[] = ['smtp', 'brevo'];

/**
 * Distribui os envios entre SMTP e Brevo.
 * - E-mails do sistema: ordem de `routing.transactional` (padrão smtp → brevo)
 * - Campanhas: ordem de `routing.marketing` (padrão brevo), sem consumir a
 *   reserva diária dos e-mails do sistema
 * - Troca de canal ao atingir o limite diário ou em recusa certa do provedor
 */
export class EmailDispatcher {
  private static instance: EmailDispatcher;
  private readonly log = logger.child({ module: 'EmailDispatcher' });

  private constructor(
    private readonly clients: Record<EmailProviderName, EmailProviderClient> = {
      smtp: SmtpClient.getInstance(),
      brevo: BrevoClient.getInstance(),
    },
  ) {}

  public static getInstance(): EmailDispatcher {
    if (!EmailDispatcher.instance) {
      EmailDispatcher.instance = new EmailDispatcher();
    }
    return EmailDispatcher.instance;
  }

  private isProviderConfigured(name: EmailProviderName, config: EmailConfiguration): boolean {
    return name === 'smtp' ? config.isConfigured : config.brevo.isConfigured;
  }

  private dailyLimitOf(name: EmailProviderName, config: EmailConfiguration): number {
    return name === 'smtp' ? config.smtp.dailyLimit : config.brevo.dailyLimit;
  }

  private resolveProviders(channel: EmailChannel, config: EmailConfiguration): EmailProviderName[] {
    const configured = (names: EmailProviderName[]) =>
      names.filter((name) => this.isProviderConfigured(name, config));

    const preferred = configured(config.routing[channel]);
    if (preferred.length > 0 || channel === 'transactional') {
      return preferred;
    }

    // Campanhas sem canal próprio configurado usam os canais do sistema,
    // ainda respeitando a reserva dos e-mails do sistema.
    this.log.warn('⚠️ Nenhum canal de campanhas configurado; usando os canais do sistema');
    return configured(config.routing.transactional);
  }

  public async send(
    emailData: EmailSendInput,
    options: { channel?: EmailChannel } = {},
  ): Promise<EmailSendResult> {
    const channel = options.channel ?? 'transactional';
    const config = await EmailConfigManager.getInstance().getRuntimeConfig();
    const providers = this.resolveProviders(channel, config);

    if (providers.length === 0) {
      const anyConfigured = ALL_PROVIDERS.some((name) => this.isProviderConfigured(name, config));
      if (!anyConfigured) {
        this.log.info(
          { to: emailData.to, subject: emailData.subject },
          '🎭 Email simulado enviado',
        );
        return { success: true, messageId: `sim_${Date.now()}`, simulated: true };
      }
      return {
        success: false,
        error: 'Nenhum canal de e-mail disponível para este tipo de envio',
        failureReason: 'NO_PROVIDER_AVAILABLE',
      };
    }

    let lastResult: EmailSendResult | null = null;

    for (const name of providers) {
      const dailyLimit = this.dailyLimitOf(name, config);
      const effectiveLimit =
        channel === 'marketing'
          ? Math.max(0, dailyLimit - config.routing.transactionalReserve)
          : dailyLimit;

      if (!(await emailUsageCounter.reserve(name, effectiveLimit))) {
        this.log.warn(
          { provider: name, channel, effectiveLimit },
          '⚠️ Limite diário do canal atingido; tentando o próximo',
        );
        lastResult = {
          success: false,
          provider: name,
          error: `Limite diário de envio atingido no canal ${name}`,
          failureReason: 'DAILY_LIMIT_REACHED',
        };
        continue;
      }

      const result = await this.clients[name].sendEmail(emailData);

      if (result.success && !result.simulated) {
        return { ...result, provider: name };
      }

      lastResult = result.success
        ? {
            success: false,
            provider: name,
            error: 'Canal em modo simulado',
            failureReason: 'SIMULATED',
          }
        : { ...result, provider: name };

      if (result.deliveryUncertain) {
        // Pode ter sido entregue: mantém a reserva e não reenvia por outro canal
        this.log.warn(
          { provider: name, to: emailData.to, failureReason: result.failureReason },
          '⚠️ Entrega incerta; não será reenviado por outro canal',
        );
        return lastResult;
      }

      await emailUsageCounter.release(name);
      if (result.failureReason === 'QUOTA_EXCEEDED') {
        await emailUsageCounter.markExhausted(name, dailyLimit);
      }

      this.log.warn(
        { provider: name, to: emailData.to, failureReason: result.failureReason },
        '⚠️ Falha no canal de e-mail; tentando o próximo',
      );
    }

    return (
      lastResult ?? {
        success: false,
        error: 'Nenhum canal de e-mail disponível',
        failureReason: 'NO_PROVIDER_AVAILABLE',
      }
    );
  }

  public async getHealthReport(): Promise<EmailHealthReport> {
    const config = await EmailConfigManager.getInstance().getRuntimeConfig();

    const providers = await Promise.all(
      ALL_PROVIDERS.map(async (name): Promise<EmailProviderHealth> => {
        const configured = this.isProviderConfigured(name, config);
        const healthy = configured ? await this.clients[name].healthCheck() : null;
        return {
          name,
          configured,
          healthy,
          dailyLimit: this.dailyLimitOf(name, config),
          usedToday: await emailUsageCounter.get(name),
          lastIssue: configured && !healthy ? this.clients[name].getLastOperationalIssue() : null,
        };
      }),
    );

    const configured = providers.filter((provider) => provider.configured);
    const healthyCount = configured.filter((provider) => provider.healthy).length;
    const simulated = configured.length === 0;

    let status: EmailHealthReport['status'] = 'healthy';
    if (!simulated && healthyCount === 0) status = 'unhealthy';
    else if (!simulated && healthyCount < configured.length) status = 'degraded';

    return { status, simulated, providers, routing: config.routing };
  }

  public async healthCheck(): Promise<boolean> {
    const report = await this.getHealthReport();
    return report.status !== 'unhealthy';
  }
}

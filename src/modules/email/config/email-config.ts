import { emailConfig } from '../../../config/env';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';

export function resolveEmailEnvironment(): 'development' | 'production' | 'test' {
  const rawNodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (rawNodeEnv === 'production' || rawNodeEnv === 'development' || rawNodeEnv === 'test') {
    return rawNodeEnv;
  }

  const renderSignals = [
    process.env.RENDER,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RENDER_SERVICE_ID,
  ].some((value) => Boolean(value));

  const vercelSignals = process.env.VERCEL_ENV === 'production';
  const hostedUrls = [
    process.env.FRONTEND_URL,
    process.env.AUTH_FRONTEND_URL,
    process.env.KEEP_ALIVE_URL,
    process.env.RENDER_EXTERNAL_URL,
  ].filter(Boolean) as string[];

  const hostedProductionUrls = hostedUrls.some(
    (url) => /^https:\/\//i.test(url) && !/(localhost|127\.0\.0\.1)/i.test(url),
  );

  if (renderSignals || vercelSignals || hostedProductionUrls) {
    return 'production';
  }

  return 'development';
}

/**
 * Configuração do módulo de e-mail (SMTP)
 * Implementa configuração centralizada com validação
 */
export interface EmailConfiguration {
  fromEmail: string;
  fromName: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
  };
  timeout: number;
  isConfigured: boolean;
  environment: string;

  // URLs para links
  urls: {
    frontend: string;
    verification: string;
    passwordRecovery: string;
  };

  // Configurações de verificação
  UsuariosVerificacaoEmail: {
    enabled: boolean;
    tokenExpirationHours: number;
    maxResendAttempts: number;
    resendCooldownMinutes: number;
  };

  passwordRecovery: {
    tokenExpirationMinutes: number;
    maxAttempts: number;
    cooldownMinutes: number;
  };
}

/**
 * Manager de configuração do e-mail
 */
export class EmailConfigManager {
  private static instance: EmailConfigManager;
  private config: EmailConfiguration;
  private readonly log = logger.child({ module: 'EmailConfigManager' });

  private constructor() {
    this.config = this.buildConfiguration();
    this.logConfiguration();
  }

  public static getInstance(): EmailConfigManager {
    if (!EmailConfigManager.instance) {
      EmailConfigManager.instance = new EmailConfigManager();
    }
    return EmailConfigManager.instance;
  }

  /**
   * Retorna configuração
   */
  public getConfig(): EmailConfiguration {
    return this.config;
  }

  public async getRuntimeConfig(): Promise<EmailConfiguration> {
    const runtimeConfig = await runtimeConfigService.getEmailConfig();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const authUrl = process.env.AUTH_FRONTEND_URL || `${frontendUrl}/auth`;

    return {
      fromEmail: runtimeConfig.fromEmail,
      fromName: runtimeConfig.fromName,
      smtp: runtimeConfig.smtp,
      timeout: runtimeConfig.timeout,
      isConfigured: runtimeConfig.isConfigured,
      environment: resolveEmailEnvironment(),
      urls: {
        frontend: frontendUrl,
        verification: `${authUrl}/verify-email`,
        passwordRecovery: `${authUrl}/recuperar-senha`,
      },
      UsuariosVerificacaoEmail: {
        enabled: runtimeConfig.emailVerification.enabled,
        tokenExpirationHours: runtimeConfig.emailVerification.tokenExpirationHours,
        maxResendAttempts: runtimeConfig.emailVerification.maxResendAttempts,
        resendCooldownMinutes: runtimeConfig.emailVerification.resendCooldownMinutes,
      },
      passwordRecovery: {
        tokenExpirationMinutes: runtimeConfig.passwordRecovery.tokenExpirationMinutes,
        maxAttempts: runtimeConfig.passwordRecovery.maxAttempts,
        cooldownMinutes: runtimeConfig.passwordRecovery.cooldownMinutes,
      },
    };
  }

  /**
   * Verifica se está configurado
   */
  public isConfigured(): boolean {
    return this.config.isConfigured;
  }

  /**
   * Verifica se verificação de email está habilitada
   */
  public isEmailVerificationEnabled(): boolean {
    return this.config.UsuariosVerificacaoEmail.enabled;
  }

  /**
   * Gera token de verificação
   */
  public generateVerificationToken(): string {
    return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  /**
   * Gera URL de verificação
   */
  public generateVerificationUrl(token: string): string {
    return `${this.config.urls.verification}?token=${token}`;
  }

  /**
   * Data de expiração do token
   */
  public getTokenExpirationDate(): Date {
    const hours = this.config.UsuariosVerificacaoEmail.tokenExpirationHours;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Health check
   */
  public getHealthInfo() {
    return {
      configured: this.config.isConfigured,
      environment: this.config.environment,
      UsuariosVerificacaoEmail: this.config.UsuariosVerificacaoEmail.enabled,
      urls: this.config.urls,
    };
  }

  /**
   * Constrói configuração completa
   */
  private buildConfiguration(): EmailConfiguration {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const authUrl = process.env.AUTH_FRONTEND_URL || `${frontendUrl}/auth`;

    return {
      fromEmail: emailConfig.fromEmail,
      fromName: emailConfig.fromName,
      smtp: {
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        user: emailConfig.smtp.user,
        password: emailConfig.smtp.password,
      },
      timeout: emailConfig.timeout,
      isConfigured: emailConfig.isValid(),
      environment: resolveEmailEnvironment(),

      urls: {
        frontend: frontendUrl,
        verification: `${authUrl}/verify-email`,
        passwordRecovery: `${authUrl}/recuperar-senha`,
      },

      UsuariosVerificacaoEmail: {
        enabled: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
        tokenExpirationHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRATION_HOURS || '72', 10),
        maxResendAttempts: parseInt(process.env.EMAIL_VERIFICATION_MAX_RESEND || '3', 10),
        resendCooldownMinutes: parseInt(process.env.EMAIL_VERIFICATION_COOLDOWN_MINUTES || '5', 10),
      },
      passwordRecovery: {
        tokenExpirationMinutes: emailConfig.passwordRecovery.tokenExpirationMinutes,
        maxAttempts: emailConfig.passwordRecovery.maxAttempts,
        cooldownMinutes: emailConfig.passwordRecovery.cooldownMinutes,
      },
    };
  }

  /**
   * Log da configuração
   */
  private logConfiguration(): void {
    if (!this.config.isConfigured) {
      this.log.warn('⚠️ SMTP não configurado - emails serão simulados');
    }

    this.log.info(
      {
        module: 'Email',
        configured: this.config.isConfigured,
        environment: this.config.environment,
        smtpHost: this.config.smtp.host,
        smtpPort: this.config.smtp.port,
        UsuariosVerificacaoEmailEnabled: this.config.UsuariosVerificacaoEmail.enabled,
      },
      '✅ Módulo de e-mail (SMTP) configurado',
    );
  }
}

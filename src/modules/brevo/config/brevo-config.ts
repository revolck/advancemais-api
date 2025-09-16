import { brevoConfig } from '../../../config/env';

/**
 * Configuração simplificada e robusta do módulo Brevo
 * Implementa configuração centralizada com validação
 */
export interface BrevoConfiguration {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
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
  emailVerification: {
    enabled: boolean;
    tokenExpirationHours: number;
    maxResendAttempts: number;
    resendCooldownMinutes: number;
  };
}

/**
 * Manager simplificado de configuração
 */
export class BrevoConfigManager {
  private static instance: BrevoConfigManager;
  private config: BrevoConfiguration;

  private constructor() {
    this.config = this.buildConfiguration();
    this.logConfiguration();
  }

  public static getInstance(): BrevoConfigManager {
    if (!BrevoConfigManager.instance) {
      BrevoConfigManager.instance = new BrevoConfigManager();
    }
    return BrevoConfigManager.instance;
  }

  /**
   * Retorna configuração
   */
  public getConfig(): BrevoConfiguration {
    return this.config;
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
    return this.config.emailVerification.enabled;
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
    const hours = this.config.emailVerification.tokenExpirationHours;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Health check
   */
  public getHealthInfo() {
    return {
      configured: this.config.isConfigured,
      environment: this.config.environment,
      emailVerification: this.config.emailVerification.enabled,
      urls: this.config.urls,
    };
  }

  /**
   * Constrói configuração completa
   */
  private buildConfiguration(): BrevoConfiguration {
    const isConfigured = !!(brevoConfig.apiKey && brevoConfig.fromEmail);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const authUrl = process.env.AUTH_FRONTEND_URL || `${frontendUrl}/auth`;

    return {
      apiKey: brevoConfig.apiKey || '',
      fromEmail: brevoConfig.fromEmail || 'noreply@advancemais.com',
      fromName: brevoConfig.fromName || 'Advance+',
      maxRetries: 3,
      timeout: 30000,
      isConfigured,
      environment: process.env.NODE_ENV || 'development',

      urls: {
        frontend: frontendUrl,
        verification: `${authUrl}/verify-email`,
        passwordRecovery: `${authUrl}/recuperar-senha`,
      },

      emailVerification: {
        enabled: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
        tokenExpirationHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRATION_HOURS || '72', 10),
        maxResendAttempts: parseInt(process.env.EMAIL_VERIFICATION_MAX_RESEND || '3', 10),
        resendCooldownMinutes: parseInt(process.env.EMAIL_VERIFICATION_COOLDOWN_MINUTES || '5', 10),
      },
    };
  }

  /**
   * Log da configuração
   */
  private logConfiguration(): void {
    if (!this.config.isConfigured) {
      console.warn('⚠️ Brevo não configurado - emails serão simulados');
    }

    console.log('✅ Brevo configurado com sucesso:', {
      module: 'Brevo',
      configured: this.config.isConfigured,
      environment: this.config.environment,
      emailVerificationEnabled: this.config.emailVerification.enabled,
      features: {
        transactionalEmails: true,
        emailVerification: this.config.emailVerification.enabled,
        passwordRecovery: true,
        welcomeEmails: true,
      },
    });
  }
}

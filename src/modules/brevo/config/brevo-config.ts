import { brevoConfig } from "../../../config/env";

/**
 * Configuração centralizada e validada do módulo Brevo
 * Implementa padrões de microserviços com validação rigorosa
 *
 * Características:
 * - Validação completa de configurações
 * - Fallbacks seguros para desenvolvimento
 * - Logs estruturados para observabilidade
 * - Configurações específicas por ambiente
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Refatoração completa para verificação de email
 */
export interface BrevoConfiguration {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
  timeout: number;
  isConfigured: boolean;
  environment: string;

  // Configurações de verificação de email
  emailVerification: {
    tokenExpirationHours: number;
    maxResendAttempts: number;
    resendCooldownMinutes: number;
    verificationRequired: boolean;
  };

  // URLs para links de verificação
  urls: {
    frontend: string;
    verification: string;
    passwordRecovery: string;
  };
}

export class BrevoConfigManager {
  private static instance: BrevoConfigManager;
  private config: BrevoConfiguration;

  private constructor() {
    this.config = this.buildConfiguration();
    this.validateConfiguration();
    this.logConfigurationStatus();
  }

  public static getInstance(): BrevoConfigManager {
    if (!BrevoConfigManager.instance) {
      BrevoConfigManager.instance = new BrevoConfigManager();
    }
    return BrevoConfigManager.instance;
  }

  /**
   * Constrói configuração completa com validação e fallbacks
   */
  private buildConfiguration(): BrevoConfiguration {
    const isConfigured = !!(brevoConfig.apiKey && brevoConfig.fromEmail);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    if (!isConfigured) {
      console.warn("⚠️ Brevo não configurado - emails serão simulados");
    }

    return {
      // Configurações básicas
      apiKey: brevoConfig.apiKey || "",
      fromEmail: brevoConfig.fromEmail || "noreply@advancemais.com",
      fromName: brevoConfig.fromName || "AdvanceMais",
      maxRetries: Math.min(brevoConfig.sending.maxRetries || 2, 3),
      timeout: Math.min(brevoConfig.sending.timeout || 15000, 30000),
      isConfigured,
      environment: process.env.NODE_ENV || "development",

      // Configurações de verificação de email
      emailVerification: {
        tokenExpirationHours: parseInt(
          process.env.EMAIL_VERIFICATION_EXPIRATION_HOURS || "24",
          10
        ),
        maxResendAttempts: parseInt(
          process.env.EMAIL_VERIFICATION_MAX_RESEND || "3",
          10
        ),
        resendCooldownMinutes: parseInt(
          process.env.EMAIL_VERIFICATION_COOLDOWN_MINUTES || "5",
          10
        ),
        verificationRequired:
          process.env.EMAIL_VERIFICATION_REQUIRED !== "false", // Default true
      },

      // URLs configuráveis
      urls: {
        frontend: frontendUrl,
        verification: `${frontendUrl}/verificar-email`,
        passwordRecovery: `${frontendUrl}/recuperar-senha`,
      },
    };
  }

  /**
   * Valida configuração com feedback detalhado
   */
  private validateConfiguration(): void {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Validações críticas
    if (!this.config.apiKey && this.config.environment === "production") {
      issues.push("BREVO_API_KEY é obrigatório em produção");
    }

    if (!this.isValidEmail(this.config.fromEmail)) {
      issues.push("BREVO_FROM_EMAIL deve ser um email válido");
    }

    if (!this.isValidUrl(this.config.urls.frontend)) {
      issues.push("FRONTEND_URL deve ser uma URL válida");
    }

    // Validações de segurança
    if (this.config.environment === "production") {
      if (
        this.config.fromEmail.includes("test") ||
        this.config.fromEmail.includes("dev")
      ) {
        warnings.push("Email de produção não deve conter 'test' ou 'dev'");
      }

      if (this.config.urls.frontend.includes("localhost")) {
        warnings.push("Frontend URL em produção não deve usar localhost");
      }

      if (!this.config.apiKey.startsWith("xkeysib-") && this.config.apiKey) {
        warnings.push("API Key pode não estar no formato correto");
      }
    }

    // Validações de configuração de verificação
    if (
      this.config.emailVerification.tokenExpirationHours < 1 ||
      this.config.emailVerification.tokenExpirationHours > 72
    ) {
      warnings.push("Token de verificação deve expirar entre 1 e 72 horas");
    }

    if (this.config.emailVerification.maxResendAttempts > 10) {
      warnings.push("Máximo de tentativas de reenvio muito alto (>10)");
    }

    // Log de problemas
    if (issues.length > 0) {
      console.error("❌ Problemas críticos na configuração do Brevo:");
      issues.forEach((issue) => console.error(`   - ${issue}`));

      if (this.config.environment === "production") {
        throw new Error("Configuração crítica do Brevo inválida para produção");
      }
    }

    if (warnings.length > 0) {
      console.warn("⚠️ Avisos de configuração do Brevo:");
      warnings.forEach((warning) => console.warn(`   - ${warning}`));
    }
  }

  /**
   * Log estruturado do status da configuração
   */
  private logConfigurationStatus(): void {
    const status = {
      module: "Brevo",
      configured: this.config.isConfigured,
      environment: this.config.environment,
      emailVerificationEnabled:
        this.config.emailVerification.verificationRequired,
      features: {
        transactionalEmails:
          this.config.isConfigured || this.config.environment === "development",
        emailVerification: true,
        passwordRecovery: true,
        welcomeEmails: true,
      },
    };

    if (this.config.isConfigured) {
      console.log("✅ Brevo configurado com sucesso:", status);
    } else {
      console.log("🎭 Brevo em modo simulado:", status);
    }
  }

  // Getters públicos
  public getConfig(): BrevoConfiguration {
    return { ...this.config };
  }

  public isProductionReady(): boolean {
    return (
      this.config.isConfigured &&
      this.isValidEmail(this.config.fromEmail) &&
      this.config.apiKey.length > 20 &&
      this.isValidUrl(this.config.urls.frontend)
    );
  }

  public isDevelopment(): boolean {
    return this.config.environment === "development";
  }

  public isProduction(): boolean {
    return this.config.environment === "production";
  }

  public isEmailVerificationEnabled(): boolean {
    return this.config.emailVerification.verificationRequired;
  }

  /**
   * Gera token de verificação seguro
   */
  public generateVerificationToken(): string {
    const crypto = require("crypto");
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Gera URL de verificação completa
   */
  public generateVerificationUrl(token: string): string {
    return `${this.config.urls.verification}?token=${token}`;
  }

  /**
   * Calcula data de expiração do token
   */
  public getTokenExpirationDate(): Date {
    const expiration = new Date();
    expiration.setHours(
      expiration.getHours() + this.config.emailVerification.tokenExpirationHours
    );
    return expiration;
  }

  /**
   * Configurações de timeout otimizadas por ambiente
   */
  public getTimeoutConfig(): {
    connect: number;
    request: number;
    retry: number;
  } {
    const baseTimeout = this.config.timeout;
    return {
      connect: Math.min(baseTimeout / 2, 10000),
      request: baseTimeout,
      retry: Math.min(baseTimeout * 1.5, 45000),
    };
  }

  /**
   * Configurações de retry com backoff exponencial
   */
  public getRetryConfig(): {
    attempts: number;
    delay: number;
    backoff: boolean;
  } {
    return {
      attempts: this.config.maxRetries,
      delay: this.isDevelopment() ? 1000 : 2000,
      backoff: true,
    };
  }

  /**
   * Atualiza configuração dinamicamente (para testes)
   */
  public updateConfig(updates: Partial<BrevoConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
    console.log("🔄 Configuração do Brevo atualizada dinamicamente");
  }

  /**
   * Health check detalhado
   */
  public getHealthInfo(): {
    configured: boolean;
    environment: string;
    emailVerification: boolean;
    urls: { frontend: string; verification: string };
    ready: boolean;
  } {
    return {
      configured: this.config.isConfigured,
      environment: this.config.environment,
      emailVerification: this.config.emailVerification.verificationRequired,
      urls: {
        frontend: this.config.urls.frontend,
        verification: this.config.urls.verification,
      },
      ready: this.isProductionReady(),
    };
  }

  /**
   * Configuração sanitizada para logs (sem dados sensíveis)
   */
  public getSanitizedConfig(): Partial<BrevoConfiguration> {
    return {
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
      isConfigured: this.config.isConfigured,
      environment: this.config.environment,
      emailVerification: this.config.emailVerification,
      urls: this.config.urls,
    };
  }

  // Métodos auxiliares privados
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

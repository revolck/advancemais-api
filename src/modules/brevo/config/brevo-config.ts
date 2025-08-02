import { brevoConfig } from "../../../config/env";

/**
 * Configuração centralizada e simplificada do módulo Brevo
 *
 * Responsabilidades:
 * - Validar configurações obrigatórias
 * - Fornecer interface limpa para o módulo
 * - Implementar fallbacks seguros
 *
 * @author Sistema AdvanceMais
 * @version 5.0.1 - Correção e melhorias de validação
 */
export interface BrevoConfiguration {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
  timeout: number;
  isConfigured: boolean;
  environment: string;
}

export class BrevoConfigManager {
  private static instance: BrevoConfigManager;
  private config: BrevoConfiguration;

  private constructor() {
    this.config = this.buildConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): BrevoConfigManager {
    if (!BrevoConfigManager.instance) {
      BrevoConfigManager.instance = new BrevoConfigManager();
    }
    return BrevoConfigManager.instance;
  }

  /**
   * Constrói configuração validada com fallbacks seguros
   */
  private buildConfiguration(): BrevoConfiguration {
    const isConfigured = !!(brevoConfig.apiKey && brevoConfig.fromEmail);

    if (!isConfigured) {
      console.warn("⚠️ Brevo não configurado - emails e SMS serão simulados");
    }

    return {
      apiKey: brevoConfig.apiKey || "",
      fromEmail: brevoConfig.fromEmail || "noreply@advancemais.com",
      fromName: brevoConfig.fromName || "AdvanceMais",
      maxRetries: Math.min(brevoConfig.sending.maxRetries || 2, 3), // Máximo 3 tentativas
      timeout: Math.min(brevoConfig.sending.timeout || 15000, 30000), // Máximo 30s
      isConfigured,
      environment: process.env.NODE_ENV || "development",
    };
  }

  /**
   * Valida configuração com feedback detalhado
   */
  private validateConfiguration(): void {
    const issues: string[] = [];

    // Validações obrigatórias
    if (!this.config.apiKey) {
      issues.push("BREVO_API_KEY não configurado");
    }

    if (!this.isValidEmail(this.config.fromEmail)) {
      issues.push("BREVO_FROM_EMAIL deve ser um email válido");
    }

    // Validações de segurança para produção
    if (this.config.environment === "production") {
      if (
        this.config.fromEmail.includes("test") ||
        this.config.fromEmail.includes("dev")
      ) {
        issues.push("Email de produção não deve conter 'test' ou 'dev'");
      }

      if (!this.config.apiKey.startsWith("xkeysib-")) {
        console.warn(
          "⚠️ API Key pode não estar no formato correto para produção"
        );
      }
    }

    // Log de validação
    if (issues.length > 0) {
      console.warn("⚠️ Problemas na configuração do Brevo:");
      issues.forEach((issue) => console.warn(`   - ${issue}`));

      if (this.config.environment === "production") {
        console.error("❌ Configuração crítica do Brevo em produção");
      }
    } else {
      console.log("✅ Configuração do Brevo validada com sucesso");
    }
  }

  public getConfig(): BrevoConfiguration {
    return { ...this.config };
  }

  /**
   * Valida se a configuração é válida para produção
   */
  public isProductionReady(): boolean {
    return (
      this.config.isConfigured &&
      this.isValidEmail(this.config.fromEmail) &&
      this.config.apiKey.length > 20 // Validação básica de comprimento da API key
    );
  }

  /**
   * Verifica se está em modo de desenvolvimento
   */
  public isDevelopment(): boolean {
    return this.config.environment === "development";
  }

  /**
   * Verifica se está em modo de produção
   */
  public isProduction(): boolean {
    return this.config.environment === "production";
  }

  /**
   * Retorna configurações de timeout baseadas no ambiente
   */
  public getTimeoutConfig(): {
    connect: number;
    request: number;
    retry: number;
  } {
    const baseTimeout = this.config.timeout;

    return {
      connect: Math.min(baseTimeout / 2, 10000), // Máximo 10s para conexão
      request: baseTimeout,
      retry: Math.min(baseTimeout * 1.5, 45000), // Máximo 45s para retry
    };
  }

  /**
   * Retorna configurações de retry baseadas no ambiente
   */
  public getRetryConfig(): {
    attempts: number;
    delay: number;
    backoff: boolean;
  } {
    return {
      attempts: this.config.maxRetries,
      delay: this.isDevelopment() ? 1000 : 2000, // 1s em dev, 2s em prod
      backoff: true, // Backoff exponencial
    };
  }

  /**
   * Atualiza configuração dinamicamente (útil para testes)
   */
  public updateConfig(updates: Partial<BrevoConfiguration>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
    console.log("🔄 Configuração do Brevo atualizada");
  }

  /**
   * Obtém informações de status para health check
   */
  public getHealthInfo(): {
    configured: boolean;
    environment: string;
    hasApiKey: boolean;
    hasValidEmail: boolean;
    ready: boolean;
  } {
    return {
      configured: this.config.isConfigured,
      environment: this.config.environment,
      hasApiKey: !!this.config.apiKey,
      hasValidEmail: this.isValidEmail(this.config.fromEmail),
      ready: this.isProductionReady(),
    };
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Obtém configurações sanitizadas para logs (sem dados sensíveis)
   */
  public getSanitizedConfig(): Partial<BrevoConfiguration> {
    return {
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
      isConfigured: this.config.isConfigured,
      environment: this.config.environment,
      // API Key é omitida por segurança
    };
  }
}

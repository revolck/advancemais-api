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
 * @version 5.0.0 - Refatoração para simplicidade
 */
export interface BrevoConfiguration {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  maxRetries: number;
  timeout: number;
  isConfigured: boolean;
}

export class BrevoConfigManager {
  private static instance: BrevoConfigManager;
  private config: BrevoConfiguration;

  private constructor() {
    this.config = this.buildConfiguration();
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
      console.warn("⚠️ Brevo não configurado - emails serão simulados");
    }

    return {
      apiKey: brevoConfig.apiKey || "",
      fromEmail: brevoConfig.fromEmail || "noreply@advancemais.com",
      fromName: brevoConfig.fromName || "AdvanceMais",
      maxRetries: Math.min(brevoConfig.sending.maxRetries || 2, 3), // Máximo 3 tentativas
      timeout: Math.min(brevoConfig.sending.timeout || 15000, 30000), // Máximo 30s
      isConfigured,
    };
  }

  public getConfig(): BrevoConfiguration {
    return { ...this.config };
  }

  /**
   * Valida se a configuração é válida para produção
   */
  public isProductionReady(): boolean {
    return this.config.isConfigured && this.isValidEmail(this.config.fromEmail);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

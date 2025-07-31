import { brevoConfig } from "../../../config/env";
import { IBrevoConfig } from "../types/interfaces";

/**
 * Configuração centralizada do módulo Brevo
 * Valida e normaliza as configurações de ambiente
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
export class BrevoConfigManager {
  private static instance: BrevoConfigManager;
  private config: IBrevoConfig;

  private constructor() {
    this.config = this.validateAndNormalizeConfig();
  }

  /**
   * Singleton para configuração
   */
  public static getInstance(): BrevoConfigManager {
    if (!BrevoConfigManager.instance) {
      BrevoConfigManager.instance = new BrevoConfigManager();
    }
    return BrevoConfigManager.instance;
  }

  /**
   * Valida e normaliza configurações
   */
  private validateAndNormalizeConfig(): IBrevoConfig {
    // Validações obrigatórias
    if (!brevoConfig.apiKey) {
      throw new Error("BREVO_API_KEY é obrigatório");
    }

    if (!brevoConfig.fromEmail || !this.isValidEmail(brevoConfig.fromEmail)) {
      throw new Error("BREVO_FROM_EMAIL deve ser um email válido");
    }

    return {
      apiKey: brevoConfig.apiKey,
      fromEmail: brevoConfig.fromEmail,
      fromName: brevoConfig.fromName || "AdvanceMais",
      maxRetries: brevoConfig.sending.maxRetries || 3,
      retryDelay: brevoConfig.sending.retryDelay || 1000,
      timeout: brevoConfig.sending.timeout || 30000,
    };
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Retorna configuração validada
   */
  public getConfig(): IBrevoConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração (apenas para testes)
   */
  public updateConfig(newConfig: Partial<IBrevoConfig>): void {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Configuração só pode ser alterada em ambiente de teste");
    }
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset para testes
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Reset só permitido em ambiente de teste");
    }
    BrevoConfigManager.instance = null as any;
  }
}

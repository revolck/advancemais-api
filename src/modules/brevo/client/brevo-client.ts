import * as Brevo from "@getbrevo/brevo";
import { BrevoConfigManager, BrevoConfiguration } from "../config/brevo-config";

/**
 * Cliente Brevo simplificado e robusto
 *
 * Responsabilidades:
 * - Gerenciar conexão com API Brevo
 * - Fornecer APIs configuradas
 * - Health check não-crítico
 *
 * @author Sistema AdvanceMais
 * @version 5.0.1 - Correção TypeScript
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private emailAPI!: Brevo.TransactionalEmailsApi; // Definite assignment assertion
  private smsAPI!: Brevo.TransactionalSMSApi; // Para uso futuro
  private accountAPI!: Brevo.AccountApi;
  private config: BrevoConfiguration;
  private isHealthy: boolean = false;

  private constructor() {
    this.config = BrevoConfigManager.getInstance().getConfig();
    this.initializeAPIs();
    this.performHealthCheckAsync(); // Async para não bloquear construtor
  }

  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  /**
   * Inicializa APIs do Brevo com configuração segura
   */
  private initializeAPIs(): void {
    try {
      this.emailAPI = new Brevo.TransactionalEmailsApi();
      this.smsAPI = new Brevo.TransactionalSMSApi();
      this.accountAPI = new Brevo.AccountApi();

      if (this.config.apiKey) {
        // Configura API key para todas as APIs
        this.emailAPI.setApiKey(
          Brevo.TransactionalEmailsApiApiKeys.apiKey,
          this.config.apiKey
        );
        this.smsAPI.setApiKey(
          Brevo.TransactionalSMSApiApiKeys.apiKey,
          this.config.apiKey
        );
        this.accountAPI.setApiKey(
          Brevo.AccountApiApiKeys.apiKey,
          this.config.apiKey
        );
      }

      console.log("✅ Brevo APIs inicializadas");
    } catch (error) {
      console.error("❌ Erro ao inicializar Brevo APIs:", error);
      // Cliente continua funcionando em modo simulado
    }
  }

  /**
   * Health check assíncrono e não-crítico
   */
  private async performHealthCheckAsync(): Promise<void> {
    if (!this.config.isConfigured) {
      console.log("ℹ️ Brevo em modo simulado (API Key não configurada)");
      return;
    }

    // Executa em background sem bloquear
    setImmediate(async () => {
      try {
        // Timeout rápido para não atrasar inicialização
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Health check timeout")), 5000)
        );

        // Usa accountAPI.getAccount() ao invés de emailAPI.getAccount()
        await Promise.race([this.accountAPI.getAccount(), timeoutPromise]);

        this.isHealthy = true;
        console.log("✅ Brevo conectado com sucesso");
      } catch (error) {
        console.warn("⚠️ Brevo health check falhou (modo degradado)");
        // Não quebra a aplicação
      }
    });
  }

  public getEmailAPI(): Brevo.TransactionalEmailsApi {
    return this.emailAPI;
  }

  public getSMSAPI(): Brevo.TransactionalSMSApi {
    return this.smsAPI;
  }

  public getAccountAPI(): Brevo.AccountApi {
    return this.accountAPI;
  }

  public getConfig(): BrevoConfiguration {
    return this.config;
  }

  public isOperational(): boolean {
    return this.config.isConfigured && this.isHealthy;
  }

  public isSimulated(): boolean {
    return !this.config.isConfigured;
  }

  /**
   * Health check público para verificações externas
   */
  public async checkHealth(): Promise<boolean> {
    if (!this.config.isConfigured) {
      return true; // Modo simulado é considerado saudável
    }

    try {
      await this.accountAPI.getAccount();
      this.isHealthy = true;
      return true;
    } catch (error) {
      this.isHealthy = false;
      return false;
    }
  }
}

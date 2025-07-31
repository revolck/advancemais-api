import * as Brevo from "@getbrevo/brevo";
import { BrevoConfigManager } from "../config/brevo-config";
import { IBrevoConfig } from "../types/interfaces";

/**
 * Cliente Brevo com padrão Singleton e validação robusta
 * Implementa retry automático e health checks
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private transactionalEmailsApi!: Brevo.TransactionalEmailsApi;
  private transactionalSMSApi!: Brevo.TransactionalSMSApi;
  private accountApi!: Brevo.AccountApi;
  private config: IBrevoConfig;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date | null = null;

  /**
   * Construtor privado para Singleton
   */
  private constructor() {
    this.config = BrevoConfigManager.getInstance().getConfig();
    this.initializeAPIs();
    this.performInitialHealthCheck();
  }

  /**
   * Retorna instância singleton
   */
  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  /**
   * Inicializa APIs do Brevo
   */
  private initializeAPIs(): void {
    try {
      this.transactionalEmailsApi = new Brevo.TransactionalEmailsApi();
      this.transactionalSMSApi = new Brevo.TransactionalSMSApi();
      this.accountApi = new Brevo.AccountApi();

      // Configura API key para todas as instâncias
      this.transactionalEmailsApi.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        this.config.apiKey
      );
      this.transactionalSMSApi.setApiKey(
        Brevo.TransactionalSMSApiApiKeys.apiKey,
        this.config.apiKey
      );
      this.accountApi.setApiKey(
        Brevo.AccountApiApiKeys.apiKey,
        this.config.apiKey
      );

      console.log("✅ APIs do Brevo inicializadas com sucesso");
    } catch (error) {
      console.error("❌ Erro ao inicializar APIs do Brevo:", error);
      throw new Error(`Falha na inicialização do cliente Brevo: ${error}`);
    }
  }

  /**
   * Realiza health check inicial
   */
  private async performInitialHealthCheck(): Promise<void> {
    try {
      await this.checkHealth();
      console.log("✅ Health check inicial do Brevo concluído");
    } catch (error) {
      console.warn("⚠️ Health check inicial falhou:", error);
    }
  }

  /**
   * Verifica saúde do cliente
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.accountApi.getAccount();
      const responseTime = Date.now() - startTime;

      this.isHealthy = true;
      this.lastHealthCheck = new Date();

      console.log(`✅ Brevo healthy (${responseTime}ms)`);
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      console.error("❌ Brevo health check failed:", error);
      return false;
    }
  }

  /**
   * Retorna API de emails transacionais
   */
  public getEmailAPI(): Brevo.TransactionalEmailsApi {
    return this.transactionalEmailsApi;
  }

  /**
   * Retorna API de SMS transacionais
   */
  public getSMSAPI(): Brevo.TransactionalSMSApi {
    return this.transactionalSMSApi;
  }

  /**
   * Retorna API de conta
   */
  public getAccountAPI(): Brevo.AccountApi {
    return this.accountApi;
  }

  /**
   * Verifica se cliente está saudável
   */
  public getHealthStatus(): { healthy: boolean; lastCheck: Date | null } {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
    };
  }

  /**
   * Retorna configuração atual
   */
  public getConfig(): IBrevoConfig {
    return { ...this.config };
  }

  /**
   * Força reset da instância (apenas para testes)
   */
  public static resetInstance(): void {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Reset só permitido em ambiente de teste");
    }
    BrevoClient.instance = null as any;
  }
}

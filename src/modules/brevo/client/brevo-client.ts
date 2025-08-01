import * as Brevo from "@getbrevo/brevo";
import { BrevoConfigManager } from "../config/brevo-config";
import { IBrevoConfig } from "../types/interfaces";

/**
 * Cliente Brevo com tratamento de erro gracioso
 * Health check não-crítico para não quebrar a aplicação
 *
 * @author Sistema AdvanceMais
 * @version 3.0.4 - Correção health check gracioso
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private transactionalEmailsApi!: Brevo.TransactionalEmailsApi;
  private transactionalSMSApi!: Brevo.TransactionalSMSApi;
  private accountApi!: Brevo.AccountApi;
  private config: IBrevoConfig;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date | null = null;
  private healthCheckError: string | null = null;

  /**
   * Construtor privado para Singleton
   */
  private constructor() {
    this.config = BrevoConfigManager.getInstance().getConfig();
    this.initializeAPIs();
    this.performInitialHealthCheckSilent();
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

      console.log("✅ APIs do Brevo inicializadas");
    } catch (error) {
      console.error("❌ Erro ao inicializar APIs do Brevo:", error);
      throw new Error(`Falha na inicialização do cliente Brevo: ${error}`);
    }
  }

  /**
   * Health check inicial silencioso (não quebra a aplicação)
   */
  private async performInitialHealthCheckSilent(): Promise<void> {
    try {
      await this.checkHealth();
    } catch (error) {
      // Health check falhou, mas não quebra a aplicação
      console.warn("⚠️ Brevo health check inicial falhou (não-crítico)");
    }
  }

  /**
   * Verifica saúde do cliente com tratamento de erro gracioso
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.accountApi.getAccount();
      const responseTime = Date.now() - startTime;

      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      this.healthCheckError = null;

      console.log(`✅ Brevo healthy (${responseTime}ms)`);
      return true;
    } catch (error: any) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      // Tratamento específico de erros
      if (error.statusCode === 401) {
        this.healthCheckError = "API Key inválida ou expirada";
        console.warn("⚠️ Brevo: API Key inválida - verifique BREVO_API_KEY");
      } else if (error.statusCode === 403) {
        this.healthCheckError = "Acesso negado - verifique permissões";
        console.warn("⚠️ Brevo: Acesso negado");
      } else if (error.code === "ENOTFOUND") {
        this.healthCheckError = "Problema de conectividade";
        console.warn("⚠️ Brevo: Problema de rede");
      } else {
        this.healthCheckError = "Erro desconhecido";
        console.warn("⚠️ Brevo: Health check falhou");
      }

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
  public getHealthStatus(): {
    healthy: boolean;
    lastCheck: Date | null;
    error: string | null;
  } {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      error: this.healthCheckError,
    };
  }

  /**
   * Retorna configuração atual
   */
  public getConfig(): IBrevoConfig {
    return { ...this.config };
  }

  /**
   * Verifica se está configurado (sem fazer health check)
   */
  public async isConfigured(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.fromEmail);
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

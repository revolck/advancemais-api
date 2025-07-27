import * as Brevo from "@getbrevo/brevo";
import { brevoConfig } from "../../../config/env";

/**
 * Cliente Brevo configurado para a aplicação
 * Centraliza a configuração da API do Brevo
 */
class BrevoClient {
  private static instance: BrevoClient;
  private transactionalEmailsApi: Brevo.TransactionalEmailsApi;
  private transactionalSMSApi: Brevo.TransactionalSMSApi;
  private accountApi: Brevo.AccountApi;

  private constructor() {
    // Configura as instâncias da API do Brevo
    this.transactionalEmailsApi = new Brevo.TransactionalEmailsApi();
    this.transactionalSMSApi = new Brevo.TransactionalSMSApi();
    this.accountApi = new Brevo.AccountApi();

    // Configura as chaves de API
    this.transactionalEmailsApi.setApiKey(0, brevoConfig.apiKey);
    this.transactionalSMSApi.setApiKey(0, brevoConfig.apiKey);
    this.accountApi.setApiKey(0, brevoConfig.apiKey);
  }

  /**
   * Retorna a instância singleton do cliente Brevo
   * @returns Instância configurada do cliente
   */
  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  /**
   * Retorna a instância da API de emails transacionais
   * @returns Instância da API configurada
   */
  public getTransactionalEmailsApi(): Brevo.TransactionalEmailsApi {
    return this.transactionalEmailsApi;
  }

  /**
   * Retorna a instância da API de SMS transacionais
   * @returns Instância da API configurada
   */
  public getTransactionalSMSApi(): Brevo.TransactionalSMSApi {
    return this.transactionalSMSApi;
  }

  /**
   * Retorna a instância da API de conta
   * @returns Instância da API configurada
   */
  public getAccountApi(): Brevo.AccountApi {
    return this.accountApi;
  }

  /**
   * Verifica se o cliente está corretamente configurado
   * @returns Promise<boolean> Status da configuração
   */
  public async isConfigured(): Promise<boolean> {
    try {
      await this.accountApi.getAccount();
      return true;
    } catch (error) {
      console.error("Erro ao verificar configuração do Brevo:", error);
      return false;
    }
  }
}

export { BrevoClient };

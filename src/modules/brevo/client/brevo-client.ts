import * as Brevo from "@getbrevo/brevo";
import { brevoConfig } from "../../../config/env";

/**
 * Cliente Brevo (ex-Sendinblue) configurado para a aplicação
 * Centraliza toda a configuração da API do Brevo para envio de emails e SMS
 *
 * Funcionalidades:
 * - Configuração automática das APIs (Email e SMS)
 * - Padrão Singleton para economia de recursos
 * - Validação de configuração
 * - Métodos auxiliares para verificar conectividade
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
export class BrevoClient {
  private static instance: BrevoClient;
  private transactionalEmailsApi: Brevo.TransactionalEmailsApi;
  private transactionalSMSApi: Brevo.TransactionalSMSApi;
  private accountApi: Brevo.AccountApi;
  private apiKey: string;

  /**
   * Construtor privado para implementar padrão Singleton
   * Configura todas as instâncias da API do Brevo com a chave fornecida
   */
  private constructor() {
    this.apiKey = brevoConfig.apiKey;

    // Inicializa as APIs do Brevo
    this.transactionalEmailsApi = new Brevo.TransactionalEmailsApi();
    this.transactionalSMSApi = new Brevo.TransactionalSMSApi();
    this.accountApi = new Brevo.AccountApi();

    // Configura a chave de API para todas as instâncias
    this.transactionalEmailsApi.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      this.apiKey
    );
    this.transactionalSMSApi.setApiKey(
      Brevo.TransactionalSMSApiApiKeys.apiKey,
      this.apiKey
    );
    this.accountApi.setApiKey(Brevo.AccountApiApiKeys.apiKey, this.apiKey);

    console.log("✅ Brevo Client configurado com sucesso");
  }

  /**
   * Retorna a instância singleton do cliente Brevo
   * Cria uma nova instância apenas se não existir
   *
   * @returns {BrevoClient} Instância configurada do cliente
   */
  public static getInstance(): BrevoClient {
    if (!BrevoClient.instance) {
      BrevoClient.instance = new BrevoClient();
    }
    return BrevoClient.instance;
  }

  /**
   * Retorna a instância configurada da API de emails transacionais
   * Usada para enviar emails automatizados do sistema
   *
   * @returns {Brevo.TransactionalEmailsApi} API configurada para emails
   */
  public getTransactionalEmailsApi(): Brevo.TransactionalEmailsApi {
    return this.transactionalEmailsApi;
  }

  /**
   * Retorna a instância configurada da API de SMS transacionais
   * Usada para enviar SMS automatizados do sistema
   *
   * @returns {Brevo.TransactionalSMSApi} API configurada para SMS
   */
  public getTransactionalSMSApi(): Brevo.TransactionalSMSApi {
    return this.transactionalSMSApi;
  }

  /**
   * Retorna a instância da API de conta
   * Usada para obter informações da conta e validar configuração
   *
   * @returns {Brevo.AccountApi} API configurada para conta
   */
  public getAccountApi(): Brevo.AccountApi {
    return this.accountApi;
  }

  /**
   * Verifica se o cliente está corretamente configurado
   * Faz uma chamada de teste para a API para validar as credenciais
   *
   * @returns {Promise<boolean>} true se configurado corretamente, false caso contrário
   */
  public async isConfigured(): Promise<boolean> {
    try {
      console.log("🔧 Testando configuração do Brevo...");

      // Tenta obter informações da conta para validar a API key
      await this.accountApi.getAccount();

      console.log("✅ Brevo configurado e conectado com sucesso");
      return true;
    } catch (error) {
      console.error("❌ Erro ao verificar configuração do Brevo:", error);

      // Se o erro for de autenticação, a API key está incorreta
      if (error instanceof Error) {
        if (
          error.message.includes("401") ||
          error.message.includes("Unauthorized")
        ) {
          console.error("🔑 API Key do Brevo inválida ou expirada");
        } else if (
          error.message.includes("403") ||
          error.message.includes("Forbidden")
        ) {
          console.error("🚫 API Key do Brevo sem permissões suficientes");
        } else {
          console.error("🌐 Erro de conectividade com Brevo:", error.message);
        }
      }

      return false;
    }
  }

  /**
   * Retorna informações básicas da conta Brevo
   * Útil para debugging e monitoramento
   *
   * @returns {Promise<any>} Informações da conta ou null em caso de erro
   */
  public async getAccountInfo(): Promise<any> {
    try {
      const accountInfo = await this.accountApi.getAccount();
      return accountInfo;
    } catch (error) {
      console.error("Erro ao obter informações da conta Brevo:", error);
      return null;
    }
  }

  /**
   * Valida se a API key está no formato correto
   * Brevo API keys geralmente seguem um padrão específico
   *
   * @returns {boolean} true se o formato parece válido
   */
  public validateApiKeyFormat(): boolean {
    if (!this.apiKey || this.apiKey.trim() === "") {
      console.error("❌ API Key do Brevo não configurada");
      return false;
    }

    // Brevo API keys geralmente têm um formato específico
    // Validação básica de formato (ajuste conforme necessário)
    if (this.apiKey.length < 20) {
      console.error("❌ API Key do Brevo parece muito curta");
      return false;
    }

    return true;
  }

  /**
   * Força uma nova instância do cliente (útil para testes ou reconfiguração)
   * Use com cuidado em produção
   */
  public static resetInstance(): void {
    BrevoClient.instance = null as any;
    console.log("🔄 Instância do Brevo Client resetada");
  }
}

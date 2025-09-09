import { MercadoPagoConfig } from "mercadopago";
import { ClientType, Environment } from "../enums";
import { mercadoPagoConfig } from "../../../config/env";

/**
 * Cliente MercadoPago configurado para a aplicação
 * Centraliza a configuração da API do MercadoPago usando o SDK oficial
 */
export class MercadoPagoClient {
  private static instances: Partial<Record<ClientType, MercadoPagoClient>> = {};
  private clientType: ClientType;
  private client: MercadoPagoConfig;
  private accessToken: string;
  private publicKey: string;
  private environment: Environment;

  private constructor(type: ClientType) {
    this.clientType = type;

      const envKey =
        mercadoPagoConfig.environment === "production" ? "prod" : "test";

      if (type === ClientType.CHECKOUT_TRANSPARENT) {
        this.accessToken =
          mercadoPagoConfig.checkoutTransparent[envKey].accessToken;
        this.publicKey =
          mercadoPagoConfig.checkoutTransparent[envKey].publicKey;
      } else {
        this.accessToken = mercadoPagoConfig.subscriptions[envKey].accessToken;
        this.publicKey = mercadoPagoConfig.subscriptions[envKey].publicKey;
      }
      this.environment = mercadoPagoConfig.environment as Environment;

    // Configura o cliente do MercadoPago
    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: this.generateIdempotencyKey(),
      },
    });

    console.log(
      `🏦 MercadoPago Client (${type}) configurado para ambiente: ${this.environment}`
    );
  }

  /**
   * Retorna a instância singleton do cliente MercadoPago
   * @returns Instância configurada do cliente
   */
  public static getInstance(type: ClientType = ClientType.SUBSCRIPTIONS): MercadoPagoClient {
    if (!MercadoPagoClient.instances[type]) {
      MercadoPagoClient.instances[type] = new MercadoPagoClient(type);
    }
    return MercadoPagoClient.instances[type]!;
  }

  /**
   * Retorna o cliente configurado do MercadoPago
   * @returns Cliente MercadoPago
   */
  public getClient(): MercadoPagoConfig {
    return this.client;
  }

  /**
   * Retorna a chave pública para uso no frontend
   * @returns Chave pública
   */
  public getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Retorna o ambiente atual (sandbox ou production)
   * @returns Ambiente configurado
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Verifica se está em ambiente de teste
   * @returns true se sandbox, false se production
   */
  public isSandbox(): boolean {
    return this.environment === Environment.SANDBOX;
  }

  /**
   * Gera uma chave de idempotência única
   * @returns String única para idempotência
   */
  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gera uma nova chave de idempotência para requisições
   * @returns Nova chave de idempotência
   */
  public generateNewIdempotencyKey(): string {
    return this.generateIdempotencyKey();
  }

  /**
   * Valida as configurações do cliente
   * @returns true se configurado corretamente
   */
  public validateConfiguration(): boolean {
    if (!this.accessToken || this.accessToken.trim() === "") {
      console.error("❌ MercadoPago: Access Token não configurado");
      return false;
    }

    if (!this.publicKey || this.publicKey.trim() === "") {
      console.error("❌ MercadoPago: Public Key não configurada");
      return false;
    }

    // Validação básica do formato do token
    if (
      this.environment === Environment.SANDBOX &&
      !this.accessToken.includes("TEST")
    ) {
      console.error(
        "❌ MercadoPago: Access Token deve ser de teste para ambiente sandbox"
      );
      return false;
    }

    if (
      this.environment === Environment.PRODUCTION &&
      this.accessToken.includes("TEST")
    ) {
      console.error(
        '❌ MercadoPago: Access Token de produção não deve conter "TEST"'
      );
      return false;
    }

    console.log("✅ MercadoPago: Configuração validada com sucesso");
    return true;
  }

  /**
   * Testa a conectividade com a API do MercadoPago
   * @returns Promise<boolean> Status da conectividade
   */
  public async testConnection(): Promise<boolean> {
    try {
      // Faz uma requisição simples para testar a conectividade
      const response = await fetch(
        "https://api.mercadopago.com/v1/payment_methods",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        console.log("✅ MercadoPago: Conexão testada com sucesso");
        return true;
      } else {
        console.error(
          "❌ MercadoPago: Erro na conexão:",
          response.status,
          response.statusText
        );
        return false;
      }
    } catch (error) {
      console.error("❌ MercadoPago: Erro ao testar conexão:", error);
      return false;
    }
  }

  /**
   * Reinicializa o cliente com novas configurações
   * @param newConfig Novas configurações
   */
    public reinitialize(newConfig: {
      accessToken?: string;
      publicKey?: string;
      environment?: Environment;
    }): void {
      if (newConfig.accessToken) {
        this.accessToken = newConfig.accessToken;
      }
      if (newConfig.publicKey) {
        this.publicKey = newConfig.publicKey;
      }
      if (newConfig.environment) {
        this.environment = newConfig.environment;
      }

    this.client = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: {
        timeout: 5000,
        idempotencyKey: this.generateIdempotencyKey(),
      },
    });

    console.log(
      "🔄 MercadoPago: Cliente reinicializado com novas configurações"
    );
  }

  /**
   * Obtém informações sobre o account configurado
   * @returns Informações do account
   */
  public async getAccountInfo(): Promise<any> {
    try {
      const response = await fetch("https://api.mercadopago.com/users/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      } else {
        return {
          success: false,
          error: `Erro ao obter informações da conta: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro na requisição: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`,
      };
    }
  }

  /**
   * Obtém os métodos de pagamento disponíveis
   * @returns Lista de métodos de pagamento
   */
  public async getPaymentMethods(): Promise<any> {
    try {
      const response = await fetch(
        "https://api.mercadopago.com/v1/payment_methods",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      } else {
        return {
          success: false,
          error: `Erro ao obter métodos de pagamento: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Erro na requisição: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`,
      };
    }
  }
}

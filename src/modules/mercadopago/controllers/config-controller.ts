import { Request, Response } from "express";
import { MercadoPagoClient } from "../client/mercadopago-client";
import { ClientType } from "../enums";

/**
 * Controller para configurações e informações do MercadoPago
 * Endpoints para obter chave pública, métodos de pagamento, etc.
 */
export class ConfigController {
  private client: MercadoPagoClient;

  constructor() {
    this.client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
  }

  /**
   * Obtém a chave pública para uso no frontend
   * GET /mercadopago/config/public-key
   */
  public getPublicKey = async (req: Request, res: Response) => {
    try {
      const publicKey = this.client.getPublicKey();
      const environment = this.client.getEnvironment();

      res.json({
        message: "Chave pública obtida com sucesso",
        public_key: publicKey,
        environment,
        sandbox: this.client.isSandbox(),
      });
    } catch (error) {
      console.error("Erro ao obter chave pública:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Obtém métodos de pagamento disponíveis
   * GET /mercadopago/config/payment-methods
   */
  public getPaymentMethods = async (req: Request, res: Response) => {
    try {
      const result = await this.client.getPaymentMethods();

      if (result.success) {
        res.json({
          message: "Métodos de pagamento obtidos com sucesso",
          payment_methods: result.data,
        });
      } else {
        res.status(400).json({
          message: "Erro ao obter métodos de pagamento",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao obter métodos de pagamento:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Obtém informações da conta configurada
   * GET /mercadopago/config/account-info
   */
  public getAccountInfo = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      // Verifica se o usuário tem permissão para ver informações da conta
      const userRole = req.user?.role;
      if (userRole !== "ADMIN" && userRole !== "FINANCEIRO") {
        return res.status(403).json({
          message: "Acesso negado: permissões insuficientes",
        });
      }

      const result = await this.client.getAccountInfo();

      if (result.success) {
        res.json({
          message: "Informações da conta obtidas com sucesso",
          account_info: result.data,
          environment: this.client.getEnvironment(),
        });
      } else {
        res.status(400).json({
          message: "Erro ao obter informações da conta",
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao obter informações da conta:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Testa a conectividade com a API do MercadoPago
   * GET /mercadopago/config/test-connection
   */
  public testConnection = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          message: "Usuário não autenticado",
        });
      }

      // Verifica se o usuário tem permissão para testar conexão
      const userRole = req.user?.role;
      if (userRole !== "ADMIN" && userRole !== "FINANCEIRO") {
        return res.status(403).json({
          message: "Acesso negado: permissões insuficientes",
        });
      }

      const isConnected = await this.client.testConnection();

      if (isConnected) {
        res.json({
          message: "Conexão com MercadoPago testada com sucesso",
          status: "connected",
          environment: this.client.getEnvironment(),
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          message: "Falha na conexão com MercadoPago",
          status: "disconnected",
          environment: this.client.getEnvironment(),
        });
      }
    } catch (error) {
      console.error("Erro ao testar conexão:", error);
      res.status(500).json({
        message: "Erro interno do servidor",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}

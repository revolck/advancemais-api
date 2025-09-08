/**
 * Health check para o módulo MercadoPago
 */

import { MercadoPagoClient } from "../client/mercadopago-client";
import { ClientType } from "../enums";
import { prisma } from "../../../config/prisma";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    mercadopago_api: {
      status: "up" | "down";
      response_time?: number;
      error?: string;
    };
    database: {
      status: "up" | "down";
      response_time?: number;
      error?: string;
    };
    configuration: {
      status: "valid" | "invalid";
      missing_vars?: string[];
    };
  };
  uptime: number;
}

export class MercadoPagoHealthCheck {
  private static startTime = Date.now();

  /**
   * Executa health check completo
   */
  public static async execute(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;

    const checks = {
      mercadopago_api: await this.checkMercadoPagoAPI(),
      database: await this.checkDatabase(),
      configuration: this.checkConfiguration(),
    };

    // Determina status geral
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    const downServices = Object.values(checks).filter(
      (check) => check.status === "down" || check.status === "invalid"
    );

    if (downServices.length > 0) {
      status =
        downServices.length === Object.keys(checks).length
          ? "unhealthy"
          : "degraded";
    }

    return {
      status,
      timestamp,
      checks,
      uptime,
    };
  }

  /**
   * Verifica conectividade com API do MercadoPago
   */
  private static async checkMercadoPagoAPI(): Promise<{
    status: "up" | "down";
    response_time?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);

      const isConnected = await client.testConnection();
      const responseTime = Date.now() - startTime;

      if (isConnected) {
        return {
          status: "up",
          response_time: responseTime,
        };
      } else {
        return {
          status: "down",
          response_time: responseTime,
          error: "Connection test failed",
        };
      }
    } catch (error) {
      return {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verifica conectividade com banco de dados
   */
  private static async checkDatabase(): Promise<{
    status: "up" | "down";
    response_time?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // Testa conexão com uma query simples
      await prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - startTime;

      return {
        status: "up",
        response_time: responseTime,
      };
    } catch (error) {
      return {
        status: "down",
        error:
          error instanceof Error ? error.message : "Database connection failed",
      };
    }
  }

  /**
   * Verifica configurações necessárias
   */
  private static checkConfiguration(): {
    status: "valid" | "invalid";
    missing_vars?: string[];
  } {
    const requiredVars = [
      "MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN",
      "MERCADOPAGO_SUBSCRIPTIONS_PUBLIC_KEY",
      "MERCADOPAGO_CHECKOUT_TRANSPARENT_ACCESS_TOKEN",
      "MERCADOPAGO_CHECKOUT_TRANSPARENT_PUBLIC_KEY",
    ];

    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      return {
        status: "invalid",
        missing_vars: missingVars,
      };
    }

    try {
      const client = MercadoPagoClient.getInstance(ClientType.SUBSCRIPTIONS);
      const isValidConfig = client.validateConfiguration();

      return {
        status: isValidConfig ? "valid" : "invalid",
      };
    } catch (error) {
      return {
        status: "invalid",
        missing_vars: ["Configuration validation failed"],
      };
    }
  }
}

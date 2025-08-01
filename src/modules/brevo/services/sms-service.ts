import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { SMSData, ServiceResponse, IBrevoConfig } from "../types/interfaces";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de SMS com tratamento de erro gracioso
 *
 * @author Sistema AdvanceMais
 * @version 3.0.4 - Correção tratamento de erro
 */
export class SMSService {
  private client: BrevoClient;
  private config: IBrevoConfig;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = this.client.getConfig();
  }

  /**
   * Verifica conectividade de forma não-crítica
   */
  public async checkConnectivity(): Promise<boolean> {
    try {
      return await this.client.checkHealth();
    } catch (error) {
      return false;
    }
  }

  /**
   * Testa conectividade (método público para health checks)
   */
  public async testarConectividade(): Promise<boolean> {
    return this.checkConnectivity();
  }

  /**
   * Obtém estatísticas de envio
   */
  public async obterEstatisticasEnvio(): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await prisma.logSMS.groupBy({
        by: ["status"],
        where: { criadoEm: { gte: thirtyDaysAgo } },
        _count: { id: true },
      });

      return {
        period: "últimos 30 dias",
        statistics: stats,
        total: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas SMS:", error);
      return null;
    }
  }

  // ... resto dos métodos permanecem iguais
  public async sendSMS(
    smsData: SMSData,
    userId?: string
  ): Promise<ServiceResponse> {
    // Verifica se o cliente está configurado
    const healthStatus = this.client.getHealthStatus();
    if (!healthStatus.healthy && healthStatus.error?.includes("API Key")) {
      console.warn("⚠️ Brevo não configurado - SMS não enviado");
      return {
        success: false,
        error: "Serviço de SMS não configurado (API Key inválida)",
      };
    }

    // ... implementação do envio
    return {
      success: false,
      error: "SMS service não implementado completamente",
    };
  }

  public async getStatistics(): Promise<any> {
    return this.obterEstatisticasEnvio();
  }

  public static generateVerificationCode(digits: number = 6): string {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

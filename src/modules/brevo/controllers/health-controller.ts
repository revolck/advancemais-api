import { Request, Response } from "express";
import { BrevoClient } from "../client/brevo-client";
import { EmailService } from "../services/email-service";
import { SMSService } from "../services/sms-service";

/**
 * Controller de Health Check para o módulo Brevo - Versão Mínima
 *
 * Implementa apenas verificações essenciais para evitar conflitos
 *
 * @author Sistema AdvanceMais
 * @version 2.0.1
 */
export class BrevoHealthController {
  private static startTime = Date.now();

  /**
   * Health check básico
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response) => {
    try {
      const status = await this.checkBasicHealth();
      const statusCode = status.healthy ? 200 : 503;

      res.status(statusCode).json({
        module: "brevo",
        status: status.healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - BrevoHealthController.startTime,
        services: status.services,
      });
    } catch (error) {
      res.status(503).json({
        module: "brevo",
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Health check detalhado
   * GET /brevo/health/detailed
   */
  public detailedHealthCheck = async (req: Request, res: Response) => {
    try {
      const status = await this.checkBasicHealth();
      const stats = await this.getBasicStats();

      const statusCode = status.healthy ? 200 : 503;

      res.status(statusCode).json({
        module: "brevo",
        status: status.healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: Date.now() - BrevoHealthController.startTime,
        services: status.services,
        statistics: stats,
      });
    } catch (error) {
      res.status(503).json({
        module: "brevo",
        status: "unhealthy",
        error:
          error instanceof Error
            ? error.message
            : "Detailed health check failed",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Configurações sanitizadas (apenas ADMIN)
   * GET /brevo/config
   */
  public getConfig = async (req: Request, res: Response) => {
    try {
      const config = {
        apiKey: process.env.BREVO_API_KEY
          ? "✅ Configurado"
          : "❌ Não configurado",
        fromEmail: process.env.BREVO_FROM_EMAIL || "❌ Não configurado",
        fromName: process.env.BREVO_FROM_NAME || "❌ Não configurado",
        environment: process.env.NODE_ENV,
        uptime: Date.now() - BrevoHealthController.startTime,
      };

      res.json({
        message: "Configurações do módulo Brevo",
        config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter configurações",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Verificação básica de saúde dos serviços
   */
  private async checkBasicHealth() {
    const services = {
      client: false,
      email: false,
      sms: false,
    };

    try {
      const client = BrevoClient.getInstance();
      services.client = await client.isConfigured();
    } catch {
      services.client = false;
    }

    try {
      const emailService = new EmailService();
      services.email = await emailService.testarConectividade();
    } catch {
      services.email = false;
    }

    try {
      const smsService = new SMSService();
      services.sms = await smsService.testarConectividade();
    } catch {
      services.sms = false;
    }

    const healthyServices = Object.values(services).filter(Boolean).length;
    const healthy = healthyServices >= 2; // Pelo menos 2 de 3 serviços funcionando

    return {
      healthy,
      services: {
        client: { status: services.client ? "up" : "down" },
        email: { status: services.email ? "up" : "down" },
        sms: { status: services.sms ? "up" : "down" },
      },
    };
  }

  /**
   * Estatísticas básicas
   */
  private async getBasicStats() {
    try {
      const emailService = new EmailService();
      const smsService = new SMSService();

      const emailStats = await emailService
        .obterEstatisticasEnvio()
        .catch(() => null);
      const smsStats = await smsService
        .obterEstatisticasEnvio()
        .catch(() => null);

      return {
        email: emailStats,
        sms: smsStats,
        lastCheck: new Date().toISOString(),
      };
    } catch {
      return {
        email: null,
        sms: null,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Factory method para criação da instância
   */
  public static create(): BrevoHealthController {
    return new BrevoHealthController();
  }
}

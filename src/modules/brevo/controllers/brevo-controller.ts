import { Request, Response } from "express";
import { EmailService } from "../services/email-service";
import { SMSService } from "../services/sms-service";
import { BrevoClient } from "../client/brevo-client";
import {
  HealthCheckResult,
  ServiceStatus,
  IBrevoConfig,
} from "../types/interfaces";

/**
 * Controller principal do módulo Brevo
 * Implementa endpoints RESTful para comunicação
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
export class BrevoController {
  private emailService: EmailService;
  private smsService: SMSService;
  private client: BrevoClient;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.client = BrevoClient.getInstance();
  }

  /**
   * Health check do módulo
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();
      const healthResult = await this.performHealthCheck();
      const responseTime = Date.now() - startTime;

      const statusCode =
        healthResult.status === "healthy"
          ? 200
          : healthResult.status === "degraded"
          ? 207
          : 503;

      res.status(statusCode).json({
        ...healthResult,
        responseTime,
        module: "brevo",
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
   * Configurações do módulo (apenas admins)
   * GET /brevo/config
   */
  public getConfig = async (req: Request, res: Response): Promise<void> => {
    try {
      const config: IBrevoConfig = this.client.getConfig();
      const healthStatus = this.client.getHealthStatus();

      res.json({
        message: "Configurações do módulo Brevo",
        config: {
          fromEmail: config.fromEmail,
          fromName: config.fromName,
          maxRetries: config.maxRetries,
          timeout: config.timeout,
          healthy: healthStatus.healthy,
          lastHealthCheck: healthStatus.lastCheck,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter configurações",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Estatísticas do módulo
   * GET /brevo/stats
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const [emailStats, smsStats] = await Promise.allSettled([
        this.emailService.getStatistics(),
        this.smsService.getStatistics(),
      ]);

      const stats = {
        email: emailStats.status === "fulfilled" ? emailStats.value : null,
        sms: smsStats.status === "fulfilled" ? smsStats.value : null,
        timestamp: new Date().toISOString(),
      };

      res.json({
        message: "Estatísticas do módulo Brevo",
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Teste de email (apenas desenvolvimento)
   * POST /brevo/test/email
   */
  public testEmail = async (req: Request, res: Response): Promise<void> => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        message: "Testes não disponíveis em produção",
      });
      return;
    }

    try {
      const { email, subject, message, name } = req.body;

      if (!email || !subject || !message) {
        res.status(400).json({
          message: "Campos obrigatórios: email, subject, message",
        });
        return;
      }

      const result = await this.emailService.sendEmail({
        to: email,
        toName: name || "Teste",
        subject: `🧪 ${subject}`,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>🧪 Teste de Email - AdvanceMais</h2>
            <p><strong>Mensagem:</strong> ${message}</p>
            <hr>
            <p style="font-size: 12px; color: #666;">
              Teste enviado em: ${new Date().toLocaleString("pt-BR")}
            </p>
          </div>
        `,
        textContent: `TESTE DE EMAIL\n\n${message}\n\nEnviado em: ${new Date().toLocaleString(
          "pt-BR"
        )}`,
        tags: ["teste"],
      });

      res.json({
        message: "Teste de email executado",
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro no teste de email",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Teste de SMS (apenas desenvolvimento)
   * POST /brevo/test/sms
   */
  public testSMS = async (req: Request, res: Response): Promise<void> => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        message: "Testes não disponíveis em produção",
      });
      return;
    }

    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        res.status(400).json({
          message: "Campos obrigatórios: phone, message",
        });
        return;
      }

      const result = await this.smsService.sendSMS({
        to: phone,
        message: `🧪 TESTE: ${message} - ${new Date().toLocaleTimeString(
          "pt-BR"
        )}`,
        sender: "AdvanceMais",
      });

      res.json({
        message: "Teste de SMS executado",
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro no teste de SMS",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Realiza health check completo
   */
  private async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const [clientHealth, emailHealth, smsHealth] = await Promise.allSettled([
      this.checkClientHealth(),
      this.checkEmailHealth(),
      this.checkSMSHealth(),
    ]);

    const services = {
      client:
        clientHealth.status === "fulfilled"
          ? clientHealth.value
          : { status: "down" as const, error: "Health check failed" },
      email:
        emailHealth.status === "fulfilled"
          ? emailHealth.value
          : { status: "down" as const, error: "Health check failed" },
      sms:
        smsHealth.status === "fulfilled"
          ? smsHealth.value
          : { status: "down" as const, error: "Health check failed" },
    };

    const healthyServices = Object.values(services).filter(
      (service) => service.status === "up"
    ).length;
    const totalServices = Object.keys(services).length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (healthyServices === totalServices) {
      status = "healthy";
    } else if (healthyServices >= totalServices / 2) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startTime,
      services,
    };
  }

  /**
   * Verifica saúde do cliente
   */
  private async checkClientHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.client.checkHealth();
      return {
        status: isHealthy ? "up" : "down",
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Client check failed",
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Verifica saúde do serviço de email
   */
  private async checkEmailHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.emailService.checkConnectivity();
      return {
        status: isHealthy ? "up" : "down",
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Email check failed",
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Verifica saúde do serviço de SMS
   */
  private async checkSMSHealth(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.smsService.checkConnectivity();
      return {
        status: isHealthy ? "up" : "down",
        responseTime: Date.now() - startTime,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "down",
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "SMS check failed",
        lastCheck: new Date().toISOString(),
      };
    }
  }
}

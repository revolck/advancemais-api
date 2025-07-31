import { Request, Response } from "express";
import { BrevoClient } from "../client/brevo-client";
import { EmailService } from "../services/email-service";
import { SMSService } from "../services/sms-service";

/**
 * Controller simples para health check do módulo Brevo
 */
export class BrevoHealthController {
  private static startTime = Date.now();

  /**
   * Health check básico
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response) => {
    try {
      const result = await this.executeHealthCheck();
      const statusCode = result.status === "healthy" ? 200 : 503;

      res.status(statusCode).json({
        module: "brevo",
        ...result,
      });
    } catch (error) {
      res.status(503).json({
        module: "brevo",
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  };

  /**
   * Health check detalhado
   * GET /brevo/health/detailed
   */
  public detailedHealthCheck = async (req: Request, res: Response) => {
    try {
      const result = await this.executeHealthCheck(true);
      const statusCode = result.status === "healthy" ? 200 : 503;

      res.status(statusCode).json({
        module: "brevo",
        ...result,
      });
    } catch (error) {
      res.status(503).json({
        module: "brevo",
        status: "unhealthy",
        error:
          error instanceof Error
            ? error.message
            : "Detailed health check failed",
      });
    }
  };

  /**
   * Teste de envio (apenas desenvolvimento)
   * GET /brevo/health/test
   */
  public testSending = async (req: Request, res: Response) => {
    // Bloqueia em produção
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        message: "Teste não disponível em produção",
      });
      return;
    }

    try {
      const { email, phone, testType = "email" } = req.query;

      if (testType === "email" && typeof email === "string") {
        await this.testEmailSending(email, res);
      } else if (testType === "sms" && typeof phone === "string") {
        await this.testSMSSending(phone, res);
      } else {
        res.status(400).json({
          message: "Parâmetros inválidos",
          usage: {
            email: "/brevo/health/test?testType=email&email=test@example.com",
            sms: "/brevo/health/test?testType=sms&phone=+5511999999999",
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        message: "Erro no teste",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Configurações (apenas ADMIN)
   * GET /brevo/config
   */
  public getConfig = async (req: Request, res: Response) => {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        message: "Acesso negado: apenas administradores",
      });
      return;
    }

    try {
      const config = this.getSanitizedConfig();
      res.json({
        message: "Configurações do módulo Brevo",
        config,
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter configurações",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Executa health check
   */
  private async executeHealthCheck(includeStats = false) {
    const [clientCheck, emailCheck, smsCheck] = await Promise.all([
      this.checkClient(),
      this.checkEmail(),
      this.checkSMS(),
    ]);

    let statistics;
    if (includeStats) {
      statistics = await this.getStats();
    }

    const checks = { client: clientCheck, email: emailCheck, sms: smsCheck };
    const upServices = Object.values(checks).filter(
      (check) => check.status === "up"
    ).length;
    const status =
      upServices === 3 ? "healthy" : upServices > 0 ? "degraded" : "unhealthy";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - BrevoHealthController.startTime,
      checks,
      ...(statistics && { statistics }),
    };
  }

  private async checkClient() {
    try {
      const client = BrevoClient.getInstance();
      const isConfigured = await client.isConfigured();
      return { status: isConfigured ? "up" : ("down" as const) };
    } catch {
      return { status: "down" as const };
    }
  }

  private async checkEmail() {
    try {
      const emailService = new EmailService();
      const isConnected = await emailService.testarConectividade();
      return { status: isConnected ? "up" : ("down" as const) };
    } catch {
      return { status: "down" as const };
    }
  }

  private async checkSMS() {
    try {
      const smsService = new SMSService();
      const isConnected = await smsService.testarConectividade();
      return { status: isConnected ? "up" : ("down" as const) };
    } catch {
      return { status: "down" as const };
    }
  }

  private async getStats() {
    try {
      const emailService = new EmailService();
      const smsService = new SMSService();

      const [emailStats, smsStats] = await Promise.all([
        emailService.obterEstatisticasEnvio(),
        smsService.obterEstatisticasEnvio(),
      ]);

      return { email: emailStats, sms: smsStats };
    } catch {
      return { email: null, sms: null };
    }
  }

  private async testEmailSending(email: string, res: Response) {
    try {
      const emailService = new EmailService();
      const result = await emailService.enviarEmail({
        to: email,
        toName: "Teste",
        subject: "🧪 Teste Brevo - AdvanceMais",
        htmlContent: `<h2>Teste de Email</h2><p>Enviado em: ${new Date().toLocaleString(
          "pt-BR"
        )}</p>`,
        textContent: `Teste de Email - ${new Date().toLocaleString("pt-BR")}`,
      });

      res.json({ message: "Teste de email executado", result });
    } catch (error) {
      res.status(500).json({
        message: "Erro no teste de email",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  private async testSMSSending(phone: string, res: Response) {
    try {
      const smsService = new SMSService();
      const codigo = SMSService.gerarCodigoVerificacao();

      const result = await smsService.enviarSMSVerificacao({
        telefone: phone,
        codigo,
      });

      res.json({ message: "Teste de SMS executado", result, testCode: codigo });
    } catch (error) {
      res.status(500).json({
        message: "Erro no teste de SMS",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  private getSanitizedConfig() {
    const apiKey = process.env.BREVO_API_KEY;
    return {
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...` : "❌ Não configurado",
      fromEmail: process.env.BREVO_FROM_EMAIL || "❌ Não configurado",
      fromName: process.env.BREVO_FROM_NAME || "❌ Não configurado",
      environment: process.env.NODE_ENV,
      uptime: Date.now() - BrevoHealthController.startTime,
    };
  }

  public static create(): BrevoHealthController {
    return new BrevoHealthController();
  }
}

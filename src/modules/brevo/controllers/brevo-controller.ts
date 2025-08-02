import { Request, Response } from "express";
import { EmailService } from "../services/email-service";
import { SMSService } from "../services/sms-service";
import { BrevoClient } from "../client/brevo-client";

/**
 * Controller simplificado do módulo Brevo
 *
 * Responsabilidades:
 * - Health check e status
 * - Endpoints de teste para desenvolvimento
 * - Informações básicas do módulo
 *
 * @author Sistema AdvanceMais
 * @version 5.0.1 - Adição de testes de SMS
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
   * Health check completo
   * GET /brevo/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = this.client.getConfig();
      const [emailHealthy, smsHealthy] = await Promise.all([
        this.emailService.checkHealth(),
        this.smsService.checkHealth(),
      ]);

      res.json({
        status: emailHealthy && smsHealthy ? "healthy" : "degraded",
        module: "brevo",
        configured: config.isConfigured,
        simulated: this.client.isSimulated(),
        operational: this.client.isOperational(),
        services: {
          email: emailHealthy ? "operational" : "degraded",
          sms: smsHealthy ? "operational" : "degraded",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: "unhealthy",
        module: "brevo",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * Informações do módulo
   * GET /brevo
   */
  public getModuleInfo = async (req: Request, res: Response): Promise<void> => {
    const config = this.client.getConfig();

    res.json({
      module: "Brevo Communication Module",
      version: "5.0.1",
      status: "active",
      configured: config.isConfigured,
      simulated: this.client.isSimulated(),
      services: ["email", "sms"],
      endpoints: {
        health: "GET /health",
        testEmail: "POST /test/email (development only)",
        testSMS: "POST /test/sms (development only)",
      },
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Teste de email (apenas desenvolvimento)
   * POST /brevo/test/email
   */
  public testEmail = async (req: Request, res: Response): Promise<void> => {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ message: "Testes não disponíveis em produção" });
      return;
    }

    try {
      const { email, name } = req.body;

      if (!email) {
        res.status(400).json({ message: "Email é obrigatório" });
        return;
      }

      const result = await this.emailService.sendWelcomeEmail({
        id: "test_user",
        email,
        nomeCompleto: name || "Usuário Teste",
        tipoUsuario: "PESSOA_FISICA",
      });

      res.json({
        message: "Teste de email executado",
        success: result.success,
        simulated: result.simulated,
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
      res.status(403).json({ message: "Testes não disponíveis em produção" });
      return;
    }

    try {
      const { phone, message, type } = req.body;

      if (!phone) {
        res.status(400).json({ message: "Telefone é obrigatório" });
        return;
      }

      let result;

      if (type === "verification") {
        // Teste de SMS de verificação
        const code = SMSService.generateVerificationCode(6);
        result = await this.smsService.sendVerificationSMS(phone, code);
      } else {
        // Teste de SMS genérico
        const testMessage = message || "🧪 Teste de SMS do AdvanceMais";
        result = await this.smsService.sendSMS({
          to: phone,
          message: testMessage,
          sender: "AdvanceMais",
        });
      }

      res.json({
        message: "Teste de SMS executado",
        success: result.success,
        simulated: result.simulated,
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
   * Estatísticas básicas
   * GET /brevo/stats
   */
  public getStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const [emailStats, smsStats] = await Promise.all([
        this.emailService.getStatistics(),
        this.smsService.getStatistics(),
      ]);

      res.json({
        message: "Estatísticas do módulo Brevo",
        data: {
          email: emailStats,
          sms: smsStats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };
}

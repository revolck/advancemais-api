import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { EmailTemplates } from "../templates/email-templates";
import {
  EmailData,
  ServiceResponse,
  UserTemplateData,
  EmailType,
  SendStatus,
  IBrevoConfig,
} from "../types/interfaces";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de email com tratamento de erro robusto
 * Implementa fallbacks e não quebra a aplicação
 *
 * @author Sistema AdvanceMais
 * @version 3.0.4 - Correção tratamento de erro
 */
export class EmailService {
  private client: BrevoClient;
  private config: IBrevoConfig;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = this.client.getConfig();
  }

  /**
   * Envia email com retry automático e fallback
   */
  public async sendEmail(
    emailData: EmailData,
    userId?: string
  ): Promise<ServiceResponse> {
    let lastError: Error | null = null;

    // Verifica se o cliente está configurado
    const healthStatus = this.client.getHealthStatus();
    if (!healthStatus.healthy && healthStatus.error?.includes("API Key")) {
      console.warn("⚠️ Brevo não configurado - email não enviado");
      return {
        success: false,
        error: "Serviço de email não configurado (API Key inválida)",
      };
    }

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(
          `📤 Email tentativa ${attempt}/${this.config.maxRetries} - ${emailData.to}`
        );

        const result = await this.performEmailSend(emailData);

        // Log de sucesso
        await this.logEmailSend({
          usuarioId: userId,
          recipient: emailData.to,
          type: this.inferEmailType(emailData.subject),
          status: SendStatus.SENT,
          attempts: attempt,
          messageId: result.messageId,
        });

        console.log(`✅ Email enviado com sucesso (tentativa ${attempt})`);
        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Erro desconhecido");
        console.warn(
          `⚠️ Email tentativa ${attempt} falhou: ${lastError.message}`
        );

        // Se é erro de autorização, não tenta novamente
        if (
          lastError.message.includes("401") ||
          lastError.message.includes("unauthorized")
        ) {
          break;
        }

        // Aguarda antes da próxima tentativa (exceto na última)
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    // Log de falha final
    await this.logEmailSend({
      usuarioId: userId,
      recipient: emailData.to,
      type: this.inferEmailType(emailData.subject),
      status: SendStatus.FAILED,
      attempts: this.config.maxRetries,
      error: lastError?.message,
    });

    return {
      success: false,
      error: `Email falhou após ${this.config.maxRetries} tentativas: ${lastError?.message}`,
    };
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

      const stats = await prisma.logEmail.groupBy({
        by: ["status", "tipoEmail"],
        where: { criadoEm: { gte: thirtyDaysAgo } },
        _count: { id: true },
      });

      return {
        period: "últimos 30 dias",
        statistics: stats,
        total: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas:", error);
      return null;
    }
  }

  // ... resto dos métodos permanecem iguais
  private async performEmailSend(
    emailData: EmailData
  ): Promise<ServiceResponse> {
    this.validateEmailData(emailData);
    const sendSmtpEmail = this.buildBrevoEmail(emailData);
    const emailAPI = this.client.getEmailAPI();
    const response = await emailAPI.sendTransacEmail(sendSmtpEmail);
    const messageId = this.extractMessageId(response);
    return {
      success: true,
      messageId,
      data: response,
      timestamp: new Date().toISOString(),
    };
  }

  public async sendWelcomeEmail(
    userData: UserTemplateData
  ): Promise<ServiceResponse> {
    try {
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: this.formatUserType(userData.tipoUsuario),
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        ano: new Date().getFullYear(),
      };

      const htmlContent = EmailTemplates.generateWelcomeTemplate(templateData);
      const textContent = EmailTemplates.generateWelcomeText(templateData);

      const emailData: EmailData = {
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: `Bem-vindo(a) ao AdvanceMais, ${
          userData.nomeCompleto.split(" ")[0]
        }! 🎉`,
        htmlContent,
        textContent,
        tags: ["welcome", "new-user"],
        headers: {
          "X-User-ID": userData.id,
          "X-Email-Type": "welcome",
        },
      };

      const result = await this.sendEmail(emailData, userData.id);

      // Atualiza flag no usuário se enviado com sucesso
      if (result.success) {
        await this.updateUserWelcomeFlag(userData.id);
      }

      return result;
    } catch (error) {
      console.error("❌ Erro no email de boas-vindas:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro no email de boas-vindas",
      };
    }
  }

  public async sendPasswordRecoveryEmail(
    userData: UserTemplateData,
    token: string
  ): Promise<ServiceResponse> {
    try {
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        linkRecuperacao: `${process.env.FRONTEND_URL}/recuperar-senha?token=${token}`,
        token,
        expiracaoMinutos: 30,
        maxTentativas: 3,
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        ano: new Date().getFullYear(),
      };

      const htmlContent =
        EmailTemplates.generatePasswordRecoveryTemplate(templateData);
      const textContent =
        EmailTemplates.generatePasswordRecoveryText(templateData);

      const emailData: EmailData = {
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: "Recuperação de Senha - AdvanceMais 🔐",
        htmlContent,
        textContent,
        tags: ["password-recovery", "security"],
        headers: {
          "X-User-ID": userData.id,
          "X-Email-Type": "password-recovery",
          "X-Priority": "1",
        },
      };

      return await this.sendEmail(emailData, userData.id);
    } catch (error) {
      console.error("❌ Erro no email de recuperação:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro no email de recuperação",
      };
    }
  }

  // Métodos auxiliares privados
  private validateEmailData(emailData: EmailData): void {
    if (!emailData.to || !this.isValidEmail(emailData.to)) {
      throw new Error("Email do destinatário é obrigatório e deve ser válido");
    }
    if (!emailData.subject?.trim()) {
      throw new Error("Assunto do email é obrigatório");
    }
    if (!emailData.htmlContent?.trim()) {
      throw new Error("Conteúdo HTML do email é obrigatório");
    }
  }

  private buildBrevoEmail(emailData: EmailData): Brevo.SendSmtpEmail {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: emailData.to, name: emailData.toName }];
    sendSmtpEmail.sender = {
      email: this.config.fromEmail,
      name: this.config.fromName,
    };
    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.htmlContent = emailData.htmlContent;
    if (emailData.textContent)
      sendSmtpEmail.textContent = emailData.textContent;
    if (emailData.attachments?.length)
      sendSmtpEmail.attachment = emailData.attachments;
    if (emailData.headers) sendSmtpEmail.headers = emailData.headers;
    if (emailData.tags?.length) sendSmtpEmail.tags = emailData.tags;
    return sendSmtpEmail;
  }

  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferEmailType(subject: string): EmailType {
    const subjectLower = subject.toLowerCase();
    if (subjectLower.includes("bem-vind") || subjectLower.includes("welcome"))
      return EmailType.WELCOME;
    if (subjectLower.includes("recupera") || subjectLower.includes("senha"))
      return EmailType.PASSWORD_RECOVERY;
    if (subjectLower.includes("verific")) return EmailType.VERIFICATION;
    return EmailType.NOTIFICATION;
  }

  private formatUserType(userType: string): string {
    switch (userType) {
      case "PESSOA_FISICA":
        return "pessoa física";
      case "PESSOA_JURIDICA":
        return "empresa";
      default:
        return "usuário";
    }
  }

  private async updateUserWelcomeFlag(userId: string): Promise<void> {
    try {
      await prisma.usuario.update({
        where: { id: userId },
        data: {
          emailBoasVindasEnviado: true,
          dataEmailBoasVindas: new Date(),
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao atualizar flag de boas-vindas:", error);
    }
  }

  private async logEmailSend(logData: {
    usuarioId?: string;
    recipient: string;
    type: EmailType;
    status: SendStatus;
    attempts: number;
    messageId?: string;
    error?: string;
  }): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: logData.usuarioId,
          email: logData.recipient,
          tipoEmail: logData.type,
          status: logData.status,
          tentativas: logData.attempts,
          messageId: logData.messageId,
          erro: logData.error,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log de email:", error);
    }
  }

  public async getStatistics(): Promise<any> {
    return this.obterEstatisticasEnvio();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

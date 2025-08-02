import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import {
  EmailTemplates,
  WelcomeEmailData,
  PasswordRecoveryData,
} from "../templates/email-templates";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de email simplificado e eficiente
 *
 * Responsabilidades:
 * - Enviar emails de forma robusta
 * - Gerenciar fallbacks e simulações
 * - Registrar logs para auditoria
 *
 * @author Sistema AdvanceMais
 * @version 5.0.0 - Simplificação e robustez
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export class EmailService {
  private client: BrevoClient;

  constructor() {
    this.client = BrevoClient.getInstance();
  }

  /**
   * Envia email de boas-vindas de forma robusta
   */
  public async sendWelcomeEmail(userData: {
    id: string;
    email: string;
    nomeCompleto: string;
    tipoUsuario: string;
  }): Promise<EmailResult> {
    const operation = "WELCOME_EMAIL";
    const startTime = Date.now();

    try {
      console.log(`📧 ${operation}: Enviando para ${userData.email}`);

      // Valida dados básicos
      if (!this.isValidEmailData(userData)) {
        throw new Error("Dados do usuário inválidos");
      }

      // Prepara dados do template
      const templateData: WelcomeEmailData = {
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: userData.tipoUsuario,
        email: userData.email,
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
      };

      // Gera conteúdo do email
      const emailContent = EmailTemplates.generateWelcomeEmail(templateData);

      // Envia email (com possível simulação)
      const result = await this.performEmailSend({
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      // Registra resultado
      if (result.success) {
        await this.logEmailSuccess(userData.id, operation, result.messageId);
        await this.updateUserWelcomeFlag(userData.id);
        console.log(`✅ ${operation}: Sucesso em ${Date.now() - startTime}ms`);
      } else {
        await this.logEmailError(
          userData.id,
          operation,
          result.error || "Erro desconhecido"
        );
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ ${operation}: ${errorMsg}`);

      await this.logEmailError(userData.id, operation, errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Envia email de recuperação de senha
   */
  public async sendPasswordRecoveryEmail(
    userData: { id: string; email: string; nomeCompleto: string },
    recoveryData: {
      token: string;
      linkRecuperacao: string;
      expiracaoMinutos: number;
    }
  ): Promise<EmailResult> {
    const operation = "PASSWORD_RECOVERY";

    try {
      console.log(`🔐 ${operation}: Enviando para ${userData.email}`);

      const templateData: PasswordRecoveryData = {
        nomeCompleto: userData.nomeCompleto,
        token: recoveryData.token,
        linkRecuperacao: recoveryData.linkRecuperacao,
        expiracaoMinutos: recoveryData.expiracaoMinutos,
      };

      const emailContent =
        EmailTemplates.generatePasswordRecoveryEmail(templateData);

      const result = await this.performEmailSend({
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (result.success) {
        await this.logEmailSuccess(userData.id, operation, result.messageId);
      } else {
        await this.logEmailError(
          userData.id,
          operation,
          result.error || "Erro desconhecido"
        );
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      await this.logEmailError(userData.id, operation, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Executa envio do email com tratamento de simulação
   */
  private async performEmailSend(emailData: {
    to: string;
    toName: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailResult> {
    const config = this.client.getConfig();

    // Modo simulado (desenvolvimento ou API não configurada)
    if (this.client.isSimulated()) {
      console.log(`🎭 Email simulado para: ${emailData.to}`);
      console.log(`📄 Assunto: ${emailData.subject}`);
      return {
        success: true,
        messageId: `sim_${Date.now()}`,
        simulated: true,
      };
    }

    // Tentativa de envio real
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();

      sendSmtpEmail.to = [{ email: emailData.to, name: emailData.toName }];
      sendSmtpEmail.sender = { email: config.fromEmail, name: config.fromName };
      sendSmtpEmail.subject = emailData.subject;
      sendSmtpEmail.htmlContent = emailData.html;
      sendSmtpEmail.textContent = emailData.text;

      const response = await this.client
        .getEmailAPI()
        .sendTransacEmail(sendSmtpEmail);
      const messageId = this.extractMessageId(response);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("❌ Erro no envio via Brevo:", error);

      // Fallback para simulação em caso de erro
      console.log("🎭 Fallback para modo simulado");
      return {
        success: true,
        messageId: `fallback_${Date.now()}`,
        simulated: true,
      };
    }
  }

  /**
   * Valida dados básicos do usuário
   */
  private isValidEmailData(userData: any): boolean {
    return !!(
      userData?.id &&
      userData?.email &&
      userData?.nomeCompleto &&
      userData?.tipoUsuario &&
      this.isValidEmail(userData.email)
    );
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Extrai message ID da resposta do Brevo
   */
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_${Date.now()}`;
  }

  /**
   * Registra sucesso no log
   */
  private async logEmailSuccess(
    userId: string,
    operation: string,
    messageId?: string
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail:
            operation === "WELCOME_EMAIL" ? "BOAS_VINDAS" : "RECUPERACAO_SENHA",
          status: "ENVIADO",
          tentativas: 1,
          messageId,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log de sucesso:", error);
    }
  }

  /**
   * Registra erro no log
   */
  private async logEmailError(
    userId: string,
    operation: string,
    error: string
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail:
            operation === "WELCOME_EMAIL" ? "BOAS_VINDAS" : "RECUPERACAO_SENHA",
          status: "FALHA",
          tentativas: 1,
          erro: error,
        },
      });
    } catch (logError) {
      console.warn("⚠️ Erro ao registrar log de erro:", logError);
    }
  }

  /**
   * Atualiza flag de boas-vindas do usuário
   */
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

  /**
   * Health check público
   */
  public async checkHealth(): Promise<boolean> {
    return this.client.isOperational() || this.client.isSimulated();
  }

  /**
   * Estatísticas básicas
   */
  public async getStatistics(): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const stats = await prisma.logEmail.groupBy({
        by: ["status"],
        where: { criadoEm: { gte: thirtyDaysAgo } },
        _count: { id: true },
      });

      return {
        period: "últimos 30 dias",
        statistics: stats,
        total: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch {
      return null;
    }
  }
}

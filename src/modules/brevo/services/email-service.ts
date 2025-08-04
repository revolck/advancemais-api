import { BrevoClient } from "../client/brevo-client";
import { BrevoConfigManager } from "../config/brevo-config";
import { EmailTemplates } from "../templates/email-templates";
import { prisma } from "../../../config/prisma";

/**
 * Serviço de email simplificado e eficiente
 * Responsável por enviar todos os tipos de email da plataforma
 *
 * @author Sistema AdvanceMais
 * @version 7.1.0 - CORREÇÕES DE TIPAGEM
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export interface WelcomeEmailData {
  id: string;
  email: string;
  nomeCompleto: string;
  tipoUsuario: string;
}

export interface VerificationEmailData {
  id: string;
  email: string;
  nomeCompleto: string;
  tipoUsuario: string;
}

export class EmailService {
  private client: BrevoClient;
  private config: BrevoConfigManager;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = BrevoConfigManager.getInstance();
  }

  /**
   * Envia email de boas-vindas + verificação se habilitado
   */
  public async sendWelcomeEmail(
    userData: WelcomeEmailData
  ): Promise<EmailResult> {
    const correlationId = this.generateCorrelationId();

    try {
      console.log(
        `📧 [${correlationId}] Enviando email de boas-vindas para: ${userData.email}`
      );

      // Validação básica
      if (!this.isValidEmailData(userData)) {
        throw new Error("Dados do usuário inválidos para email");
      }

      // Se verificação está habilitada, envia email de verificação
      if (this.config.isEmailVerificationEnabled()) {
        return await this.sendVerificationEmail(userData, correlationId);
      }

      // Caso contrário, envia email de boas-vindas simples
      return await this.sendSimpleWelcomeEmail(userData, correlationId);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(
        `❌ [${correlationId}] Erro no email de boas-vindas:`,
        errorMsg
      );

      // Registra erro no banco
      await this.logEmailError(userData.id, "BOAS_VINDAS", errorMsg);

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Envia email de verificação (inclui boas-vindas)
   */
  private async sendVerificationEmail(
    userData: WelcomeEmailData,
    correlationId: string
  ): Promise<EmailResult> {
    try {
      console.log(
        `🔐 [${correlationId}] Enviando email de verificação para: ${userData.email}`
      );

      // Gera token de verificação
      const token = this.config.generateVerificationToken();
      const tokenExpiration = this.config.getTokenExpirationDate();
      const verificationUrl = this.config.generateVerificationUrl(token);

      // Salva token no banco
      await this.saveVerificationToken(userData.id, token, tokenExpiration);

      // Prepara dados do template
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        email: userData.email,
        tipoUsuario: userData.tipoUsuario,
        verificationUrl,
        token,
        expirationHours:
          this.config.getConfig().emailVerification.tokenExpirationHours,
        frontendUrl: this.config.getConfig().urls.frontend,
      };

      // Gera email de verificação
      const emailContent =
        EmailTemplates.generateVerificationEmail(templateData);

      // Envia email
      const result = await this.client.sendEmail({
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (result.success) {
        await this.logEmailSuccess(
          userData.id,
          "VERIFICACAO_EMAIL",
          result.messageId
        );
        console.log(
          `✅ [${correlationId}] Email de verificação enviado com sucesso`
        );
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(
        `❌ [${correlationId}] Erro no email de verificação:`,
        errorMsg
      );
      throw error;
    }
  }

  /**
   * Envia email de boas-vindas simples (sem verificação)
   */
  private async sendSimpleWelcomeEmail(
    userData: WelcomeEmailData,
    correlationId: string
  ): Promise<EmailResult> {
    try {
      console.log(
        `🎉 [${correlationId}] Enviando boas-vindas simples para: ${userData.email}`
      );

      // Prepara dados do template
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: userData.tipoUsuario,
        email: userData.email,
        frontendUrl: this.config.getConfig().urls.frontend,
      };

      // Gera email de boas-vindas
      const emailContent = EmailTemplates.generateWelcomeEmail(templateData);

      // Envia email
      const result = await this.client.sendEmail({
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (result.success) {
        await this.logEmailSuccess(
          userData.id,
          "BOAS_VINDAS",
          result.messageId
        );
        console.log(
          `✅ [${correlationId}] Email de boas-vindas enviado com sucesso`
        );
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(
        `❌ [${correlationId}] Erro no email de boas-vindas:`,
        errorMsg
      );
      throw error;
    }
  }

  /**
   * Verifica token de verificação de email
   */
  public async verifyEmailToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    expired?: boolean;
    alreadyVerified?: boolean;
    error?: string;
  }> {
    try {
      console.log(`🔍 Verificando token: ${token.substring(0, 8)}...`);

      // Busca usuário pelo token
      const usuario = await prisma.usuario.findFirst({
        where: {
          emailVerificationToken: token,
        },
        select: {
          id: true,
          email: true,
          emailVerificado: true,
          emailVerificationTokenExp: true,
        },
      });

      if (!usuario) {
        return { valid: false, error: "Token inválido" };
      }

      // Verifica se já está verificado
      if (usuario.emailVerificado) {
        return { valid: false, alreadyVerified: true, userId: usuario.id };
      }

      // Verifica expiração
      if (
        usuario.emailVerificationTokenExp &&
        usuario.emailVerificationTokenExp < new Date()
      ) {
        return { valid: false, expired: true, userId: usuario.id };
      }

      // Token válido - marca como verificado
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: true,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          status: "ATIVO", // ✅ CORREÇÃO: Usar string ao invés de enum
        },
      });

      console.log(
        `✅ Email verificado com sucesso para usuário: ${usuario.id}`
      );
      return { valid: true, userId: usuario.id };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error("❌ Erro na verificação de token:", errorMsg);
      return { valid: false, error: errorMsg };
    }
  }

  /**
   * Health check
   */
  public async checkHealth(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      return false;
    }
  }

  // ===========================
  // MÉTODOS PRIVADOS
  // ===========================

  /**
   * Salva token de verificação no banco
   */
  private async saveVerificationToken(
    userId: string,
    token: string,
    expiration: Date
  ): Promise<void> {
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationTokenExp: expiration,
        status: "PENDENTE", // ✅ CORREÇÃO: Usar PENDENTE ao invés de PENDENTE_VERIFICACAO
      },
    });
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
          tipoEmail: operation as any, // Forçar cast para enum
          status: "ENVIADO",
          messageId: messageId || "",
          tentativas: 1, // ✅ CORREÇÃO: tentativas ao invés de tentativa
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
          tipoEmail: operation as any, // Forçar cast para enum
          status: "FALHA",
          erro: error,
          tentativas: 1, // ✅ CORREÇÃO: tentativas ao invés de tentativa
        },
      });
    } catch (logError) {
      console.warn("⚠️ Erro ao registrar log de erro:", logError);
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
   * Gera correlation ID para rastreamento
   */
  private generateCorrelationId(): string {
    return `email-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
}

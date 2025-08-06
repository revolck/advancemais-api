import { BrevoClient } from "../client/brevo-client";
import { BrevoConfigManager } from "../config/brevo-config";
import { EmailTemplates } from "../templates/email-templates";
import { prisma } from "../../../config/prisma";
import { brevoConfig } from "../../../config/env";

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

export class EmailService {
  private client: BrevoClient;
  private config: BrevoConfigManager;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = BrevoConfigManager.getInstance();
  }

  public async sendWelcomeEmail(
    userData: WelcomeEmailData
  ): Promise<EmailResult> {
    const correlationId = this.generateCorrelationId();

    try {
      console.log(
        `📧 [${correlationId}] Enviando email de boas-vindas para: ${userData.email}`
      );

      if (!this.isValidEmailData(userData)) {
        throw new Error("Dados do usuário inválidos para email");
      }

      // Se for usuário de teste, não mexe no banco
      if (userData.id.startsWith("test_user_")) {
        console.log(`🧪 [${correlationId}] Usuário de teste detectado`);
        return await this.sendTestEmail(userData, correlationId);
      }

      if (this.config.isEmailVerificationEnabled()) {
        return await this.sendVerificationEmail(userData, correlationId);
      }

      return await this.sendSimpleWelcomeEmail(userData, correlationId);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ [${correlationId}] Erro no email:`, errorMsg);

      if (!userData.id.startsWith("test_user_")) {
        await this.logEmailError(userData.id, "BOAS_VINDAS", errorMsg);
      }

      return { success: false, error: errorMsg };
    }
  }

  private async sendTestEmail(
    userData: WelcomeEmailData,
    correlationId: string
  ): Promise<EmailResult> {
    try {
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: userData.tipoUsuario,
        email: userData.email,
        frontendUrl: this.config.getConfig().urls.frontend,
      };

      const emailContent = EmailTemplates.generateWelcomeEmail(templateData);

      const result = await this.client.sendEmail({
        to: userData.email,
        toName: userData.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      console.log(`✅ [${correlationId}] Email de teste enviado`);
      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      return { success: false, error: errorMsg };
    }
  }

  private async sendVerificationEmail(
    userData: WelcomeEmailData,
    correlationId: string
  ): Promise<EmailResult> {
    try {
      const usuarioExiste = await prisma.usuario.findUnique({
        where: { id: userData.id },
        select: { id: true, emailVerificado: true },
      });

      if (!usuarioExiste) {
        throw new Error(`Usuário ${userData.id} não encontrado`);
      }

      if (usuarioExiste.emailVerificado) {
        return { success: true, simulated: true };
      }

      const token = this.config.generateVerificationToken();
      const tokenExpiration = this.config.getTokenExpirationDate();
      const verificationUrl = this.config.generateVerificationUrl(token);

      await this.saveVerificationToken(userData.id, token, tokenExpiration);

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

      const emailContent =
        EmailTemplates.generateVerificationEmail(templateData);

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
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      throw error;
    }
  }

  private async sendSimpleWelcomeEmail(
    userData: WelcomeEmailData,
    correlationId: string
  ): Promise<EmailResult> {
    try {
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: userData.tipoUsuario,
        email: userData.email,
        frontendUrl: this.config.getConfig().urls.frontend,
      };

      const emailContent = EmailTemplates.generateWelcomeEmail(templateData);

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
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      throw error;
    }
  }

  public async enviarEmailRecuperacaoSenha(
    usuario: { id: string; email: string; nomeCompleto: string },
    token: string
  ): Promise<EmailResult> {
    const correlationId = this.generateCorrelationId();

    try {
      const linkRecuperacao = `${
        this.config.getConfig().urls.passwordRecovery
      }?tp=${token}&ep=${encodeURIComponent(usuario.email)}`;
      const templateData = {
        nomeCompleto: usuario.nomeCompleto,
        token,
        linkRecuperacao,
        expiracaoHoras:
          brevoConfig.passwordRecovery.tokenExpirationMinutes / 60,
        maxTentativas: brevoConfig.passwordRecovery.maxAttempts,
      };

      const emailContent =
        EmailTemplates.generatePasswordRecoveryEmail(templateData);

      const result = await this.client.sendEmail({
        to: usuario.email,
        toName: usuario.nomeCompleto,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (result.success) {
        await this.logEmailSuccess(
          usuario.id,
          "RECUPERACAO_SENHA",
          result.messageId
        );
      } else {
        await this.logEmailError(
          usuario.id,
          "RECUPERACAO_SENHA",
          result.error || "Erro desconhecido"
        );
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      await this.logEmailError(usuario.id, "RECUPERACAO_SENHA", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  public async verifyEmailToken(token: string) {
    try {
      const usuario = await prisma.usuario.findFirst({
        where: { emailVerificationToken: token },
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

      if (usuario.emailVerificado) {
        return { valid: false, alreadyVerified: true, userId: usuario.id };
      }

      if (
        usuario.emailVerificationTokenExp &&
        usuario.emailVerificationTokenExp < new Date()
      ) {
        return { valid: false, expired: true, userId: usuario.id };
      }

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: true,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          status: "ATIVO",
        },
      });

      return { valid: true, userId: usuario.id };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      return { valid: false, error: errorMsg };
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      return false;
    }
  }

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
        status: "PENDENTE",
      },
    });
  }

  private async logEmailSuccess(
    userId: string,
    operation: string,
    messageId?: string
  ): Promise<void> {
    try {
      if (userId.startsWith("test_user_")) return;

      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail: operation as any,
          status: "ENVIADO",
          messageId: messageId || "",
          tentativas: 1,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log:", error);
    }
  }

  private async logEmailError(
    userId: string,
    operation: string,
    error: string
  ): Promise<void> {
    try {
      if (userId.startsWith("test_user_")) return;

      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail: operation as any,
          status: "FALHA",
          erro: error,
          tentativas: 1,
        },
      });
    } catch (logError) {
      console.warn("⚠️ Erro ao registrar log:", logError);
    }
  }

  private isValidEmailData(userData: any): boolean {
    return !!(
      userData?.id &&
      userData?.email &&
      userData?.nomeCompleto &&
      userData?.tipoUsuario &&
      this.isValidEmail(userData.email)
    );
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateCorrelationId(): string {
    return `email-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
}

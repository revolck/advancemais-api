import { BrevoClient } from "../client/brevo-client";
import { BrevoConfigManager } from "../config/brevo-config";
import { EmailTemplates } from "../templates/email-templates";
import { prisma } from "../../../config/prisma";

/**
 * Serviço especializado em verificação de email
 * Implementa padrões de microserviços com alta disponibilidade
 *
 * Responsabilidades:
 * - Enviar emails de verificação
 * - Validar tokens de verificação
 * - Gerenciar tentativas de reenvio
 * - Registrar logs de auditoria
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Sistema completo de verificação
 */
export interface EmailVerificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
  tokenExpiration?: Date;
}

export interface VerificationTokenResult {
  valid: boolean;
  userId?: string;
  expired?: boolean;
  alreadyVerified?: boolean;
  error?: string;
}

export class EmailVerificationService {
  private client: BrevoClient;
  private config: BrevoConfigManager;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = BrevoConfigManager.getInstance();
  }

  /**
   * Envia email de verificação para novo usuário
   */
  public async sendVerificationEmail(userData: {
    id: string;
    email: string;
    nomeCompleto: string;
    tipoUsuario: string;
  }): Promise<EmailVerificationResult> {
    const operation = "EMAIL_VERIFICATION";
    const correlationId = this.generateCorrelationId();

    try {
      console.log(
        `📧 [${correlationId}] ${operation}: Enviando para ${userData.email}`
      );

      // Valida se verificação está habilitada
      if (!this.config.isEmailVerificationEnabled()) {
        console.log(`ℹ️ [${correlationId}] Verificação de email desabilitada`);
        return { success: true, simulated: true };
      }

      // Verifica se usuário já está verificado
      const usuario = await prisma.usuario.findUnique({
        where: { id: userData.id },
        select: { emailVerificado: true, email: true },
      });

      if (!usuario) {
        throw new Error("Usuário não encontrado");
      }

      if (usuario.emailVerificado) {
        console.log(
          `ℹ️ [${correlationId}] Email já verificado para usuário ${userData.id}`
        );
        return { success: true, simulated: true };
      }

      // Verifica limite de tentativas de reenvio
      const canResend = await this.checkResendLimit(userData.id, correlationId);
      if (!canResend) {
        throw new Error("Limite de tentativas de reenvio atingido");
      }

      // Gera token de verificação
      const token = this.config.generateVerificationToken();
      const tokenExpiration = this.config.getTokenExpirationDate();
      const verificationUrl = this.config.generateVerificationUrl(token);

      // Salva token no banco
      await this.saveVerificationToken(
        userData.id,
        token,
        tokenExpiration,
        correlationId
      );

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
      const result = await this.performEmailSend(
        {
          to: userData.email,
          toName: userData.nomeCompleto,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        },
        correlationId
      );

      // Registra resultado
      if (result.success) {
        await this.logVerificationEmailSuccess(
          userData.id,
          operation,
          result.messageId,
          correlationId
        );
        console.log(`✅ [${correlationId}] ${operation}: Sucesso`);
      } else {
        await this.logVerificationEmailError(
          userData.id,
          operation,
          result.error || "Erro desconhecido",
          correlationId
        );
      }

      return {
        ...result,
        tokenExpiration,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ [${correlationId}] ${operation}: ${errorMsg}`);

      await this.logVerificationEmailError(
        userData.id,
        operation,
        errorMsg,
        correlationId
      );

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Verifica token de verificação
   */
  public async verifyEmailToken(
    token: string
  ): Promise<VerificationTokenResult> {
    const correlationId = this.generateCorrelationId();

    try {
      console.log(
        `🔍 [${correlationId}] Verificando token: ${token.substring(0, 8)}...`
      );

      if (!token || token.trim() === "") {
        return { valid: false, error: "Token não fornecido" };
      }

      // Busca token no banco
      const usuario = await prisma.usuario.findFirst({
        where: {
          emailVerificationToken: token,
        },
        select: {
          id: true,
          email: true,
          emailVerificado: true,
          emailVerificationTokenExp: true,
          emailVerificationToken: true,
        },
      });

      if (!usuario) {
        console.warn(`⚠️ [${correlationId}] Token não encontrado`);
        return { valid: false, error: "Token inválido" };
      }

      // Verifica se já está verificado
      if (usuario.emailVerificado) {
        console.log(
          `ℹ️ [${correlationId}] Email já verificado para usuário ${usuario.id}`
        );
        return { valid: false, alreadyVerified: true, userId: usuario.id };
      }

      // Verifica expiração
      if (
        !usuario.emailVerificationTokenExp ||
        new Date() > usuario.emailVerificationTokenExp
      ) {
        console.warn(
          `⚠️ [${correlationId}] Token expirado para usuário ${usuario.id}`
        );

        // Remove token expirado
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            emailVerificationToken: null,
            emailVerificationTokenExp: null,
          },
        });

        return { valid: false, expired: true, userId: usuario.id };
      }

      // Token válido - marca email como verificado
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: true,
          emailVerificationToken: null,
          emailVerificationTokenExp: null,
          emailVerificadoEm: new Date(),
        },
      });

      console.log(
        `✅ [${correlationId}] Email verificado com sucesso para usuário ${usuario.id}`
      );

      // Log de sucesso
      await this.logEmailVerified(usuario.id, correlationId);

      return { valid: true, userId: usuario.id };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ [${correlationId}] Erro na verificação: ${errorMsg}`);

      return {
        valid: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Reenvia email de verificação
   */
  public async resendVerificationEmail(
    email: string
  ): Promise<EmailVerificationResult> {
    const correlationId = this.generateCorrelationId();

    try {
      console.log(
        `🔄 [${correlationId}] Reenviando verificação para: ${email}`
      );

      // Busca usuário pelo email
      const usuario = await prisma.usuario.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          tipoUsuario: true,
          emailVerificado: true,
          status: true,
        },
      });

      if (!usuario) {
        return { success: false, error: "Usuário não encontrado" };
      }

      if (usuario.emailVerificado) {
        return { success: false, error: "Email já verificado" };
      }

      if (usuario.status !== "ATIVO") {
        return { success: false, error: "Conta inativa" };
      }

      // Envia novo email de verificação
      return await this.sendVerificationEmail(usuario);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(`❌ [${correlationId}] Erro no reenvio: ${errorMsg}`);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Verifica se usuário pode receber novo email (rate limiting)
   */
  private async checkResendLimit(
    userId: string,
    correlationId: string
  ): Promise<boolean> {
    try {
      const config = this.config.getConfig();
      const cooldownMinutes = config.emailVerification.resendCooldownMinutes;
      const maxAttempts = config.emailVerification.maxResendAttempts;

      // Busca tentativas recentes
      const recentAttempts = await prisma.logEmail.count({
        where: {
          usuarioId: userId,
          tipoEmail: "VERIFICACAO_EMAIL",
          criadoEm: {
            gte: new Date(Date.now() - cooldownMinutes * 60 * 1000),
          },
        },
      });

      const canResend = recentAttempts < maxAttempts;

      if (!canResend) {
        console.warn(
          `⚠️ [${correlationId}] Limite de reenvio atingido para usuário ${userId}: ${recentAttempts}/${maxAttempts}`
        );
      }

      return canResend;
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro ao verificar limite de reenvio:`,
        error
      );
      return true; // Em caso de erro, permite reenvio
    }
  }

  /**
   * Salva token de verificação no banco
   */
  private async saveVerificationToken(
    userId: string,
    token: string,
    expiration: Date,
    correlationId: string
  ): Promise<void> {
    try {
      await prisma.usuario.update({
        where: { id: userId },
        data: {
          emailVerificationToken: token,
          emailVerificationTokenExp: expiration,
        },
      });

      console.log(
        `💾 [${correlationId}] Token de verificação salvo para usuário ${userId}`
      );
    } catch (error) {
      console.error(`❌ [${correlationId}] Erro ao salvar token:`, error);
      throw error;
    }
  }

  /**
   * Executa envio do email
   */
  private async performEmailSend(
    emailData: {
      to: string;
      toName: string;
      subject: string;
      html: string;
      text: string;
    },
    correlationId: string
  ): Promise<EmailVerificationResult> {
    // Modo simulado
    if (this.client.isSimulated()) {
      console.log(
        `🎭 [${correlationId}] Email de verificação simulado para: ${emailData.to}`
      );
      return {
        success: true,
        messageId: `sim_verify_${Date.now()}`,
        simulated: true,
      };
    }

    // Envio real
    try {
      const Brevo = await import("@getbrevo/brevo");
      const config = this.config.getConfig();

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
      console.error(`❌ [${correlationId}] Erro no envio via Brevo:`, error);

      // Fallback para simulação
      console.log(`🎭 [${correlationId}] Fallback para modo simulado`);
      return {
        success: true,
        messageId: `fallback_verify_${Date.now()}`,
        simulated: true,
      };
    }
  }

  // Métodos de logging
  private async logVerificationEmailSuccess(
    userId: string,
    operation: string,
    messageId?: string,
    correlationId?: string
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail: "VERIFICACAO_EMAIL",
          status: "ENVIADO",
          tentativas: 1,
          messageId,
        },
      });
    } catch (error) {
      console.warn(
        `⚠️ [${correlationId}] Erro ao registrar log de sucesso:`,
        error
      );
    }
  }

  private async logVerificationEmailError(
    userId: string,
    operation: string,
    error: string,
    correlationId?: string
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail: "VERIFICACAO_EMAIL",
          status: "FALHA",
          tentativas: 1,
          erro: error,
        },
      });
    } catch (logError) {
      console.warn(
        `⚠️ [${correlationId}] Erro ao registrar log de erro:`,
        logError
      );
    }
  }

  private async logEmailVerified(
    userId: string,
    correlationId?: string
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: "",
          tipoEmail: "VERIFICACAO_EMAIL",
          status: "ENVIADO",
          tentativas: 1,
          messageId: "verified",
        },
      });
    } catch (error) {
      console.warn(
        `⚠️ [${correlationId}] Erro ao registrar log de verificação:`,
        error
      );
    }
  }

  // Métodos auxiliares
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_verify_${Date.now()}`;
  }

  private generateCorrelationId(): string {
    return `verify-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Health check público
   */
  public async checkHealth(): Promise<boolean> {
    return this.client.isOperational() || this.client.isSimulated();
  }
}

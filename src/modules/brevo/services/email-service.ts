import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { EmailTemplates } from "../templates/email-templates";
import { brevoConfig } from "../../../config/env";
import { prisma } from "../../../config/prisma";

/**
 * Interface para dados de email
 */
interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  templateParams?: Record<string, any>;
}

/**
 * Interface para resposta de envio de email
 */
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Serviço para envio de emails via Brevo
 * Gerencia templates, logs e envios transacionais
 */
export class EmailService {
  private transactionalEmailsApi: Brevo.TransactionalEmailsApi;

  constructor() {
    const brevoClient = BrevoClient.getInstance();
    this.transactionalEmailsApi = brevoClient.getTransactionalEmailsApi();
  }

  /**
   * Envia email transacional
   * @param emailData - Dados do email a ser enviado
   * @param usuarioId - ID do usuário (opcional para log)
   * @returns Promise<EmailResponse> Resultado do envio
   */
  public async enviarEmail(
    emailData: EmailData,
    usuarioId?: string
  ): Promise<EmailResponse> {
    try {
      // Prepara os dados do email
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.to = [{ email: emailData.to, name: emailData.toName }];
      sendSmtpEmail.sender = {
        email: brevoConfig.fromEmail,
        name: brevoConfig.fromName,
      };
      sendSmtpEmail.subject = emailData.subject;
      sendSmtpEmail.htmlContent = emailData.htmlContent;
      sendSmtpEmail.textContent = emailData.textContent;

      // Se foi especificado um template
      if (emailData.templateId) {
        sendSmtpEmail.templateId = emailData.templateId;
        sendSmtpEmail.params = emailData.templateParams;
      }

      // Envia o email
      const response = await this.transactionalEmailsApi.sendTransacEmail(
        sendSmtpEmail
      );

      // Extrai messageId da resposta - estrutura correta do Brevo
      let messageId = "unknown";

      if (response && typeof response === "object") {
        // Tenta extrair o messageId de diferentes possíveis estruturas
        if ((response as any).messageId) {
          messageId = String((response as any).messageId);
        } else if ((response as any).body && (response as any).body.messageId) {
          messageId = String((response as any).body.messageId);
        } else if ((response as any).data && (response as any).data.messageId) {
          messageId = String((response as any).data.messageId);
        }
      }

      // Log de sucesso
      await this.logEmail({
        usuarioId,
        email: emailData.to,
        tipoEmail: this.getTipoEmailFromSubject(emailData.subject),
        status: "ENVIADO",
        tentativas: 1,
        messageId,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error("Erro ao enviar email:", error);

      // Log de erro
      await this.logEmail({
        usuarioId,
        email: emailData.to,
        tipoEmail: this.getTipoEmailFromSubject(emailData.subject),
        status: "FALHA",
        tentativas: 1,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia email de boas-vindas para novos usuários
   * @param usuario - Dados do usuário cadastrado
   * @returns Promise<EmailResponse> Resultado do envio
   */
  public async enviarEmailBoasVindas(usuario: {
    id: string;
    email: string;
    nomeCompleto: string;
    tipoUsuario: string;
  }): Promise<EmailResponse> {
    const tipoUsuarioTexto =
      usuario.tipoUsuario === "PESSOA_FISICA" ? "pessoa física" : "empresa";

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const htmlContent = EmailTemplates.gerarTemplateBoasVindas({
      nomeCompleto: usuario.nomeCompleto,
      tipoUsuario: tipoUsuarioTexto,
      frontendUrl,
      ano: new Date().getFullYear(),
    });

    const textContent = EmailTemplates.gerarTextoBoasVindas({
      nomeCompleto: usuario.nomeCompleto,
      tipoUsuario: tipoUsuarioTexto,
      frontendUrl,
      ano: new Date().getFullYear(),
    });

    const result = await this.enviarEmail(
      {
        to: usuario.email,
        toName: usuario.nomeCompleto,
        subject: "Bem-vindo(a) ao AdvanceMais! 🎉",
        htmlContent,
        textContent,
      },
      usuario.id
    );

    // Atualiza flag de email enviado SOMENTE se o envio foi bem-sucedido
    if (result.success) {
      try {
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            emailBoasVindasEnviado: true,
            dataEmailBoasVindas: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Erro ao atualizar flag de email enviado:", updateError);
        // Não falha o processo principal se não conseguir atualizar a flag
      }
    }

    return result;
  }

  /**
   * Envia email de recuperação de senha
   * @param usuario - Dados do usuário
   * @param token - Token de recuperação
   * @returns Promise<EmailResponse> Resultado do envio
   */
  public async enviarEmailRecuperacaoSenha(
    usuario: { id: string; email: string; nomeCompleto: string },
    token: string
  ): Promise<EmailResponse> {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const linkRecuperacao = `${frontendUrl}/recuperar-senha?token=${token}`;

    const htmlContent = EmailTemplates.gerarTemplateRecuperacaoSenha({
      nomeCompleto: usuario.nomeCompleto,
      linkRecuperacao,
      token,
      expiracaoMinutos: brevoConfig.passwordRecovery.tokenExpirationMinutes,
      maxTentativas: brevoConfig.passwordRecovery.maxAttempts,
      frontendUrl,
      ano: new Date().getFullYear(),
    });

    const textContent = EmailTemplates.gerarTextoRecuperacaoSenha({
      nomeCompleto: usuario.nomeCompleto,
      linkRecuperacao,
      token,
      expiracaoMinutos: brevoConfig.passwordRecovery.tokenExpirationMinutes,
      maxTentativas: brevoConfig.passwordRecovery.maxAttempts,
      frontendUrl,
      ano: new Date().getFullYear(),
    });

    return await this.enviarEmail(
      {
        to: usuario.email,
        toName: usuario.nomeCompleto,
        subject: "Recuperação de Senha - AdvanceMais 🔐",
        htmlContent,
        textContent,
      },
      usuario.id
    );
  }

  /**
   * Determina o tipo de email baseado no assunto
   * @param subject - Assunto do email
   * @returns Tipo do email
   */
  private getTipoEmailFromSubject(
    subject: string
  ):
    | "BOAS_VINDAS"
    | "RECUPERACAO_SENHA"
    | "VERIFICACAO_EMAIL"
    | "NOTIFICACAO_SISTEMA" {
    if (subject.includes("Bem-vindo")) return "BOAS_VINDAS";
    if (subject.includes("Recuperação")) return "RECUPERACAO_SENHA";
    if (subject.includes("Verificação")) return "VERIFICACAO_EMAIL";
    return "NOTIFICACAO_SISTEMA";
  }

  /**
   * Registra log de email no banco de dados
   * @param logData - Dados do log
   */
  private async logEmail(logData: {
    usuarioId?: string;
    email: string;
    tipoEmail: string;
    status: string;
    tentativas: number;
    erro?: string;
    messageId?: string;
  }): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: logData.usuarioId,
          email: logData.email,
          tipoEmail: logData.tipoEmail as any,
          status: logData.status as any,
          tentativas: logData.tentativas,
          erro: logData.erro,
          messageId: logData.messageId,
        },
      });
    } catch (error) {
      console.error("Erro ao registrar log de email:", error);
      // Não falha o processo principal se não conseguir fazer o log
    }
  }
}

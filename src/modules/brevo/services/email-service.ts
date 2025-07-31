import * as Brevo from "@getbrevo/brevo";
import { BrevoClient } from "../client/brevo-client";
import { EmailTemplates } from "../templates/email-templates";
import { brevoConfig } from "../../../config/env";
import { prisma } from "../../../config/prisma";

/**
 * Interface para dados básicos de email
 */
interface EmailData {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  templateParams?: Record<string, any>;
  attachments?: Array<{
    name: string;
    content: string; // base64
    contentType?: string;
  }>;
  headers?: Record<string, string>;
  tags?: string[];
}

/**
 * Interface para resposta de envio de email
 */
interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  details?: any;
}

/**
 * Interface para dados de email de boas-vindas
 */
interface WelcomeEmailData {
  id: string;
  email: string;
  nomeCompleto: string;
  tipoUsuario: string;
}

/**
 * Interface para dados de email de recuperação de senha
 */
interface PasswordRecoveryEmailData {
  id: string;
  email: string;
  nomeCompleto: string;
}

/**
 * Serviço para envio de emails via Brevo (ex-Sendinblue)
 *
 * Funcionalidades principais:
 * - Envio de emails transacionais
 * - Templates personalizados em HTML
 * - Log de envios no banco de dados
 * - Tratamento de erros robusto
 * - Suporte a anexos e headers customizados
 *
 * Configuração SMTP:
 * - Servidor: smtp-relay.brevo.com
 * - Porta: 587
 * - Autenticação: SASL
 * - Segurança: TLS
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
export class EmailService {
  private transactionalEmailsApi: Brevo.TransactionalEmailsApi;
  private fromEmail: string;
  private fromName: string;

  /**
   * Construtor do serviço de email
   * Inicializa a API do Brevo e configura remetente padrão
   */
  constructor() {
    const brevoClient = BrevoClient.getInstance();
    this.transactionalEmailsApi = brevoClient.getTransactionalEmailsApi();

    // Configurações do remetente padrão
    this.fromEmail = brevoConfig.fromEmail;
    this.fromName = brevoConfig.fromName;

    console.log(
      `📧 EmailService inicializado - Remetente: ${this.fromName} <${this.fromEmail}>`
    );
  }

  /**
   * Envia um email transacional através do Brevo
   *
   * @param {EmailData} emailData - Dados completos do email a ser enviado
   * @param {string} [usuarioId] - ID do usuário para logging (opcional)
   * @returns {Promise<EmailResponse>} Resultado detalhado do envio
   */
  public async enviarEmail(
    emailData: EmailData,
    usuarioId?: string
  ): Promise<EmailResponse> {
    try {
      console.log(
        `📤 Enviando email para: ${emailData.to} - Assunto: ${emailData.subject}`
      );

      // Valida dados obrigatórios
      if (!this.validarDadosEmail(emailData)) {
        return {
          success: false,
          error: "Dados de email inválidos - verifique destinatário e conteúdo",
        };
      }

      // Prepara o objeto de email para o Brevo
      const sendSmtpEmail = this.construirEmailBrevo(emailData);

      // Envia o email através da API
      const response = await this.transactionalEmailsApi.sendTransacEmail(
        sendSmtpEmail
      );

      // Extrai o messageId da resposta
      const messageId = this.extrairMessageId(response);

      // Registra o sucesso no log
      await this.registrarLogEmail({
        usuarioId,
        email: emailData.to,
        tipoEmail: this.inferirTipoEmail(emailData.subject),
        status: "ENVIADO",
        tentativas: 1,
        messageId,
        assunto: emailData.subject,
      });

      console.log(`✅ Email enviado com sucesso - MessageID: ${messageId}`);

      return {
        success: true,
        messageId,
        details: response,
      };
    } catch (error) {
      console.error("❌ Erro ao enviar email:", error);

      // Registra o erro no log
      await this.registrarLogEmail({
        usuarioId,
        email: emailData.to,
        tipoEmail: this.inferirTipoEmail(emailData.subject),
        status: "FALHA",
        tentativas: 1,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
        assunto: emailData.subject,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: error,
      };
    }
  }

  /**
   * Envia email de boas-vindas para novos usuários
   * Utiliza template personalizado e registra o envio
   *
   * @param {WelcomeEmailData} usuario - Dados do usuário para personalização
   * @returns {Promise<EmailResponse>} Resultado do envio
   */
  public async enviarEmailBoasVindas(
    usuario: WelcomeEmailData
  ): Promise<EmailResponse> {
    try {
      console.log(`🎉 Preparando email de boas-vindas para: ${usuario.email}`);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const tipoUsuarioTexto = this.formatarTipoUsuario(usuario.tipoUsuario);

      // Gera conteúdo HTML personalizado
      const htmlContent = EmailTemplates.gerarTemplateBoasVindas({
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: tipoUsuarioTexto,
        frontendUrl,
        ano: new Date().getFullYear(),
      });

      // Gera versão texto alternativa
      const textContent = EmailTemplates.gerarTextoBoasVindas({
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: tipoUsuarioTexto,
        frontendUrl,
        ano: new Date().getFullYear(),
      });

      // Envia o email
      const resultado = await this.enviarEmail(
        {
          to: usuario.email,
          toName: usuario.nomeCompleto,
          subject: `Bem-vindo(a) ao AdvanceMais, ${
            usuario.nomeCompleto.split(" ")[0]
          }! 🎉`,
          htmlContent,
          textContent,
          tags: ["boas-vindas", "novo-usuario"],
          headers: {
            "X-Mailin-Custom": `user-${usuario.id}`,
            "X-Category": "welcome",
          },
        },
        usuario.id
      );

      // Se o envio foi bem-sucedido, atualiza o registro do usuário
      if (resultado.success) {
        try {
          await prisma.usuario.update({
            where: { id: usuario.id },
            data: {
              emailBoasVindasEnviado: true,
              dataEmailBoasVindas: new Date(),
            },
          });
          console.log(
            `📝 Flag de email de boas-vindas atualizada para usuário ${usuario.id}`
          );
        } catch (updateError) {
          console.error(
            "⚠️ Erro ao atualizar flag de email enviado:",
            updateError
          );
          // Não falha o processo principal se não conseguir atualizar a flag
        }
      }

      return resultado;
    } catch (error) {
      console.error("❌ Erro no envio de email de boas-vindas:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro no email de boas-vindas",
      };
    }
  }

  /**
   * Envia email de recuperação de senha
   * Inclui link seguro e token temporário
   *
   * @param {PasswordRecoveryEmailData} usuario - Dados do usuário
   * @param {string} token - Token de recuperação gerado
   * @returns {Promise<EmailResponse>} Resultado do envio
   */
  public async enviarEmailRecuperacaoSenha(
    usuario: PasswordRecoveryEmailData,
    token: string
  ): Promise<EmailResponse> {
    try {
      console.log(
        `🔐 Preparando email de recuperação de senha para: ${usuario.email}`
      );

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const linkRecuperacao = `${frontendUrl}/recuperar-senha?token=${token}`;

      // Gera conteúdo HTML personalizado
      const htmlContent = EmailTemplates.gerarTemplateRecuperacaoSenha({
        nomeCompleto: usuario.nomeCompleto,
        linkRecuperacao,
        token,
        expiracaoMinutos: brevoConfig.passwordRecovery.tokenExpirationMinutes,
        maxTentativas: brevoConfig.passwordRecovery.maxAttempts,
        frontendUrl,
        ano: new Date().getFullYear(),
      });

      // Gera versão texto alternativa
      const textContent = EmailTemplates.gerarTextoRecuperacaoSenha({
        nomeCompleto: usuario.nomeCompleto,
        linkRecuperacao,
        token,
        expiracaoMinutos: brevoConfig.passwordRecovery.tokenExpirationMinutes,
        maxTentativas: brevoConfig.passwordRecovery.maxAttempts,
        frontendUrl,
        ano: new Date().getFullYear(),
      });

      // Envia o email com alta prioridade
      return await this.enviarEmail(
        {
          to: usuario.email,
          toName: usuario.nomeCompleto,
          subject: `Recuperação de Senha - AdvanceMais 🔐`,
          htmlContent,
          textContent,
          tags: ["recuperacao-senha", "seguranca"],
          headers: {
            "X-Mailin-Custom": `user-${usuario.id}`,
            "X-Category": "password-recovery",
            "X-Priority": "1", // Alta prioridade
          },
        },
        usuario.id
      );
    } catch (error) {
      console.error("❌ Erro no envio de email de recuperação:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro no email de recuperação",
      };
    }
  }

  /**
   * Valida se os dados do email estão corretos
   *
   * @param {EmailData} emailData - Dados para validação
   * @returns {boolean} true se válidos, false caso contrário
   */
  private validarDadosEmail(emailData: EmailData): boolean {
    // Verifica email do destinatário
    if (!emailData.to || !this.validarFormatoEmail(emailData.to)) {
      console.error("❌ Email do destinatário inválido:", emailData.to);
      return false;
    }

    // Verifica assunto
    if (!emailData.subject || emailData.subject.trim() === "") {
      console.error("❌ Assunto do email não pode estar vazio");
      return false;
    }

    // Verifica conteúdo
    if (!emailData.htmlContent || emailData.htmlContent.trim() === "") {
      console.error("❌ Conteúdo HTML do email não pode estar vazio");
      return false;
    }

    return true;
  }

  /**
   * Valida formato de email usando regex
   *
   * @param {string} email - Email para validar
   * @returns {boolean} true se válido
   */
  private validarFormatoEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Constrói o objeto de email no formato esperado pelo Brevo
   *
   * @param {EmailData} emailData - Dados do email
   * @returns {Brevo.SendSmtpEmail} Objeto configurado para o Brevo
   */
  private construirEmailBrevo(emailData: EmailData): Brevo.SendSmtpEmail {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    // Configuração básica
    sendSmtpEmail.to = [
      {
        email: emailData.to,
        name: emailData.toName,
      },
    ];

    sendSmtpEmail.sender = {
      email: this.fromEmail,
      name: this.fromName,
    };

    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.htmlContent = emailData.htmlContent;

    // Configurações opcionais
    if (emailData.textContent) {
      sendSmtpEmail.textContent = emailData.textContent;
    }

    if (emailData.templateId) {
      sendSmtpEmail.templateId = emailData.templateId;
      sendSmtpEmail.params = emailData.templateParams;
    }

    if (emailData.attachments && emailData.attachments.length > 0) {
      sendSmtpEmail.attachment = emailData.attachments;
    }

    if (emailData.headers) {
      sendSmtpEmail.headers = emailData.headers;
    }

    if (emailData.tags && emailData.tags.length > 0) {
      sendSmtpEmail.tags = emailData.tags;
    }

    return sendSmtpEmail;
  }

  /**
   * Extrai o messageId da resposta do Brevo
   * O Brevo pode retornar a resposta em diferentes formatos
   *
   * @param {any} response - Resposta da API do Brevo
   * @returns {string} MessageId extraído ou "unknown"
   */
  private extrairMessageId(response: any): string {
    if (!response) return "unknown";

    // Tenta diferentes estruturas de resposta
    if (response.messageId) {
      return String(response.messageId);
    }

    if (response.body && response.body.messageId) {
      return String(response.body.messageId);
    }

    if (response.data && response.data.messageId) {
      return String(response.data.messageId);
    }

    // Se não encontrar, gera um ID baseado em timestamp
    return `brevo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Infere o tipo de email baseado no assunto
   * Usado para categorização nos logs
   *
   * @param {string} subject - Assunto do email
   * @returns {string} Tipo inferido do email
   */
  private inferirTipoEmail(
    subject: string
  ):
    | "BOAS_VINDAS"
    | "RECUPERACAO_SENHA"
    | "VERIFICACAO_EMAIL"
    | "NOTIFICACAO_SISTEMA" {
    const subjectLower = subject.toLowerCase();

    if (subjectLower.includes("bem-vind") || subjectLower.includes("welcome")) {
      return "BOAS_VINDAS";
    }

    if (
      subjectLower.includes("recupera") ||
      subjectLower.includes("senha") ||
      subjectLower.includes("password")
    ) {
      return "RECUPERACAO_SENHA";
    }

    if (subjectLower.includes("verific") || subjectLower.includes("confirm")) {
      return "VERIFICACAO_EMAIL";
    }

    return "NOTIFICACAO_SISTEMA";
  }

  /**
   * Formata o tipo de usuário para exibição amigável
   *
   * @param {string} tipoUsuario - Tipo do usuário do enum
   * @returns {string} Descrição formatada
   */
  private formatarTipoUsuario(tipoUsuario: string): string {
    switch (tipoUsuario) {
      case "PESSOA_FISICA":
        return "pessoa física";
      case "PESSOA_JURIDICA":
        return "empresa";
      default:
        return "usuário";
    }
  }

  /**
   * Registra log de email no banco de dados
   * Mantém histórico para auditoria e troubleshooting
   *
   * @param {Object} logData - Dados para o log
   */
  private async registrarLogEmail(logData: {
    usuarioId?: string;
    email: string;
    tipoEmail: string;
    status: string;
    tentativas: number;
    erro?: string;
    messageId?: string;
    assunto?: string;
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
      console.error("⚠️ Erro ao registrar log de email:", error);
      // Não falha o processo principal se não conseguir fazer o log
    }
  }

  /**
   * Método utilitário para testar conectividade do serviço
   * Útil para health checks e diagnósticos
   *
   * @returns {Promise<boolean>} true se o serviço está funcionando
   */
  public async testarConectividade(): Promise<boolean> {
    try {
      const brevoClient = BrevoClient.getInstance();
      return await brevoClient.isConfigured();
    } catch (error) {
      console.error(
        "❌ Erro no teste de conectividade do EmailService:",
        error
      );
      return false;
    }
  }

  /**
   * Obtém estatísticas de envio de emails (últimos 30 dias)
   * Útil para monitoramento e relatórios
   *
   * @returns {Promise<any>} Estatísticas de envio ou null em caso de erro
   */
  public async obterEstatisticasEnvio(): Promise<any> {
    try {
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 30);

      const stats = await prisma.logEmail.groupBy({
        by: ["status", "tipoEmail"],
        where: {
          criadoEm: {
            gte: dataInicio,
          },
        },
        _count: {
          id: true,
        },
      });

      return {
        periodo: "últimos 30 dias",
        estatisticas: stats,
        totalEmails: stats.reduce((sum, stat) => sum + stat._count.id, 0),
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas de email:", error);
      return null;
    }
  }
}

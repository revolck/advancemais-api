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
 * Serviço de Email com tratamento robusto de erros
 * Implementa padrões de microserviços para resiliência
 *
 * @author Sistema AdvanceMais
 * @version 4.0.1 - Correção para templates assíncronos
 */
export class EmailService {
  private client: BrevoClient;
  private config: IBrevoConfig;
  private isInitialized: boolean = false;

  constructor() {
    this.client = BrevoClient.getInstance();
    this.config = this.client.getConfig();
    this.initialize();
  }

  /**
   * Inicializa o serviço de forma assíncrona
   * Padrão de inicialização segura para microserviços
   */
  private async initialize(): Promise<void> {
    try {
      // Valida configuração obrigatória
      await this.validateConfiguration();

      // Testa conectividade inicial
      const isHealthy = await this.client.checkHealth();

      if (isHealthy) {
        this.isInitialized = true;
        console.log("✅ EmailService: Inicializado com sucesso");
      } else {
        console.warn("⚠️ EmailService: Inicializado em modo degradado");
      }
    } catch (error) {
      console.error("❌ EmailService: Falha na inicialização:", error);
      // Serviço continua funcionando em modo degradado
    }
  }

  /**
   * Valida configuração obrigatória
   * Implementa validação rigorosa para ambiente de produção
   */
  private async validateConfiguration(): Promise<void> {
    const required = ["apiKey", "fromEmail", "fromName"];
    const missing = required.filter(
      (key) => !this.config[key as keyof IBrevoConfig]
    );

    if (missing.length > 0) {
      throw new Error(`Configuração incompleta: ${missing.join(", ")}`);
    }

    if (!this.isValidEmail(this.config.fromEmail)) {
      throw new Error(`Email remetente inválido: ${this.config.fromEmail}`);
    }
  }

  /**
   * Envia email de boas-vindas com tratamento completo
   * CORREÇÃO: Aguarda templates assíncronos corretamente
   *
   * @param userData - Dados do usuário para personalização
   * @returns Promise<ServiceResponse> - Resultado da operação
   */
  public async sendWelcomeEmail(
    userData: UserTemplateData
  ): Promise<ServiceResponse> {
    const operation = "WELCOME_EMAIL";
    const startTime = Date.now();

    try {
      console.log(`📧 ${operation}: Iniciando para ${userData.email}`);

      // Valida dados de entrada
      this.validateUserData(userData);

      // Prepara dados do template com valores dinâmicos
      const templateData = this.buildWelcomeTemplateData(userData);

      // CORREÇÃO: Aguarda geração assíncrona do conteúdo
      const emailContent = await this.generateWelcomeEmailContent(templateData);

      // Envia email com retry automático
      const result = await this.sendEmailWithRetry(emailContent, userData.id);

      // Registra sucesso e atualiza flags do usuário
      if (result.success) {
        await Promise.all([
          this.logEmailSuccess(userData, operation, result.messageId),
          this.updateUserWelcomeFlag(userData.id),
        ]);

        console.log(`✅ ${operation}: Sucesso em ${Date.now() - startTime}ms`);
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(
        `❌ ${operation}: Falha após ${Date.now() - startTime}ms - ${errorMsg}`
      );

      // Log de erro para auditoria
      await this.logEmailError(userData, operation, errorMsg);

      return {
        success: false,
        error: `Falha no email de boas-vindas: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Envia email de recuperação de senha
   * NOVO: Método para recuperação de senha com templates assíncronos
   *
   * @param userData - Dados do usuário
   * @param recoveryData - Dados de recuperação (token, link, etc.)
   * @returns Promise<ServiceResponse>
   */
  public async sendPasswordRecoveryEmail(
    userData: UserTemplateData,
    recoveryData: {
      token: string;
      linkRecuperacao: string;
      expiracaoMinutos: number;
      maxTentativas: number;
    }
  ): Promise<ServiceResponse> {
    const operation = "PASSWORD_RECOVERY";
    const startTime = Date.now();

    try {
      console.log(`🔐 ${operation}: Iniciando para ${userData.email}`);

      // Valida dados de entrada
      this.validateUserData(userData);

      // Prepara dados do template
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        linkRecuperacao: recoveryData.linkRecuperacao,
        token: recoveryData.token,
        expiracaoMinutos: recoveryData.expiracaoMinutos,
        maxTentativas: recoveryData.maxTentativas,
        frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        ano: new Date().getFullYear(),
      };

      // Gera conteúdo do email
      const emailContent = await this.generatePasswordRecoveryEmailContent(
        templateData
      );

      // Envia email
      const result = await this.sendEmailWithRetry(emailContent, userData.id);

      if (result.success) {
        await this.logEmailSuccess(userData, operation, result.messageId);
        console.log(`✅ ${operation}: Sucesso em ${Date.now() - startTime}ms`);
      }

      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error(
        `❌ ${operation}: Falha após ${Date.now() - startTime}ms - ${errorMsg}`
      );

      await this.logEmailError(userData, operation, errorMsg);

      return {
        success: false,
        error: `Falha no email de recuperação: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Envia email genérico
   * Método utilitário para outros tipos de email
   */
  public async sendEmail(emailData: EmailData): Promise<ServiceResponse> {
    try {
      this.validateEmailData(emailData);
      return await this.sendEmailWithRetry(emailData);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      return {
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Constrói dados do template de forma dinâmica
   * Implementa configuração baseada em ambiente
   */
  private buildWelcomeTemplateData(userData: UserTemplateData) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const currentYear = new Date().getFullYear();

    return {
      nomeCompleto: userData.nomeCompleto,
      tipoUsuario: this.formatUserType(userData.tipoUsuario),
      frontendUrl,
      ano: currentYear,
      // Dados dinâmicos adicionais
      plataforma: "AdvanceMais",
      dataRegistro: new Date().toLocaleDateString("pt-BR"),
      primeiroNome: userData.nomeCompleto.split(" ")[0],
      // URLs específicas baseadas no tipo de usuário
      dashboardUrl: this.buildDashboardUrl(userData.tipoUsuario, frontendUrl),
      supportUrl: `${frontendUrl}/suporte`,
      // Personalização por tipo de usuário
      recursosDisponiveis: this.getAvailableFeatures(userData.tipoUsuario),
      // Para compatibilidade com templates
      email: userData.email,
      userData: userData,
    };
  }

  /**
   * Gera conteúdo do email de boas-vindas com fallback seguro
   * CORREÇÃO: Método assíncrono para aguardar carregamento de templates
   */
  private async generateWelcomeEmailContent(
    templateData: any
  ): Promise<EmailData> {
    try {
      // CORREÇÃO: Aguarda carregamento assíncrono do template
      const htmlContent = await EmailTemplates.generateWelcomeTemplate(
        templateData
      );
      const textContent = EmailTemplates.generateWelcomeText(templateData);

      return {
        to: templateData.email || templateData.userData?.email,
        toName: templateData.nomeCompleto,
        subject: this.buildDynamicSubject(templateData),
        htmlContent,
        textContent,
        tags: ["welcome", "new-user", templateData.tipoUsuario?.toLowerCase()],
        headers: {
          "X-User-Type": templateData.tipoUsuario,
          "X-Email-Type": "welcome",
          "X-Platform": "AdvanceMais",
          "X-Priority": "1",
        },
      };
    } catch (error) {
      console.warn("⚠️ Falha no template externo, usando fallback", error);
      return this.generateFallbackWelcomeEmail(templateData);
    }
  }

  /**
   * Gera conteúdo do email de recuperação de senha
   * NOVO: Método para email de recuperação
   */
  private async generatePasswordRecoveryEmailContent(
    templateData: any
  ): Promise<EmailData> {
    try {
      const htmlContent = await EmailTemplates.generatePasswordRecoveryTemplate(
        templateData
      );
      const textContent =
        EmailTemplates.generatePasswordRecoveryText(templateData);

      return {
        to: templateData.email || templateData.userData?.email,
        toName: templateData.nomeCompleto,
        subject: `🔐 Recuperação de Senha - AdvanceMais`,
        htmlContent,
        textContent,
        tags: ["password-recovery", "security"],
        headers: {
          "X-Email-Type": "password-recovery",
          "X-Platform": "AdvanceMais",
          "X-Priority": "1",
        },
      };
    } catch (error) {
      console.warn(
        "⚠️ Falha no template de recuperação, usando fallback",
        error
      );
      return this.generateFallbackPasswordRecoveryEmail(templateData);
    }
  }

  /**
   * Constrói assunto dinâmico baseado no contexto
   */
  private buildDynamicSubject(templateData: any): string {
    const firstName =
      templateData.primeiroNome ||
      templateData.nomeCompleto?.split(" ")[0] ||
      "Usuário";
    const userType =
      templateData.tipoUsuario === "PESSOA_JURIDICA" ? "empresa" : "pessoa";

    return `🎉 Bem-vind${
      userType === "empresa" ? "a" : "o"
    }(a) ao AdvanceMais, ${firstName}!`;
  }

  /**
   * Envia email com retry inteligente
   * Implementa exponential backoff
   */
  private async sendEmailWithRetry(
    emailData: EmailData,
    userId?: string
  ): Promise<ServiceResponse> {
    let lastError: Error | null = null;
    const maxRetries = this.config.maxRetries || 3;

    // Verifica se serviço está saudável
    if (!(await this.isServiceHealthy())) {
      return {
        success: false,
        error: "Serviço de email indisponível",
        timestamp: new Date().toISOString(),
      };
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.performEmailSend(emailData);

        // Log tentativa bem-sucedida
        console.log(`✅ Email enviado na tentativa ${attempt}/${maxRetries}`);
        return result;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Erro desconhecido");

        console.warn(
          `⚠️ Tentativa ${attempt}/${maxRetries} falhou: ${lastError.message}`
        );

        // Se é erro de autorização, não tenta novamente
        if (this.isAuthError(lastError)) {
          break;
        }

        // Exponential backoff: espera progressivamente mais tempo
        if (attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.delay(delay);
        }
      }
    }

    return {
      success: false,
      error: `Email falhou após ${maxRetries} tentativas: ${lastError?.message}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verifica se o serviço está saudável
   */
  private async isServiceHealthy(): Promise<boolean> {
    try {
      const healthStatus = this.client.getHealthStatus();
      return healthStatus.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Calcula delay para retry com exponential backoff
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = this.config.retryDelay || 1000;
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Verifica se é erro de autorização
   */
  private isAuthError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("401") ||
      message.includes("unauthorized") ||
      message.includes("api key")
    );
  }

  /**
   * Executa envio do email via API Brevo
   */
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

  /**
   * Constrói URL do dashboard baseada no tipo de usuário
   */
  private buildDashboardUrl(userType: string, baseUrl: string): string {
    const routes = {
      PESSOA_FISICA: "/dashboard/aluno",
      PESSOA_JURIDICA: "/dashboard/empresa",
      ADMIN: "/dashboard/admin",
      MODERADOR: "/dashboard/moderador",
    };

    return `${baseUrl}${
      routes[userType as keyof typeof routes] || "/dashboard"
    }`;
  }

  /**
   * Retorna recursos disponíveis por tipo de usuário
   */
  private getAvailableFeatures(userType: string): string[] {
    const features = {
      PESSOA_FISICA: [
        "Acesso a cursos especializados",
        "Certificações reconhecidas",
        "Mentoria personalizada",
        "Networking profissional",
      ],
      PESSOA_JURIDICA: [
        "Gestão de equipes",
        "Relatórios corporativos",
        "Treinamentos customizados",
        "API de integração",
      ],
    };

    return (
      features[userType as keyof typeof features] || [
        "Acesso à plataforma",
        "Suporte técnico",
        "Recursos básicos",
      ]
    );
  }

  /**
   * Gera email de fallback em caso de erro no template
   */
  private generateFallbackWelcomeEmail(templateData: any): EmailData {
    const firstName = templateData.primeiroNome || "Usuário";

    return {
      to: templateData.email,
      toName: templateData.nomeCompleto,
      subject: `Bem-vindo(a) ao AdvanceMais, ${firstName}!`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4CAF50;">🎉 Bem-vindo(a) ao AdvanceMais!</h1>
          <p>Olá, <strong>${templateData.nomeCompleto}</strong>!</p>
          <p>Sua conta foi criada com sucesso em nossa plataforma.</p>
          <p>
            <a href="${templateData.frontendUrl}/login" 
               style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Acessar Plataforma
            </a>
          </p>
          <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
        </div>
      `,
      textContent: `
        Bem-vindo(a) ao AdvanceMais!
        
        Olá, ${templateData.nomeCompleto}!
        
        Sua conta foi criada com sucesso. Acesse: ${templateData.frontendUrl}/login
        
        Atenciosamente,
        Equipe AdvanceMais
      `,
      tags: ["welcome", "fallback"],
    };
  }

  /**
   * Gera email de fallback para recuperação de senha
   */
  private generateFallbackPasswordRecoveryEmail(templateData: any): EmailData {
    return {
      to: templateData.email,
      toName: templateData.nomeCompleto,
      subject: "🔐 Recuperação de Senha - AdvanceMais",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #ff9800;">🔐 Recuperação de Senha</h1>
          <p>Olá, <strong>${templateData.nomeCompleto}</strong>!</p>
          <p>Para recuperar sua senha, use o código: <strong>${templateData.token}</strong></p>
          <p>
            <a href="${templateData.linkRecuperacao}" 
               style="background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Redefinir Senha
            </a>
          </p>
          <p style="color: #d32f2f;"><strong>Válido por ${templateData.expiracaoMinutos} minutos!</strong></p>
          <p>Atenciosamente,<br><strong>Equipe AdvanceMais</strong></p>
        </div>
      `,
      textContent: `
        Recuperação de Senha - AdvanceMais
        
        Olá, ${templateData.nomeCompleto}!
        
        Para recuperar sua senha, use o código: ${templateData.token}
        Ou acesse: ${templateData.linkRecuperacao}
        
        Válido por ${templateData.expiracaoMinutos} minutos!
        
        Atenciosamente,
        Equipe AdvanceMais
      `,
      tags: ["password-recovery", "fallback"],
    };
  }

  /**
   * Métodos auxiliares para validação e logging
   */

  private validateUserData(userData: UserTemplateData): void {
    const required = ["id", "email", "nomeCompleto", "tipoUsuario"];
    const missing = required.filter(
      (field) => !userData[field as keyof UserTemplateData]
    );

    if (missing.length > 0) {
      throw new Error(`Dados obrigatórios ausentes: ${missing.join(", ")}`);
    }

    if (!this.isValidEmail(userData.email)) {
      throw new Error(`Email inválido: ${userData.email}`);
    }
  }

  private validateEmailData(emailData: EmailData): void {
    if (!emailData.to || !this.isValidEmail(emailData.to)) {
      throw new Error("Email do destinatário inválido");
    }
    if (!emailData.subject?.trim()) {
      throw new Error("Assunto obrigatório");
    }
    if (!emailData.htmlContent?.trim()) {
      throw new Error("Conteúdo HTML obrigatório");
    }
  }

  private buildBrevoEmail(emailData: EmailData): Brevo.SendSmtpEmail {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.to = [
      {
        email: emailData.to,
        name: emailData.toName || emailData.to,
      },
    ];

    sendSmtpEmail.sender = {
      email: this.config.fromEmail,
      name: this.config.fromName,
    };

    sendSmtpEmail.subject = emailData.subject;
    sendSmtpEmail.htmlContent = emailData.htmlContent;

    if (emailData.textContent) {
      sendSmtpEmail.textContent = emailData.textContent;
    }

    if (emailData.headers) {
      sendSmtpEmail.headers = emailData.headers;
    }

    if (emailData.tags?.length) {
      sendSmtpEmail.tags = emailData.tags;
    }

    return sendSmtpEmail;
  }

  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatUserType(userType: string): string {
    const types = {
      PESSOA_FISICA: "pessoa física",
      PESSOA_JURIDICA: "empresa",
      ADMIN: "administrador",
      MODERADOR: "moderador",
    };

    return types[userType as keyof typeof types] || "usuário";
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

      console.log(`✅ Flag de boas-vindas atualizada para usuário ${userId}`);
    } catch (error) {
      console.warn(`⚠️ Erro ao atualizar flag de boas-vindas:`, error);
    }
  }

  private async logEmailSuccess(
    userData: UserTemplateData,
    operation: string,
    messageId?: string
  ): Promise<void> {
    try {
      const emailType =
        operation === "WELCOME_EMAIL"
          ? EmailType.WELCOME
          : EmailType.PASSWORD_RECOVERY;

      await prisma.logEmail.create({
        data: {
          usuarioId: userData.id,
          email: userData.email,
          tipoEmail: emailType,
          status: SendStatus.SENT,
          tentativas: 1,
          messageId,
          erro: null,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log de sucesso:", error);
    }
  }

  private async logEmailError(
    userData: UserTemplateData,
    operation: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const emailType =
        operation === "WELCOME_EMAIL"
          ? EmailType.WELCOME
          : EmailType.PASSWORD_RECOVERY;

      await prisma.logEmail.create({
        data: {
          usuarioId: userData.id,
          email: userData.email,
          tipoEmail: emailType,
          status: SendStatus.FAILED,
          tentativas: this.config.maxRetries || 3,
          erro: errorMessage,
        },
      });
    } catch (error) {
      console.warn("⚠️ Erro ao registrar log de erro:", error);
    }
  }

  // Métodos públicos para health check e estatísticas

  public async checkConnectivity(): Promise<boolean> {
    return this.isServiceHealthy();
  }

  public async getStatistics(): Promise<any> {
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
        healthy: this.isInitialized,
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas:", error);
      return null;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

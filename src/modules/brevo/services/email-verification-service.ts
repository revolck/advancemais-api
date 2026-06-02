import * as Brevo from '@getbrevo/brevo';
import { BrevoClient } from '../client/brevo-client';
import { BrevoConfigManager } from '../config/brevo-config';
import { EmailTemplates } from '../templates/email-templates';
import { prisma } from '../../../config/prisma';
import { invalidateUserCache } from '../../usuarios/utils/cache';
import {
  UsuariosVerificacaoEmailSelect,
  normalizeEmailVerification,
} from '@/modules/usuarios/utils/email-verification';
import { logger } from '@/utils/logger';

/**
 * Serviço especializado em verificação de email
 * Implementa padrões de microserviços com alta disponibilidade
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
  deleted?: boolean;
}

export class EmailVerificationService {
  private client: BrevoClient;
  private config: BrevoConfigManager;
  private readonly log = logger.child({ module: 'EmailVerificationService' });

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
    const operation = 'EMAIL_VERIFICATION';
    const correlationId = this.generateCorrelationId();
    const log = this.log.child({
      correlationId,
      userId: userData.id,
      email: userData.email,
      method: 'sendVerificationEmail',
    });

    try {
      log.info('📧 Iniciando envio de verificação');

      // Valida se verificação está habilitada
      const runtimeConfig = await this.config.getRuntimeConfig();

      if (!runtimeConfig.UsuariosVerificacaoEmail.enabled) {
        log.info('ℹ️ Verificação de email desabilitada');
        return { success: true, simulated: true };
      }

      // Verifica se usuário já está verificado
      const usuario = await prisma.usuarios.findUnique({
        where: { id: userData.id },
        select: {
          email: true,
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }

      const verification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

      if (verification.emailVerificado) {
        log.info('ℹ️ Email já verificado');
        return { success: true, simulated: true };
      }

      // Verifica limite de tentativas de reenvio
      const canResend = await this.checkResendLimit(userData.id, correlationId);
      if (!canResend) {
        throw new Error('Limite de tentativas de reenvio atingido');
      }

      // Gera token de verificação
      const token = this.config.generateVerificationToken();
      const tokenExpiration = new Date(
        Date.now() + runtimeConfig.UsuariosVerificacaoEmail.tokenExpirationHours * 60 * 60 * 1000,
      );
      const verificationUrl = `${runtimeConfig.urls.verification}?token=${token}`;

      // Salva token no banco
      await this.saveVerificationToken(userData.id, token, tokenExpiration, correlationId);

      // Prepara dados do template
      const templateData = {
        nomeCompleto: userData.nomeCompleto,
        email: userData.email,
        tipoUsuario: userData.tipoUsuario,
        verificationUrl,
        token,
        expirationHours: runtimeConfig.UsuariosVerificacaoEmail.tokenExpirationHours,
        frontendUrl: runtimeConfig.urls.frontend,
      };

      // Gera email de verificação
      const emailContent = EmailTemplates.generateVerificationEmail(templateData);

      // Envia email
      const result = await this.performEmailSend(
        {
          to: userData.email,
          toName: userData.nomeCompleto,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        },
        correlationId,
      );

      // Registra resultado
      if (result.success) {
        await this.logVerificationEmailSuccess(
          userData.id,
          operation,
          result.messageId,
          correlationId,
        );
        log.info({ messageId: result.messageId }, '✅ Email de verificação enviado com sucesso');
      } else {
        await this.logVerificationEmailError(
          userData.id,
          operation,
          result.error || 'Erro desconhecido',
          correlationId,
        );
      }

      return {
        ...result,
        tokenExpiration,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      log.error({ error: errorMsg }, '❌ Erro no envio de verificação');
      await this.logVerificationEmailError(userData.id, operation, errorMsg, correlationId);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Reenvia email de verificação
   */
  public async resendVerificationEmail(email: string): Promise<EmailVerificationResult> {
    const correlationId = this.generateCorrelationId();
    const log = this.log.child({ correlationId, email, method: 'resendVerificationEmail' });

    try {
      log.info('🔄 Reenviando verificação');

      // Busca usuário
      const usuario = await prisma.usuarios.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          tipoUsuario: true,
          status: true,
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      if (!usuario) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      const verification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

      if (verification.emailVerificado) {
        return { success: false, error: 'Email já verificado' };
      }

      if (usuario.status === 'INATIVO') {
        return { success: false, error: 'Conta inativa' };
      }

      // Reenvia verificação
      return await this.sendVerificationEmail({
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      log.error({ error: errorMsg }, '❌ Erro no reenvio de verificação');
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verifica token de verificação
   */
  public async verifyEmailToken(token: string): Promise<VerificationTokenResult> {
    try {
      const log = this.log.child({
        method: 'verifyEmailToken',
        tokenPrefix: token.substring(0, 8),
      });
      log.info('🔍 Verificando token');

      const verification = await prisma.usuariosVerificacaoEmail.findFirst({
        where: { emailVerificationToken: token },
        include: {
          Usuarios: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
      });

      if (!verification || !verification.Usuarios) {
        return { valid: false, error: 'Token inválido' };
      }

      const normalized = normalizeEmailVerification(verification);

      if (normalized.emailVerificado) {
        return { valid: false, alreadyVerified: true, userId: verification.Usuarios.id };
      }

      if (
        normalized.emailVerificationTokenExp &&
        normalized.emailVerificationTokenExp < new Date()
      ) {
        await prisma.usuarios.delete({ where: { id: verification.usuarioId } });
        return {
          valid: false,
          expired: true,
          userId: verification.usuarioId,
          deleted: true,
        };
      }

      // Token válido - marca como verificado
      await prisma.$transaction([
        prisma.usuariosVerificacaoEmail.update({
          where: { usuarioId: verification.usuarioId },
          data: {
            emailVerificado: true,
            emailVerificadoEm: new Date(),
            emailVerificationToken: null,
            emailVerificationTokenExp: null,
          },
        }),
        prisma.usuarios.update({
          where: { id: verification.usuarioId },
          data: {
            status: 'ATIVO',
          },
        }),
      ]);

      await invalidateUserCache({ id: verification.usuarioId });

      log.info({ userId: verification.usuarioId }, '✅ Email verificado com sucesso');
      return { valid: true, userId: verification.usuarioId };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      this.log.error({ error: errorMsg }, '❌ Erro na verificação de token');
      return { valid: false, error: errorMsg };
    }
  }

  // ===========================
  // MÉTODOS PRIVADOS
  // ===========================

  /**
   * Verifica limite de reenvio
   */
  private async checkResendLimit(userId: string, correlationId: string): Promise<boolean> {
    try {
      const config = this.config.getConfig();
      const cooldownMinutes = config.UsuariosVerificacaoEmail.resendCooldownMinutes;
      const maxAttempts = config.UsuariosVerificacaoEmail.maxResendAttempts;

      const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);

      const recentAttempts = await prisma.logEmail.count({
        where: {
          usuarioId: userId,
          tipoEmail: 'VERIFICACAO_EMAIL',
          criadoEm: { gte: since },
        },
      });

      const canResend = recentAttempts < maxAttempts;

      if (!canResend) {
        this.log.warn(
          {
            correlationId,
            userId,
            recentAttempts,
            maxAttempts,
          },
          '⚠️ Limite de reenvio atingido',
        );
      }

      return canResend;
    } catch (error) {
      this.log.warn(
        { correlationId, userId, err: error },
        '⚠️ Erro ao verificar limite de reenvio',
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
    correlationId: string,
  ): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.usuariosVerificacaoEmail.upsert({
          where: { usuarioId: userId },
          update: {
            emailVerificado: false,
            emailVerificationToken: token,
            emailVerificationTokenExp: expiration,
            emailVerificationAttempts: { increment: 1 },
            ultimaTentativaVerificacao: new Date(),
          },
          create: {
            usuarioId: userId,
            emailVerificado: false,
            emailVerificationToken: token,
            emailVerificationTokenExp: expiration,
            emailVerificationAttempts: 1,
            ultimaTentativaVerificacao: new Date(),
          },
        }),
        prisma.usuarios.update({
          where: { id: userId },
          data: { status: 'PENDENTE' },
        }),
      ]);

      await invalidateUserCache({ id: userId });

      this.log.info({ correlationId, userId }, '💾 Token de verificação salvo');
    } catch (error) {
      this.log.error({ correlationId, userId, err: error }, '❌ Erro ao salvar token');
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
    correlationId: string,
  ): Promise<EmailVerificationResult> {
    // Modo simulado
    if (this.client.isSimulated()) {
      this.log.info({ correlationId, email: emailData.to }, '🎭 Email de verificação simulado');
      return {
        success: true,
        messageId: `sim_verify_${Date.now()}`,
        simulated: true,
      };
    }

    // Envio real
    try {
      const config = this.config.getConfig();

      const emailAPI = this.client.getEmailAPI();
      if (!emailAPI) {
        throw new Error('API de email não disponível');
      }

      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.to = [{ email: emailData.to, name: emailData.toName }];
      sendSmtpEmail.sender = { email: config.fromEmail, name: config.fromName };
      sendSmtpEmail.subject = emailData.subject;
      sendSmtpEmail.htmlContent = emailData.html;
      sendSmtpEmail.textContent = emailData.text;

      const response = await emailAPI.sendTransacEmail(sendSmtpEmail);
      const messageId = this.extractMessageId(response);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.log.error(
        { correlationId, err: error, email: emailData.to },
        '❌ Erro no envio via Brevo',
      );

      // Fallback para simulação
      this.log.warn({ correlationId, email: emailData.to }, '🎭 Fallback para modo simulado');
      return {
        success: true,
        messageId: `fallback_verify_${Date.now()}`,
        simulated: true,
      };
    }
  }

  /**
   * Extrai message ID da resposta
   */
  private extractMessageId(response: any): string {
    if (response?.messageId) return String(response.messageId);
    if (response?.body?.messageId) return String(response.body.messageId);
    return `brevo_verify_${Date.now()}`;
  }

  /**
   * Log de sucesso
   */
  private async logVerificationEmailSuccess(
    userId: string,
    operation: string,
    messageId?: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: '',
          tipoEmail: operation as any,
          status: 'ENVIADO',
          messageId: messageId || '',
          tentativas: 1,
        },
      });
    } catch (error) {
      this.log.warn(
        { correlationId, userId, operation, err: error },
        '⚠️ Erro ao registrar log de sucesso',
      );
    }
  }

  /**
   * Log de erro
   */
  private async logVerificationEmailError(
    userId: string,
    operation: string,
    error: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      await prisma.logEmail.create({
        data: {
          usuarioId: userId,
          email: '',
          tipoEmail: operation as any,
          status: 'FALHA',
          erro: error,
          tentativas: 1,
        },
      });
    } catch (logError) {
      this.log.warn(
        { correlationId, userId, operation, err: logError },
        '⚠️ Erro ao registrar log de erro',
      );
    }
  }

  /**
   * Gera correlation ID
   */
  private generateCorrelationId(): string {
    return `verify-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
}

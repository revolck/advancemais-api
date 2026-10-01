import { Request, Response } from 'express';
import { EmailService } from '../services/email-service';
import { prisma } from '../../../config/prisma';
import { EmailConfigManager } from '../config/email-config';
import { logger } from '../../../utils/logger';
import {
  UsuariosVerificacaoEmailSelect,
  normalizeEmailVerification,
} from '@/modules/usuarios/utils/email-verification';

/**
 * Controller para verificação de email
 * Endpoints simples e seguros para confirmar email dos usuários
 */
export class EmailVerificationController {
  private emailService: EmailService;
  private config: EmailConfigManager;

  constructor() {
    this.emailService = new EmailService();
    this.config = EmailConfigManager.getInstance();
  }

  private getLogger(req: Request) {
    return logger.child({
      controller: 'EmailVerificationController',
      correlationId: req.id,
    });
  }

  /**
   * Verifica token de verificação de email
   * GET /verificar-email?token=xxx
   */
  public verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const { token } = req.query;

      // Validação do token
      if (!token || typeof token !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Token de verificação é obrigatório',
          code: 'MISSING_TOKEN',
        });
        return;
      }

      log.info({ tokenPrefix: token.substring(0, 8) }, '🔍 Verificando token');

      // Verifica o token
      const result = await this.emailService.verifyEmailToken(token);

      if (result.valid) {
        log.info({ userId: result.userId }, '✅ Email verificado com sucesso');

        const redirectUrl = this.config.getConfig().urls.frontend;
        res.json({
          success: true,
          message: 'Email verificado com sucesso',
          redirectUrl,
          userId: result.userId,
        });
        return;
      }

      // Trata diferentes tipos de erro
      if (result.alreadyVerified) {
        res.status(400).json({
          success: false,
          message: 'Este email já foi verificado anteriormente.',
          code: 'ALREADY_VERIFIED',
          userId: result.userId,
        });
        return;
      }

      if (result.expired) {
        res.status(400).json({
          success: false,
          message:
            'Token de verificação expirado. Seu cadastro foi removido. Por favor, realize um novo cadastro.',
          code: 'TOKEN_EXPIRED',
          userId: result.userId,
          deleted: result.deleted,
        });
        return;
      }

      // Token inválido
      res.status(400).json({
        success: false,
        message: result.error || 'Token de verificação inválido',
        code: 'INVALID_TOKEN',
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro na verificação de email');
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Reenvia email de verificação
   * POST /reenviar-verificacao
   * Body: { email: string }
   */
  public resendVerification = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const { email } = req.body;

      // Validação do email
      if (!email || typeof email !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Email é obrigatório',
          code: 'MISSING_EMAIL',
        });
        return;
      }

      if (!this.isValidEmail(email)) {
        res.status(400).json({
          success: false,
          message: 'Formato de email inválido',
          code: 'INVALID_EMAIL',
        });
        return;
      }

      log.info({ email }, '🔄 Reenviando verificação');

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
        res.status(404).json({
          success: false,
          message: 'Usuário não encontrado com este email',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      const verification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

      if (verification.emailVerificado) {
        res.status(400).json({
          success: false,
          message: 'Este email já foi verificado',
          code: 'ALREADY_VERIFIED',
        });
        return;
      }

      if (usuario.status === 'INATIVO') {
        res.status(403).json({
          success: false,
          message: 'Conta inativa. Entre em contato com o suporte',
          code: 'ACCOUNT_INACTIVE',
        });
        return;
      }

      // Reenvia email de verificação
      const result = await this.emailService.sendWelcomeEmail({
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
      });

      if (result.success) {
        const message = result.simulated
          ? 'Email de verificação reenviado (simulado para desenvolvimento)'
          : 'Email de verificação reenviado com sucesso. Verifique sua caixa de entrada';

        res.json({
          success: true,
          message,
          simulated: result.simulated,
          messageId: result.messageId,
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || 'Erro ao reenviar email de verificação',
          code: 'SEND_ERROR',
        });
      }
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao reenviar verificação');
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Status de verificação de um usuário
   * GET /status-verificacao/:userId
   */
  public getVerificationStatus = async (req: Request, res: Response): Promise<void> => {
    const log = this.getLogger(req);
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'ID do usuário é obrigatório',
          code: 'MISSING_USER_ID',
        });
        return;
      }

      const usuario = await prisma.usuarios.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
          UsuariosVerificacaoEmail: {
            select: UsuariosVerificacaoEmailSelect,
          },
        },
      });

      if (!usuario) {
        res.status(404).json({
          success: false,
          message: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      const verification = normalizeEmailVerification(usuario.UsuariosVerificacaoEmail);

      const hasValidToken = verification.emailVerificationTokenExp
        ? verification.emailVerificationTokenExp > new Date()
        : false;

      res.json({
        success: true,
        data: {
          userId: usuario.id,
          email: usuario.email,
          emailVerified: verification.emailVerificado,
          accountStatus: usuario.status,
          hasValidToken,
          tokenExpiration: verification.emailVerificationTokenExp,
          UsuariosVerificacaoEmail: {
            verified: verification.emailVerificado,
            verifiedAt: verification.emailVerificadoEm,
            tokenExpiration: verification.emailVerificationTokenExp,
            attempts: verification.emailVerificationAttempts,
            lastAttemptAt: verification.ultimaTentativaVerificacao,
          },
        },
      });
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao buscar status de verificação');
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  /**
   * Método com nome alternativo para manter compatibilidade
   */
  public checkVerificationStatus = this.getVerificationStatus;

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

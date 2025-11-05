import { Request, Response, NextFunction } from 'express';
import { EmailVerificationService } from '../services/email-verification-service';
import { logger } from '@/utils/logger';

/**
 * Middleware robusto para envio de email de verificação
 * Implementa padrões de microserviços com execução assíncrona
 *
 * Responsabilidades:
 * - Enviar email de verificação de forma não-bloqueante
 * - Nunca falhar o processo de registro
 * - Logs detalhados para observabilidade
 * - Validação rigorosa de dados
 * - Execução em background
 */
export class EmailVerificationMiddleware {
  private UsuariosVerificacaoEmailService: EmailVerificationService;
  private readonly log = logger.child({ module: 'EmailVerificationMiddleware' });

  constructor() {
    this.UsuariosVerificacaoEmailService = new EmailVerificationService();
  }

  /**
   * Middleware principal - execução assíncrona robusta
   */
  public sendVerificationEmail = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const rawCorrelationId = req.headers['x-correlation-id'];
    const correlationId: string = Array.isArray(rawCorrelationId)
      ? rawCorrelationId[0] || 'unknown'
      : rawCorrelationId || 'unknown';
    const log = this.log.child({ correlationId, method: 'sendVerificationEmail' });

    try {
      log.info('📧 EmailVerificationMiddleware: Iniciando processamento');

      // Extrai dados do usuário
      const userData = this.extractUserData(res, correlationId);

      if (userData) {
        log.info({ email: userData.email }, '📧 Dados extraídos para verificação');

        // Execução completamente assíncrona sem await
        this.processVerificationEmailAsync(userData, correlationId);

        log.info({ email: userData.email }, '📧 Email de verificação agendado');
      } else {
        log.warn('⚠️ Dados insuficientes para email de verificação');
      }
    } catch (error) {
      log.error({ err: error }, '❌ Erro no middleware de verificação');
      // Nunca falha o fluxo principal
    }

    // SEMPRE continua o fluxo
    next();
  };

  /**
   * Extrai dados do usuário de forma segura
   */
  private extractUserData(res: Response, correlationId: string): any {
    const log = this.log.child({ correlationId, method: 'extractUserData' });
    try {
      log.info('🔍 Extraindo dados do res.locals para verificação');

      if (!res.locals?.UsuariosCriado?.Usuarios) {
        log.warn('⚠️ res.locals.UsuariosCriado.Usuarios não existe');
        return null;
      }

      const userData = res.locals.UsuariosCriado.Usuarios;

      // Validação rigorosa
      const requiredFields = ['id', 'email', 'nomeCompleto', 'tipoUsuario'];
      const missingFields = requiredFields.filter((field) => !userData[field]);

      if (missingFields.length > 0) {
        log.warn({ missingFields }, '⚠️ Campos obrigatórios ausentes para verificação');
        return null;
      }

      // Validação de email
      if (!this.isValidEmail(userData.email)) {
        log.warn({ email: userData.email }, '⚠️ Email inválido para verificação');
        return null;
      }

      const processedData = {
        id: userData.id,
        email: userData.email.toLowerCase().trim(),
        nomeCompleto: userData.nomeCompleto.trim(),
        tipoUsuario: userData.tipoUsuario,
      };

      log.info(
        {
          id: processedData.id,
          email: processedData.email,
          nomeCompleto: processedData.nomeCompleto,
          tipoUsuario: processedData.tipoUsuario,
        },
        '✅ Dados válidos extraídos para verificação',
      );

      return processedData;
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao extrair dados para verificação');
      return null;
    }
  }

  /**
   * Processa email de verificação de forma completamente assíncrona
   */
  private processVerificationEmailAsync(userData: any, correlationId: string): void {
    const log = this.log.child({ correlationId, method: 'processVerificationEmailAsync' });
    // Usa setImmediate para execução assíncrona garantida
    setImmediate(async () => {
      try {
        log.info({ email: userData.email }, '📧 Iniciando envio assíncrono de verificação');

        const startTime = Date.now();
        const result = await this.UsuariosVerificacaoEmailService.sendVerificationEmail(userData);
        const duration = Date.now() - startTime;

        if (result.success) {
          if (result.simulated) {
            log.info({ email: userData.email, duration }, '🎭 Email de verificação simulado');
          } else {
            log.info({ email: userData.email, duration }, '✅ Email de verificação enviado');
            log.info(
              { email: userData.email, messageId: result.messageId },
              '📧 Message ID registrado',
            );
            log.info(
              {
                email: userData.email,
                tokenExpiration: result.tokenExpiration,
              },
              '⏰ Token de verificação registrado',
            );
          }
        } else {
          log.error(
            { email: userData.email, error: result.error },
            '❌ Falha no email de verificação',
          );
        }
      } catch (error) {
        log.error(
          {
            email: userData.email,
            err: error,
          },
          '❌ Erro crítico no email de verificação',
        );
      }
    });
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Factory method para criação do middleware
   */
  public static create() {
    const factoryLogger = logger.child({ module: 'EmailVerificationMiddlewareFactory' });
    factoryLogger.info('🏭 EmailVerificationMiddleware: Criando instância do middleware');
    const instance = new EmailVerificationMiddleware();
    return instance.sendVerificationEmail;
  }
}

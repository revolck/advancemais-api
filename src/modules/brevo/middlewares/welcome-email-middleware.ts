import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email-service';
import { logger } from '@/utils/logger';

/**
 * Middleware simplificado e robusto para envio de email de boas-vindas
 *
 * Características:
 * - Execução assíncrona não-bloqueante
 * - Nunca falha o processo de registro
 * - Logs detalhados para debugging
 * - Validação rigorosa de dados
 * - Compatível com sistema de verificação de email
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;
  private readonly log = logger.child({ module: 'WelcomeEmailMiddleware' });

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal - simples e eficiente
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    _next: NextFunction,
  ): Promise<void> => {
    const correlationId = this.getCorrelationId(req);
    const log = this.log.child({ correlationId, method: 'sendWelcomeEmail' });

    try {
      log.info('📧 WelcomeEmailMiddleware: Iniciando processamento');

      // Extrai dados do usuário criado
      const userData = this.extractUserData(res, correlationId);

      if (userData) {
        log.info({ email: userData.email }, '📧 Dados válidos extraídos');

        // Executa envio de email de forma assíncrona (não bloqueia resposta)
        this.processEmailAsync(userData, correlationId);

        log.info({ email: userData.email }, '📧 Email agendado para envio');
      } else {
        log.warn(
          { resLocalsKeys: Object.keys(res.locals || {}) },
          '⚠️ Dados insuficientes para envio de email',
        );
      }
    } catch (error) {
      log.error({ err: error }, '❌ Erro no middleware de email');
      // Nunca falha o fluxo principal
    }

    // Não chamamos next() pois a resposta já foi enviada pelo controller
    // e continuar a cadeia resultaria em 404 ou erros de headers enviados
  };

  /**
   * Extrai dados do usuário de forma segura
   */
  private extractUserData(res: Response, correlationId: string): any {
    const log = this.log.child({ correlationId, method: 'extractUserData' });
    try {
      log.info('🔍 Extraindo dados do res.locals');

      // Verifica se res.locals existe
      if (!res.locals) {
        log.warn('⚠️ res.locals não existe');
        return null;
      }

      // Verifica se usuarioCriado existe
      if (!res.locals.usuarioCriado) {
        log.warn('⚠️ res.locals.usuarioCriado não existe');
        return null;
      }

      const usuarioCriado = res.locals.usuarioCriado;

      // Verifica se dados do usuário existem
      if (!usuarioCriado.usuario) {
        log.warn('⚠️ res.locals.usuarioCriado.usuario não existe');
        return null;
      }

      const userData = usuarioCriado.usuario;

      // Validação dos campos obrigatórios
      const requiredFields = ['id', 'email', 'nomeCompleto', 'tipoUsuario'];
      const missingFields = requiredFields.filter((field) => !userData[field]);

      if (missingFields.length > 0) {
        log.warn({ missingFields }, '⚠️ Campos obrigatórios ausentes');
        return null;
      }

      // Validação de email
      if (!this.isValidEmail(userData.email)) {
        log.warn({ email: userData.email }, '⚠️ Email inválido');
        return null;
      }

      // Dados processados e validados
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
        '✅ Dados válidos extraídos',
      );

      return processedData;
    } catch (error) {
      log.error({ err: error }, '❌ Erro ao extrair dados');
      return null;
    }
  }

  /**
   * Processa email de forma completamente assíncrona
   */
  private processEmailAsync(userData: any, correlationId: string): void {
    const log = this.log.child({ correlationId, method: 'processEmailAsync' });
    // Executa em background sem bloquear
    setImmediate(async () => {
      try {
        log.info({ email: userData.email }, '📧 Iniciando envio assíncrono');

        const startTime = Date.now();
        const result = await this.emailService.sendWelcomeEmail(userData);
        const duration = Date.now() - startTime;

        if (result.success) {
          if (result.simulated) {
            log.info({ email: userData.email, duration }, '🎭 Email simulado enviado');
          } else {
            log.info({ email: userData.email, duration }, '✅ Email enviado com sucesso');
            if (result.messageId) {
              log.info(
                { email: userData.email, messageId: result.messageId },
                '📧 Message ID registrado',
              );
            }
          }
        } else {
          log.error({ email: userData.email, error: result.error }, '❌ Falha no envio de email');
        }
      } catch (error) {
        log.error(
          {
            email: userData.email,
            err: error,
          },
          '❌ Erro crítico no envio assíncrono',
        );
      }
    });
  }

  /**
   * Obtém correlation ID do request
   */
  private getCorrelationId(req: Request): string {
    const rawCorrelationId = req.headers['x-correlation-id'];
    return Array.isArray(rawCorrelationId)
      ? rawCorrelationId[0] || 'unknown'
      : rawCorrelationId || 'unknown';
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Factory method para uso nas rotas
   */
  public static create() {
    const factoryLogger = logger.child({ module: 'WelcomeEmailMiddlewareFactory' });
    factoryLogger.info('🏭 WelcomeEmailMiddleware: Criando instância do middleware');
    const instance = new WelcomeEmailMiddleware();
    return instance.sendWelcomeEmail;
  }
}

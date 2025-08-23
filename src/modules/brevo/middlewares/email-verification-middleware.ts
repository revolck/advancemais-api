import { Request, Response, NextFunction } from "express";
import { EmailVerificationService } from "../services/email-verification-service";

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
 *
 * @author Sistema Advance+
 * @version 6.0.0 - Sistema completo de verificação
 */
export class EmailVerificationMiddleware {
  private emailVerificationService: EmailVerificationService;

  constructor() {
    this.emailVerificationService = new EmailVerificationService();
  }

  /**
   * Middleware principal - execução assíncrona robusta
   */
  public sendVerificationEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const rawCorrelationId = req.headers["x-correlation-id"];
    const correlationId: string = Array.isArray(rawCorrelationId)
      ? rawCorrelationId[0] || "unknown"
      : rawCorrelationId || "unknown";

    try {
      console.log(
        `📧 [${correlationId}] EmailVerificationMiddleware: Iniciando processamento`
      );

      // Extrai dados do usuário
      const userData = this.extractUserData(res, correlationId);

      if (userData) {
        console.log(
          `📧 [${correlationId}] Dados extraídos para verificação: ${userData.email}`
        );

        // Execução completamente assíncrona sem await
        this.processVerificationEmailAsync(userData, correlationId);

        console.log(
          `📧 [${correlationId}] Email de verificação agendado para: ${userData.email}`
        );
      } else {
        console.warn(
          `⚠️ [${correlationId}] Dados insuficientes para email de verificação`
        );
      }
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro no middleware de verificação:`,
        error
      );
      // Nunca falha o fluxo principal
    }

    // SEMPRE continua o fluxo
    next();
  };

  /**
   * Extrai dados do usuário de forma segura
   */
  private extractUserData(res: Response, correlationId: string): any {
    try {
      console.log(
        `🔍 [${correlationId}] Extraindo dados do res.locals para verificação`
      );

      if (!res.locals?.usuarioCriado?.usuario) {
        console.warn(
          `⚠️ [${correlationId}] res.locals.usuarioCriado.usuario não existe`
        );
        return null;
      }

      const userData = res.locals.usuarioCriado.usuario;

      // Validação rigorosa
      const requiredFields = ["id", "email", "nomeCompleto", "tipoUsuario"];
      const missingFields = requiredFields.filter((field) => !userData[field]);

      if (missingFields.length > 0) {
        console.warn(
          `⚠️ [${correlationId}] Campos obrigatórios ausentes para verificação:`,
          missingFields
        );
        return null;
      }

      // Validação de email
      if (!this.isValidEmail(userData.email)) {
        console.warn(
          `⚠️ [${correlationId}] Email inválido para verificação: ${userData.email}`
        );
        return null;
      }

      const processedData = {
        id: userData.id,
        email: userData.email.toLowerCase().trim(),
        nomeCompleto: userData.nomeCompleto.trim(),
        tipoUsuario: userData.tipoUsuario,
      };

      console.log(
        `✅ [${correlationId}] Dados válidos extraídos para verificação:`,
        {
          id: processedData.id,
          email: processedData.email,
          nomeCompleto: processedData.nomeCompleto,
          tipoUsuario: processedData.tipoUsuario,
        }
      );

      return processedData;
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro ao extrair dados para verificação:`,
        error
      );
      return null;
    }
  }

  /**
   * Processa email de verificação de forma completamente assíncrona
   */
  private processVerificationEmailAsync(
    userData: any,
    correlationId: string
  ): void {
    // Usa setImmediate para execução assíncrona garantida
    setImmediate(async () => {
      try {
        console.log(
          `📧 [${correlationId}] Iniciando envio assíncrono de verificação para: ${userData.email}`
        );

        const startTime = Date.now();
        const result =
          await this.emailVerificationService.sendVerificationEmail(userData);
        const duration = Date.now() - startTime;

        if (result.success) {
          if (result.simulated) {
            console.log(
              `🎭 [${correlationId}] Email de verificação simulado: ${userData.email} (${duration}ms)`
            );
          } else {
            console.log(
              `✅ [${correlationId}] Email de verificação enviado: ${userData.email} (${duration}ms)`
            );
            console.log(
              `📧 [${correlationId}] Message ID: ${result.messageId}`
            );
            console.log(
              `⏰ [${correlationId}] Token expira em: ${result.tokenExpiration}`
            );
          }
        } else {
          console.error(
            `❌ [${correlationId}] Falha no email de verificação para ${userData.email}: ${result.error}`
          );
        }
      } catch (error) {
        console.error(
          `❌ [${correlationId}] Erro crítico no email de verificação para ${userData.email}:`,
          error instanceof Error ? error.message : error
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
    console.log(
      "🏭 EmailVerificationMiddleware: Criando instância do middleware"
    );
    const instance = new EmailVerificationMiddleware();
    return instance.sendVerificationEmail;
  }
}

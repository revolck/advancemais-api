import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";

/**
 * Middleware simplificado e robusto para envio de email de boas-vindas
 *
 * Características:
 * - Execução assíncrona não-bloqueante
 * - Nunca falha o processo de registro
 * - Logs detalhados para debugging
 * - Validação rigorosa de dados
 * - Compatível com sistema de verificação de email
 *
 * @author Sistema Advance+
 * @version 7.0.0 - Simplificação completa
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal - simples e eficiente
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> => {
    const correlationId = this.getCorrelationId(req);

    try {
      console.log(
        `📧 [${correlationId}] WelcomeEmailMiddleware: Iniciando processamento`
      );

      // Extrai dados do usuário criado
      const userData = this.extractUserData(res, correlationId);

      if (userData) {
        console.log(
          `📧 [${correlationId}] Dados válidos extraídos para: ${userData.email}`
        );

        // Executa envio de email de forma assíncrona (não bloqueia resposta)
        this.processEmailAsync(userData, correlationId);

        console.log(
          `📧 [${correlationId}] Email agendado para envio: ${userData.email}`
        );
      } else {
        console.warn(
          `⚠️ [${correlationId}] Dados insuficientes para envio de email`
        );
        console.warn(
          `⚠️ [${correlationId}] res.locals keys:`,
          Object.keys(res.locals || {})
        );
      }
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro no middleware de email:`,
        error
      );
      // Nunca falha o fluxo principal
    }

    // Não chamamos next() pois a resposta já foi enviada pelo controller
    // e continuar a cadeia resultaria em 404 ou erros de headers enviados
  };

  /**
   * Extrai dados do usuário de forma segura
   */
  private extractUserData(res: Response, correlationId: string): any {
    try {
      console.log(`🔍 [${correlationId}] Extraindo dados do res.locals`);

      // Verifica se res.locals existe
      if (!res.locals) {
        console.warn(`⚠️ [${correlationId}] res.locals não existe`);
        return null;
      }

      // Verifica se usuarioCriado existe
      if (!res.locals.usuarioCriado) {
        console.warn(
          `⚠️ [${correlationId}] res.locals.usuarioCriado não existe`
        );
        return null;
      }

      const usuarioCriado = res.locals.usuarioCriado;

      // Verifica se dados do usuário existem
      if (!usuarioCriado.usuario) {
        console.warn(
          `⚠️ [${correlationId}] res.locals.usuarioCriado.usuario não existe`
        );
        return null;
      }

      const userData = usuarioCriado.usuario;

      // Validação dos campos obrigatórios
      const requiredFields = ["id", "email", "nomeCompleto", "tipoUsuario"];
      const missingFields = requiredFields.filter((field) => !userData[field]);

      if (missingFields.length > 0) {
        console.warn(
          `⚠️ [${correlationId}] Campos obrigatórios ausentes:`,
          missingFields
        );
        return null;
      }

      // Validação de email
      if (!this.isValidEmail(userData.email)) {
        console.warn(`⚠️ [${correlationId}] Email inválido: ${userData.email}`);
        return null;
      }

      // Dados processados e validados
      const processedData = {
        id: userData.id,
        email: userData.email.toLowerCase().trim(),
        nomeCompleto: userData.nomeCompleto.trim(),
        tipoUsuario: userData.tipoUsuario,
      };

      console.log(`✅ [${correlationId}] Dados válidos extraídos:`, {
        id: processedData.id,
        email: processedData.email,
        nomeCompleto: processedData.nomeCompleto,
        tipoUsuario: processedData.tipoUsuario,
      });

      return processedData;
    } catch (error) {
      console.error(`❌ [${correlationId}] Erro ao extrair dados:`, error);
      return null;
    }
  }

  /**
   * Processa email de forma completamente assíncrona
   */
  private processEmailAsync(userData: any, correlationId: string): void {
    // Executa em background sem bloquear
    setImmediate(async () => {
      try {
        console.log(
          `📧 [${correlationId}] Iniciando envio assíncrono para: ${userData.email}`
        );

        const startTime = Date.now();
        const result = await this.emailService.sendWelcomeEmail(userData);
        const duration = Date.now() - startTime;

        if (result.success) {
          if (result.simulated) {
            console.log(
              `🎭 [${correlationId}] Email simulado enviado para: ${userData.email} (${duration}ms)`
            );
          } else {
            console.log(
              `✅ [${correlationId}] Email enviado com sucesso para: ${userData.email} (${duration}ms)`
            );
            if (result.messageId) {
              console.log(
                `📧 [${correlationId}] Message ID: ${result.messageId}`
              );
            }
          }
        } else {
          console.error(
            `❌ [${correlationId}] Falha no envio para ${userData.email}: ${result.error}`
          );
        }
      } catch (error) {
        console.error(
          `❌ [${correlationId}] Erro crítico no envio assíncrono para ${userData.email}:`,
          error instanceof Error ? error.message : error
        );
      }
    });
  }

  /**
   * Obtém correlation ID do request
   */
  private getCorrelationId(req: Request): string {
    const rawCorrelationId = req.headers["x-correlation-id"];
    return Array.isArray(rawCorrelationId)
      ? rawCorrelationId[0] || "unknown"
      : rawCorrelationId || "unknown";
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
    console.log("🏭 WelcomeEmailMiddleware: Criando instância do middleware");
    const instance = new WelcomeEmailMiddleware();
    return instance.sendWelcomeEmail;
  }
}

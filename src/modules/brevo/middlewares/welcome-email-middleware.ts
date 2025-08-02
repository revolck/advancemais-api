import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";

/**
 * Middleware robusto para envio de email de boas-vindas
 *
 * Responsabilidades:
 * - Enviar email de forma assíncrona e não-bloqueante
 * - Nunca falhar o processo de registro
 * - Logs detalhados para debugging
 * - Validação rigorosa de dados
 *
 * @author Sistema AdvanceMais
 * @version 5.0.2 - Correção de tipagem TypeScript
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal - robusto e com logs detalhados
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // CORREÇÃO: Garantir que correlationId seja sempre string
    const rawCorrelationId = req.headers["x-correlation-id"];
    const correlationId: string = Array.isArray(rawCorrelationId)
      ? rawCorrelationId[0] || "unknown"
      : rawCorrelationId || "unknown";

    try {
      console.log(
        `📧 [${correlationId}] WelcomeEmailMiddleware: Iniciando processamento`
      );

      // Verifica se a resposta já foi enviada
      if (res.headersSent) {
        console.log(
          `📧 [${correlationId}] Headers já enviados, processando email em background`
        );
      }

      // Extrai dados do usuário
      const userData = this.extractUserData(res, correlationId);

      if (userData) {
        console.log(
          `📧 [${correlationId}] Dados extraídos com sucesso para: ${userData.email}`
        );

        // Execução assíncrona sem await para não bloquear
        this.processEmailAsync(userData, correlationId);

        console.log(
          `📧 [${correlationId}] Email de boas-vindas agendado para: ${userData.email}`
        );
      } else {
        console.warn(
          `⚠️ [${correlationId}] Dados insuficientes para email de boas-vindas`
        );
        console.warn(
          `⚠️ [${correlationId}] res.locals disponível:`,
          Object.keys(res.locals)
        );
      }
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro no middleware de email:`,
        error
      );
      // Nunca falha o fluxo principal
    }

    // SEMPRE continua o fluxo, mesmo se houver erro
    next();
  };

  /**
   * Extrai dados do usuário de forma segura com logs detalhados
   */
  private extractUserData(res: Response, correlationId: string): any {
    try {
      console.log(`🔍 [${correlationId}] Extraindo dados do res.locals`);

      if (!res.locals) {
        console.warn(`⚠️ [${correlationId}] res.locals não existe`);
        return null;
      }

      if (!res.locals.usuarioCriado) {
        console.warn(
          `⚠️ [${correlationId}] res.locals.usuarioCriado não existe`
        );
        console.log(
          `🔍 [${correlationId}] res.locals keys:`,
          Object.keys(res.locals)
        );
        return null;
      }

      const usuarioCriado = res.locals.usuarioCriado;
      console.log(`🔍 [${correlationId}] usuarioCriado encontrado:`, {
        hasUsuario: !!usuarioCriado.usuario,
        source: usuarioCriado.source,
        emailShouldBeSent: usuarioCriado.emailShouldBeSent,
      });

      const userData = usuarioCriado.usuario;

      if (!userData) {
        console.warn(`⚠️ [${correlationId}] usuarioCriado.usuario não existe`);
        return null;
      }

      // Validação rigorosa dos campos obrigatórios
      const requiredFields = ["id", "email", "nomeCompleto"];
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

      const processedData = {
        id: userData.id,
        email: userData.email.toLowerCase().trim(),
        nomeCompleto: userData.nomeCompleto.trim(),
        tipoUsuario: userData.tipoUsuario || "PESSOA_FISICA",
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
   * Processa email de forma completamente assíncrona com logs detalhados
   */
  private processEmailAsync(userData: any, correlationId: string): void {
    // Usa setImmediate para garantir execução assíncrona
    setImmediate(async () => {
      try {
        console.log(
          `📧 [${correlationId}] Iniciando envio assíncrono de email para: ${userData.email}`
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
              `✅ [${correlationId}] Email de boas-vindas enviado: ${userData.email} (${duration}ms)`
            );
            console.log(
              `📧 [${correlationId}] Message ID: ${result.messageId}`
            );
          }
        } else {
          console.error(
            `❌ [${correlationId}] Falha no email para ${userData.email}: ${result.error}`
          );
        }
      } catch (error) {
        console.error(
          `❌ [${correlationId}] Erro crítico no email assíncrono para ${userData.email}:`,
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
   * Factory method com logs aprimorados
   */
  public static create() {
    console.log("🏭 WelcomeEmailMiddleware: Criando instância do middleware");
    const instance = new WelcomeEmailMiddleware();
    return instance.sendWelcomeEmail;
  }
}

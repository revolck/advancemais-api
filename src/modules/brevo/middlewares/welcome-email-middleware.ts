import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";

/**
 * Middleware simplificado para envio de email de boas-vindas
 *
 * Responsabilidades:
 * - Enviar email de forma assíncrona e não-bloqueante
 * - Nunca falhar o processo de registro
 * - Logs simples e eficazes
 *
 * @author Sistema AdvanceMais
 * @version 5.0.0 - Simplificação total
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal - simples e eficaz
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // NUNCA bloqueia o fluxo principal
    const userData = this.extractUserData(res);

    if (userData) {
      // Execução assíncrona sem await
      this.processEmailAsync(userData);
      console.log(`📧 Email de boas-vindas agendado para: ${userData.email}`);
    } else {
      console.warn("⚠️ Dados insuficientes para email de boas-vindas");
    }

    // Sempre continua o fluxo
    next();
  };

  /**
   * Extrai dados do usuário de forma segura
   */
  private extractUserData(res: Response): any {
    try {
      const userData = res.locals.usuarioCriado?.usuario;

      if (!userData?.id || !userData?.email || !userData?.nomeCompleto) {
        return null;
      }

      return {
        id: userData.id,
        email: userData.email,
        nomeCompleto: userData.nomeCompleto,
        tipoUsuario: userData.tipoUsuario || "PESSOA_FISICA",
      };
    } catch {
      return null;
    }
  }

  /**
   * Processa email de forma completamente assíncrona
   */
  private processEmailAsync(userData: any): void {
    setImmediate(async () => {
      try {
        const result = await this.emailService.sendWelcomeEmail(userData);

        if (result.success) {
          if (result.simulated) {
            console.log(`🎭 Email simulado enviado para: ${userData.email}`);
          } else {
            console.log(`✅ Email de boas-vindas enviado: ${userData.email}`);
          }
        } else {
          console.error(`❌ Falha no email: ${result.error}`);
        }
      } catch (error) {
        console.error(
          `❌ Erro crítico no email: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    });
  }

  /**
   * Factory method simplificado
   */
  public static create() {
    const instance = new WelcomeEmailMiddleware();
    return instance.sendWelcomeEmail;
  }
}

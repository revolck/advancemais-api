import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";
import { UserTemplateData } from "../types/interfaces";

/**
 * Middleware para envio automático de email de boas-vindas
 * Execução assíncrona sem bloqueio da resposta
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userData = this.extractUserData(res);

      if (!userData) {
        console.warn("⚠️ Dados insuficientes para email de boas-vindas");
        return next();
      }

      console.log(`📧 Agendando email de boas-vindas para: ${userData.email}`);

      // Executa de forma assíncrona sem bloquear a resposta
      setImmediate(() => {
        this.processWelcomeEmailAsync(userData);
      });

      next();
    } catch (error) {
      console.error("❌ Erro no middleware de boas-vindas:", error);
      next(); // Não bloqueia em caso de erro
    }
  };

  /**
   * Extrai dados do usuário da resposta
   */
  private extractUserData(res: Response): UserTemplateData | null {
    try {
      const responseData = res.locals.usuarioCriado;

      if (!responseData?.usuario) {
        return null;
      }

      const usuario = responseData.usuario;

      // Valida campos obrigatórios
      const requiredFields = ["id", "email", "nomeCompleto", "tipoUsuario"];
      for (const field of requiredFields) {
        if (!usuario[field]) {
          console.warn(`❌ Campo obrigatório ausente: ${field}`);
          return null;
        }
      }

      // Valida email
      if (!this.isValidEmail(usuario.email)) {
        console.warn(`❌ Email inválido: ${usuario.email}`);
        return null;
      }

      return {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
      };
    } catch (error) {
      console.error("❌ Erro ao extrair dados do usuário:", error);
      return null;
    }
  }

  /**
   * Processa envio de email de forma assíncrona
   */
  private async processWelcomeEmailAsync(
    userData: UserTemplateData
  ): Promise<void> {
    try {
      console.log(`📤 Enviando email de boas-vindas para: ${userData.email}`);

      const result = await this.emailService.sendWelcomeEmail(userData);

      if (result.success) {
        console.log(`✅ Email de boas-vindas enviado para: ${userData.email}`);
      } else {
        console.error(
          `❌ Falha no email de boas-vindas para: ${userData.email}`,
          result.error
        );
      }
    } catch (error) {
      console.error("❌ Erro no processamento assíncrono:", error);
    }
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Factory method para criar middleware
   */
  public static create(): (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void> {
    const instance = new WelcomeEmailMiddleware();
    return instance.sendWelcomeEmail;
  }
}

import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";

/**
 * Middleware para envio automático de email de boas-vindas
 * Deve ser usado após a criação bem-sucedida de usuários
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware que envia email de boas-vindas para novos usuários
   * @param req - Request com dados do usuário criado
   * @param res - Response
   * @param next - Next function
   */
  public enviarEmailBoasVindas = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Verifica se há dados de usuário criado na resposta
      const responseBody = res.locals.usuarioCriado;

      if (!responseBody || !responseBody.usuario) {
        console.warn("Middleware de email: Dados de usuário não encontrados");
        return next();
      }

      const usuario = responseBody.usuario;

      // Envia email de boas-vindas de forma assíncrona para não bloquear a resposta
      setImmediate(async () => {
        try {
          console.log(`Enviando email de boas-vindas para: ${usuario.email}`);

          const result = await this.emailService.enviarEmailBoasVindas({
            id: usuario.id,
            email: usuario.email,
            nomeCompleto: usuario.nomeCompleto,
            tipoUsuario: usuario.tipoUsuario,
          });

          if (result.success) {
            console.log(
              `✅ Email de boas-vindas enviado com sucesso para: ${usuario.email}`
            );
          } else {
            console.error(
              `❌ Erro ao enviar email de boas-vindas para ${usuario.email}:`,
              result.error
            );
          }
        } catch (error) {
          console.error(
            "Erro crítico no envio de email de boas-vindas:",
            error
          );
        }
      });

      next();
    } catch (error) {
      console.error("Erro no middleware de email de boas-vindas:", error);
      // Não bloqueia o fluxo principal em caso de erro
      next();
    }
  };

  /**
   * Função estática para fácil uso
   * @returns Middleware function
   */
  public static create() {
    const instance = new WelcomeEmailMiddleware();
    return instance.enviarEmailBoasVindas;
  }
}

import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";

/**
 * Interface para dados do usuário criado
 */
interface UsuarioCriado {
  usuario: {
    id: string;
    email: string;
    nomeCompleto: string;
    tipoUsuario: string;
    status?: string;
    criadoEm?: Date;
  };
}

/**
 * Middleware para envio automático de email de boas-vindas
 *
 * Funcionalidades:
 * - Envio automático após criação de usuário
 * - Execução assíncrona (não bloqueia resposta)
 * - Tratamento robusto de erros
 * - Sistema de retry automático
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;
  private maxRetries: number;
  private retryDelay: number;

  /**
   * Construtor - inicializa serviço de email e configurações
   */
  constructor(maxRetries: number = 2, retryDelay: number = 1000) {
    this.emailService = new EmailService();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Middleware principal para envio de email de boas-vindas
   * Processa de forma assíncrona sem bloquear a response
   */
  public enviarEmailBoasVindas = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const responseBody: UsuarioCriado = res.locals.usuarioCriado;

      // Valida dados do usuário
      if (!this.validarDadosUsuario(responseBody)) {
        console.warn("⚠️ Dados insuficientes para envio de email");
        return next();
      }

      const usuario = responseBody.usuario;
      console.log(`📤 Iniciando envio de email para: ${usuario.email}`);

      // Processa envio de forma assíncrona
      setImmediate(() => {
        this.processarEnvioAssincrono(usuario);
      });

      // Continua fluxo imediatamente
      next();
    } catch (error) {
      console.error("❌ Erro no middleware de email:", error);
      next(); // Não bloqueia em caso de erro
    }
  };

  /**
   * Processa envio de email com retry automático
   */
  private async processarEnvioAssincrono(
    usuario: UsuarioCriado["usuario"]
  ): Promise<void> {
    let tentativa = 0;
    let ultimoErro: Error | null = null;

    while (tentativa <= this.maxRetries) {
      try {
        tentativa++;

        const dadosEmail = {
          id: usuario.id,
          email: usuario.email,
          nomeCompleto: usuario.nomeCompleto,
          tipoUsuario: usuario.tipoUsuario,
        };

        const resultado = await this.emailService.enviarEmailBoasVindas(
          dadosEmail
        );

        if (resultado.success) {
          console.log(`✅ Email enviado para: ${usuario.email}`);
          await this.registrarMetrica(usuario.id, "SUCCESS", tentativa);
          return;
        } else {
          ultimoErro = new Error(resultado.error || "Erro no envio");
        }
      } catch (error) {
        ultimoErro =
          error instanceof Error ? error : new Error("Erro desconhecido");
      }

      // Aguarda antes de retry (exceto na última tentativa)
      if (tentativa <= this.maxRetries) {
        await this.delay(this.retryDelay);
      }
    }

    // Registra falha final
    console.error(`💥 Falha no envio para: ${usuario.email}`);
    await this.registrarMetrica(
      usuario.id,
      "FAILED",
      tentativa - 1,
      ultimoErro?.message
    );
  }

  /**
   * Valida dados obrigatórios do usuário
   */
  private validarDadosUsuario(responseBody: UsuarioCriado): boolean {
    if (!responseBody?.usuario) return false;

    const usuario = responseBody.usuario;
    const camposObrigatorios = ["id", "email", "nomeCompleto", "tipoUsuario"];

    for (const campo of camposObrigatorios) {
      if (!usuario[campo as keyof typeof usuario]) {
        console.warn(`❌ Campo ausente: ${campo}`);
        return false;
      }
    }

    // Valida email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(usuario.email)) {
      console.warn(`❌ Email inválido: ${usuario.email}`);
      return false;
    }

    return true;
  }

  /**
   * Implementa delay assíncrono
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Registra métricas de envio
   */
  private async registrarMetrica(
    usuarioId: string,
    status: "SUCCESS" | "FAILED",
    tentativas: number,
    erro?: string
  ): Promise<void> {
    try {
      console.log(
        `📊 Métrica: ${usuarioId} - ${status} (${tentativas} tentativas)`
      );
      // Implementar persistência conforme necessário
    } catch (error) {
      console.error("⚠️ Erro ao registrar métrica:", error);
    }
  }

  /**
   * Factory method para criação da instância
   */
  public static create(maxRetries?: number, retryDelay?: number) {
    const instance = new WelcomeEmailMiddleware(maxRetries, retryDelay);
    return instance.enviarEmailBoasVindas;
  }

  /**
   * Endpoint de teste para desenvolvimento
   *
   * CORREÇÃO: Agora retorna Promise<Response> ao invés de void
   */
  public static testeEnvio = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const { email, nomeCompleto, tipoUsuario } = req.body;

      // Validação de campos obrigatórios
      if (!email || !nomeCompleto) {
        return res.status(400).json({
          message: "Campos obrigatórios para teste: email, nomeCompleto",
        });
      }

      // Simula dados de usuário para teste
      res.locals.usuarioCriado = {
        usuario: {
          id: `test-${Date.now()}`,
          email,
          nomeCompleto,
          tipoUsuario: tipoUsuario || "PESSOA_FISICA",
          status: "ATIVO",
        },
      };

      console.log(`🧪 Teste de envio iniciado para: ${email}`);

      // Executa middleware de envio
      const middleware = WelcomeEmailMiddleware.create();
      await middleware(req, res, next);

      // Não retorna response aqui, pois next() já foi chamado
    } catch (error) {
      console.error("❌ Erro no teste:", error);
      return res.status(500).json({
        message: "Erro no teste de envio",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Testa conectividade do serviço
   */
  public async testarConectividade(): Promise<boolean> {
    try {
      return await this.emailService.testarConectividade();
    } catch {
      return false;
    }
  }
}

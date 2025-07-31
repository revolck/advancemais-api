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
 * Funcionalidades principais:
 * - Envio automático após criação de usuário
 * - Execução assíncrona para não bloquear resposta
 * - Tratamento robusto de erros
 * - Logs detalhados para monitoramento
 * - Validação de dados antes do envio
 * - Retry automático em caso de falha temporária
 *
 * Como usar:
 * 1. Adicione este middleware APÓS o controller de criação de usuário
 * 2. Certifique-se de que res.locals.usuarioCriado contenha os dados do usuário
 * 3. O middleware não interrompe o fluxo em caso de erro
 *
 * Exemplo:
 * router.post("/registrar", criarUsuario, WelcomeEmailMiddleware.create());
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;
  private maxRetries: number;
  private retryDelay: number;

  /**
   * Construtor da classe
   * Inicializa o serviço de email e configurações de retry
   *
   * @param {number} [maxRetries=2] - Número máximo de tentativas
   * @param {number} [retryDelay=1000] - Delay entre tentativas em ms
   */
  constructor(maxRetries: number = 2, retryDelay: number = 1000) {
    this.emailService = new EmailService();
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;

    console.log(
      `📧 WelcomeEmailMiddleware inicializado - Retry: ${maxRetries}x com delay de ${retryDelay}ms`
    );
  }

  /**
   * Middleware principal que processa o envio de email de boas-vindas
   *
   * Fluxo de execução:
   * 1. Verifica se há dados de usuário criado
   * 2. Valida dados obrigatórios
   * 3. Inicia envio assíncrono (não bloqueia resposta)
   * 4. Continua o fluxo da requisição
   *
   * @param {Request} req - Request do Express
   * @param {Response} res - Response do Express com dados em res.locals
   * @param {NextFunction} next - Função next do Express
   */
  public enviarEmailBoasVindas = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      console.log("📬 Middleware de email de boas-vindas ativado");

      // Extrai dados do usuário criado da resposta
      const responseBody: UsuarioCriado = res.locals.usuarioCriado;

      // Verifica se os dados estão disponíveis
      if (!this.validarDadosUsuario(responseBody)) {
        console.warn(
          "⚠️ Dados de usuário insuficientes para envio de email - continuando sem envio"
        );
        return next();
      }

      const usuario = responseBody.usuario;

      // Log da tentativa com dados sanitizados
      console.log(
        `📤 Iniciando envio de email de boas-vindas para: ${usuario.email} (ID: ${usuario.id})`
      );

      // Envia email de forma assíncrona para não bloquear a resposta
      // Usa setImmediate para garantir que next() seja chamado primeiro
      setImmediate(() => {
        this.processarEnvioAssincrono(usuario);
      });

      // Continua o fluxo da requisição imediatamente
      next();
    } catch (error) {
      console.error(
        "❌ Erro crítico no middleware de email de boas-vindas:",
        error
      );

      // Em caso de erro crítico, ainda assim continua o fluxo
      // O email de boas-vindas não deve impedir o sucesso do cadastro
      next();
    }
  };

  /**
   * Processa o envio de email de forma assíncrona
   * Implementa retry automático e logs detalhados
   *
   * @param {UsuarioCriado['usuario']} usuario - Dados do usuário
   */
  private async processarEnvioAssincrono(
    usuario: UsuarioCriado["usuario"]
  ): Promise<void> {
    let tentativa = 0;
    let ultimoErro: Error | null = null;

    while (tentativa <= this.maxRetries) {
      try {
        tentativa++;

        console.log(
          `📧 Tentativa ${tentativa}/${this.maxRetries + 1} de envio para: ${
            usuario.email
          }`
        );

        // Prepara dados para o serviço de email
        const dadosEmail = {
          id: usuario.id,
          email: usuario.email,
          nomeCompleto: usuario.nomeCompleto,
          tipoUsuario: usuario.tipoUsuario,
        };

        // Envia o email
        const resultado = await this.emailService.enviarEmailBoasVindas(
          dadosEmail
        );

        if (resultado.success) {
          console.log(
            `✅ Email de boas-vindas enviado com sucesso para: ${usuario.email}`
          );
          console.log(`📊 MessageID: ${resultado.messageId || "N/A"}`);

          // Registra métricas de sucesso (se implementado)
          await this.registrarMetricaEnvio(usuario.id, "SUCCESS", tentativa);

          return; // Sucesso - sai da função
        } else {
          ultimoErro = new Error(
            resultado.error || "Erro desconhecido no envio"
          );
          console.error(
            `❌ Tentativa ${tentativa} falhou para ${usuario.email}:`,
            resultado.error
          );
        }
      } catch (error) {
        ultimoErro =
          error instanceof Error ? error : new Error("Erro desconhecido");
        console.error(
          `❌ Tentativa ${tentativa} falhou com exceção:`,
          ultimoErro.message
        );
      }

      // Se não é a última tentativa, aguarda antes de tentar novamente
      if (tentativa <= this.maxRetries) {
        console.log(
          `⏳ Aguardando ${this.retryDelay}ms antes da próxima tentativa...`
        );
        await this.delay(this.retryDelay);
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    console.error(
      `💥 Todas as tentativas de envio falharam para: ${usuario.email}`
    );
    console.error(`🔍 Último erro:`, ultimoErro?.message);

    // Registra falha final
    await this.registrarMetricaEnvio(
      usuario.id,
      "FAILED",
      tentativa - 1,
      ultimoErro?.message
    );

    // Aqui você pode implementar notificação para administradores
    await this.notificarFalhaEnvio(usuario, ultimoErro);
  }

  /**
   * Valida se os dados do usuário são suficientes para envio
   *
   * @param {UsuarioCriado} responseBody - Dados recebidos do response
   * @returns {boolean} true se dados são válidos
   */
  private validarDadosUsuario(responseBody: UsuarioCriado): boolean {
    if (!responseBody || !responseBody.usuario) {
      console.warn("❌ res.locals.usuarioCriado não encontrado");
      return false;
    }

    const usuario = responseBody.usuario;

    // Valida campos obrigatórios
    const camposObrigatorios = ["id", "email", "nomeCompleto", "tipoUsuario"];
    for (const campo of camposObrigatorios) {
      if (!usuario[campo as keyof typeof usuario]) {
        console.warn(`❌ Campo obrigatório ausente: ${campo}`);
        return false;
      }
    }

    // Valida formato de email
    if (!this.validarEmail(usuario.email)) {
      console.warn(`❌ Email inválido: ${usuario.email}`);
      return false;
    }

    // Verifica se o usuário não está em status que impede o envio
    if (usuario.status && !["ATIVO", "PENDENTE"].includes(usuario.status)) {
      console.warn(`❌ Status do usuário impede envio: ${usuario.status}`);
      return false;
    }

    return true;
  }

  /**
   * Valida formato de email
   *
   * @param {string} email - Email para validação
   * @returns {boolean} true se válido
   */
  private validarEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Implementa delay assíncrono
   *
   * @param {number} ms - Milissegundos para aguardar
   * @returns {Promise<void>} Promise que resolve após o delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Registra métricas de envio para monitoramento
   *
   * @param {string} usuarioId - ID do usuário
   * @param {string} status - Status do envio
   * @param {number} tentativas - Número de tentativas
   * @param {string} [erro] - Mensagem de erro se houver
   */
  private async registrarMetricaEnvio(
    usuarioId: string,
    status: "SUCCESS" | "FAILED",
    tentativas: number,
    erro?: string
  ): Promise<void> {
    try {
      // Implementar registro de métricas conforme sua estrutura
      // Pode ser no banco de dados, sistema de logs, ou serviço de métricas
      console.log(
        `📊 Métrica registrada - Usuário: ${usuarioId}, Status: ${status}, Tentativas: ${tentativas}`
      );

      // Exemplo de implementação:
      /*
      await prisma.emailMetrics.create({
        data: {
          usuarioId,
          tipoEmail: 'BOAS_VINDAS',
          status,
          tentativas,
          erro,
          timestamp: new Date()
        }
      });
      */
    } catch (error) {
      console.error("⚠️ Erro ao registrar métrica de envio:", error);
      // Não falha o processo se não conseguir registrar métrica
    }
  }

  /**
   * Notifica administradores sobre falhas críticas
   *
   * @param {UsuarioCriado['usuario']} usuario - Dados do usuário
   * @param {Error|null} erro - Erro que causou a falha
   */
  private async notificarFalhaEnvio(
    usuario: UsuarioCriado["usuario"],
    erro: Error | null
  ): Promise<void> {
    try {
      // Implementar notificação para administradores
      // Pode ser email, Slack, webhook, etc.

      console.log(
        `🚨 Notificação de falha crítica - Usuário: ${usuario.email}`
      );

      // Exemplo de implementação:
      /*
      const admins = await prisma.usuario.findMany({
        where: { role: 'ADMIN' },
        select: { email: true }
      });

      for (const admin of admins) {
        await this.emailService.enviarEmail({
          to: admin.email,
          subject: 'Falha crítica no envio de email de boas-vindas',
          htmlContent: `
            <h2>Falha no Email de Boas-vindas</h2>
            <p><strong>Usuário:</strong> ${usuario.email}</p>
            <p><strong>ID:</strong> ${usuario.id}</p>
            <p><strong>Erro:</strong> ${erro?.message || 'Desconhecido'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          `
        });
      }
      */
    } catch (error) {
      console.error("⚠️ Erro ao notificar falha de envio:", error);
    }
  }

  /**
   * Método estático para fácil criação e uso
   * Permite configuração personalizada sem instanciar a classe manualmente
   *
   * @param {number} [maxRetries=2] - Número máximo de tentativas
   * @param {number} [retryDelay=1000] - Delay entre tentativas
   * @returns {Function} Middleware function pronta para uso
   */
  public static create(maxRetries?: number, retryDelay?: number) {
    const instance = new WelcomeEmailMiddleware(maxRetries, retryDelay);
    return instance.enviarEmailBoasVindas;
  }

  /**
   * Middleware para teste (desenvolvimento)
   * Permite testar o envio de email sem criar usuário real
   *
   * @param {Request} req - Request contendo dados de teste em req.body
   * @param {Response} res - Response
   * @param {NextFunction} next - Next function
   */
  public static testeEnvio = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { email, nomeCompleto, tipoUsuario } = req.body;

      if (!email || !nomeCompleto) {
        return res.status(400).json({
          message: "Campos obrigatórios para teste: email, nomeCompleto",
        });
      }

      // Simula dados de usuário criado
      res.locals.usuarioCriado = {
        usuario: {
          id: `test-${Date.now()}`,
          email,
          nomeCompleto,
          tipoUsuario: tipoUsuario || "PESSOA_FISICA",
          status: "ATIVO",
        },
      };

      console.log(`🧪 Teste de envio de email iniciado para: ${email}`);

      const middleware = WelcomeEmailMiddleware.create();
      await middleware(req, res, next);
    } catch (error) {
      console.error("❌ Erro no teste de envio:", error);
      res.status(500).json({
        message: "Erro no teste de envio",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  /**
   * Obtém estatísticas do middleware
   * Útil para monitoramento e dashboard
   *
   * @returns {Promise<Object>} Estatísticas de envio
   */
  public async obterEstatisticas(): Promise<{
    totalEnvios: number;
    sucessos: number;
    falhas: number;
    taxaSucesso: number;
  }> {
    try {
      // Implementar coleta de estatísticas
      // Este é um exemplo - adapte conforme sua estrutura

      return {
        totalEnvios: 0,
        sucessos: 0,
        falhas: 0,
        taxaSucesso: 0,
      };
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas:", error);
      return {
        totalEnvios: 0,
        sucessos: 0,
        falhas: 0,
        taxaSucesso: 0,
      };
    }
  }

  /**
   * Testa conectividade do serviço de email
   *
   * @returns {Promise<boolean>} true se conectado
   */
  public async testarConectividade(): Promise<boolean> {
    try {
      return await this.emailService.testarConectividade();
    } catch (error) {
      console.error("❌ Erro no teste de conectividade:", error);
      return false;
    }
  }
}

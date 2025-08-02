import { Request, Response, NextFunction } from "express";
import { EmailService } from "../services/email-service";
import { UserTemplateData } from "../types/interfaces";

/**
 * Middleware para envio automático de email de boas-vindas
 * Implementa padrões de microserviços para resiliência e observabilidade
 *
 * Características:
 * - Execução assíncrona não-bloqueante
 * - Circuit breaker para falhas
 * - Logs estruturados para observabilidade
 * - Fallback gracioso em caso de erro
 * - Validação robusta de dados
 *
 * @author Sistema AdvanceMais
 * @version 4.0.1 - Correção de tipos TypeScript
 */
export class WelcomeEmailMiddleware {
  private emailService: EmailService;
  private isCircuitOpen: boolean = false;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  // Configurações do Circuit Breaker
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 300000; // 5 minutos
  private readonly EXECUTION_TIMEOUT = 30000; // 30 segundos

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Middleware principal para envio de email de boas-vindas
   * Implementa padrão não-bloqueante para não impactar o registro
   *
   * @param req - Request object
   * @param res - Response object
   * @param next - Next function
   */
  public sendWelcomeEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = this.generateCorrelationId();

    try {
      // Extrai dados do usuário da resposta
      const userData = this.extractUserData(res, correlationId);

      if (!userData) {
        console.warn(
          `⚠️ [${correlationId}] Dados insuficientes para email de boas-vindas`
        );
        return next();
      }

      // Verifica circuit breaker
      if (this.isCircuitOpen) {
        if (this.shouldTryRecovery()) {
          console.log(
            `🔄 [${correlationId}] Tentando recuperação do circuit breaker`
          );
          this.resetCircuitBreaker();
        } else {
          console.warn(
            `⚠️ [${correlationId}] Circuit breaker aberto - email não enviado`
          );
          return next();
        }
      }

      console.log(
        `📧 [${correlationId}] Agendando email de boas-vindas para: ${userData.email}`
      );

      // Executa de forma assíncrona com timeout
      this.scheduleAsyncEmailSend(userData, correlationId);

      // Continue o fluxo sem aguardar o email
      next();
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro no middleware de boas-vindas:`,
        error
      );
      // Nunca quebra o fluxo de registro, mesmo com erro
      next();
    }
  };

  /**
   * Agenda envio assíncrono de email com controle de timeout
   * Implementa isolamento de falhas para não afetar o registro
   *
   * @param userData - Dados do usuário
   * @param correlationId - ID de correlação para rastreamento
   */
  private scheduleAsyncEmailSend(
    userData: UserTemplateData,
    correlationId: string
  ): void {
    // Usa setImmediate para execução na próxima iteração do event loop
    setImmediate(async () => {
      const startTime = Date.now();

      try {
        // Implementa timeout para evitar processos hanging
        const emailPromise = this.emailService.sendWelcomeEmail(userData);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Email timeout")),
            this.EXECUTION_TIMEOUT
          )
        );

        const result = (await Promise.race([
          emailPromise,
          timeoutPromise,
        ])) as any;
        const duration = Date.now() - startTime;

        if (result.success) {
          console.log(
            `✅ [${correlationId}] Email de boas-vindas enviado com sucesso em ${duration}ms`
          );
          this.recordSuccess();
        } else {
          console.error(
            `❌ [${correlationId}] Falha no email de boas-vindas: ${result.error}`
          );
          this.recordFailure();
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMsg =
          error instanceof Error ? error.message : "Erro desconhecido";

        console.error(
          `❌ [${correlationId}] Erro crítico no email após ${duration}ms: ${errorMsg}`
        );
        this.recordFailure();

        // Em ambiente de desenvolvimento, pode ser útil ver o stack trace
        if (process.env.NODE_ENV === "development") {
          console.error(`📋 [${correlationId}] Stack trace:`, error);
        }
      }
    });
  }

  /**
   * Extrai e valida dados do usuário da resposta
   * Implementa validação robusta com logs estruturados
   *
   * @param res - Response object
   * @param correlationId - ID de correlação
   * @returns UserTemplateData ou null se inválido
   */
  private extractUserData(
    res: Response,
    correlationId: string
  ): UserTemplateData | null {
    try {
      const responseData = res.locals.usuarioCriado;

      if (!responseData?.usuario) {
        console.warn(
          `⚠️ [${correlationId}] res.locals.usuarioCriado não encontrado`
        );
        return null;
      }

      const usuario = responseData.usuario;

      // Validação de campos obrigatórios com logs específicos
      const requiredFields = [
        { field: "id", value: usuario.id },
        { field: "email", value: usuario.email },
        { field: "nomeCompleto", value: usuario.nomeCompleto },
        { field: "tipoUsuario", value: usuario.tipoUsuario },
      ];

      for (const { field, value } of requiredFields) {
        if (!value) {
          console.warn(
            `❌ [${correlationId}] Campo obrigatório ausente: ${field}`
          );
          return null;
        }
      }

      // Validação específica de email
      if (!this.isValidEmail(usuario.email)) {
        console.warn(`❌ [${correlationId}] Email inválido: ${usuario.email}`);
        return null;
      }

      // Validação de tipo de usuário
      if (!this.isValidUserType(usuario.tipoUsuario)) {
        console.warn(
          `❌ [${correlationId}] Tipo de usuário inválido: ${usuario.tipoUsuario}`
        );
        return null;
      }

      console.log(
        `✅ [${correlationId}] Dados do usuário validados com sucesso`
      );

      return {
        id: usuario.id,
        email: usuario.email.toLowerCase().trim(),
        nomeCompleto: usuario.nomeCompleto.trim(),
        tipoUsuario: usuario.tipoUsuario,
      };
    } catch (error) {
      console.error(
        `❌ [${correlationId}] Erro ao extrair dados do usuário:`,
        error
      );
      return null;
    }
  }

  /**
   * Registra sucesso para circuit breaker
   */
  private recordSuccess(): void {
    if (this.failureCount > 0) {
      console.log(`✅ Resetando contador de falhas (era ${this.failureCount})`);
      this.failureCount = 0;
      this.isCircuitOpen = false;
    }
  }

  /**
   * Registra falha para circuit breaker
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    console.warn(
      `⚠️ Falha registrada (${this.failureCount}/${this.FAILURE_THRESHOLD})`
    );

    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.isCircuitOpen = true;
      console.error(
        `🔴 Circuit breaker aberto após ${this.failureCount} falhas`
      );
    }
  }

  /**
   * Verifica se deve tentar recuperação do circuit breaker
   */
  private shouldTryRecovery(): boolean {
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.RECOVERY_TIMEOUT;
  }

  /**
   * Reseta circuit breaker para tentativa de recuperação
   */
  private resetCircuitBreaker(): void {
    this.isCircuitOpen = false;
    this.failureCount = 0;
    console.log(`🟢 Circuit breaker resetado para recuperação`);
  }

  /**
   * Gera ID de correlação único para rastreamento
   * Útil para logs distribuídos e debugging
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `email-${timestamp}-${random}`;
  }

  /**
   * Valida formato de email
   * Implementa regex robusto para validação
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
  }

  /**
   * Valida tipo de usuário
   */
  private isValidUserType(userType: string): boolean {
    const validTypes = [
      "PESSOA_FISICA",
      "PESSOA_JURIDICA",
      "ADMIN",
      "MODERADOR",
    ];
    return validTypes.includes(userType);
  }

  /**
   * Obtém estatísticas do middleware para monitoramento
   */
  public getHealthMetrics() {
    return {
      isCircuitOpen: this.isCircuitOpen,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime
        ? Date.now() - this.lastFailureTime
        : null,
      status: this.isCircuitOpen ? "degraded" : "healthy",
    };
  }

  /**
   * Factory method para criar middleware com logs de inicialização
   * Implementa padrão de instanciação segura
   *
   * CORREÇÃO: Retorna função que sempre retorna Promise<void>
   */
  public static create(): (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void> {
    try {
      const instance = new WelcomeEmailMiddleware();

      console.log("✅ WelcomeEmailMiddleware: Instância criada com sucesso");

      // Retorna função bound para manter contexto - SEMPRE async
      return async (
        req: Request,
        res: Response,
        next: NextFunction
      ): Promise<void> => {
        return instance.sendWelcomeEmail(req, res, next);
      };
    } catch (error) {
      console.error(
        "❌ WelcomeEmailMiddleware: Erro na criação da instância:",
        error
      );

      // Retorna middleware que não faz nada em caso de erro crítico - SEMPRE async
      return async (
        req: Request,
        res: Response,
        next: NextFunction
      ): Promise<void> => {
        console.warn(
          "⚠️ WelcomeEmailMiddleware: Instância degradada - pulando envio"
        );
        next();
      };
    }
  }

  /**
   * Endpoint para health check do middleware (útil para monitoring)
   */
  public static healthCheck(): {
    status: string;
    timestamp: string;
    version: string;
  } {
    return {
      status: "operational",
      timestamp: new Date().toISOString(),
      version: "4.0.1",
    };
  }
}

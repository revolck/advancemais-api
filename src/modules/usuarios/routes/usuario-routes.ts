import { Router } from "express";
import { criarUsuario } from "../register";
import {
  loginUsuario,
  logoutUsuario,
  refreshToken,
  obterPerfil,
} from "../controllers";
import { authMiddleware } from "../middlewares";
import { supabaseAuthMiddleware } from "../auth";
import { WelcomeEmailMiddleware } from "../../brevo/middlewares/welcome-email-middleware";
import passwordRecoveryRoutes from "./password-recovery";

/**
 * Rotas básicas de usuário - CRUD e autenticação
 * Implementa padrões de microserviços com tratamento robusto
 *
 * Características:
 * - Middleware de email não-bloqueante
 * - Logs estruturados para auditoria
 * - Validação de entrada robusta
 * - Tratamento de erro gracioso
 * - Rate limiting inteligente
 *
 * @author Sistema AdvanceMais
 * @version 4.0.0 - Refatoração para microserviços
 */
const router = Router();

// =============================================
// MIDDLEWARES GLOBAIS DE MONITORAMENTO
// =============================================

/**
 * Middleware de logging para todas as rotas de usuário
 * Implementa observabilidade para microserviços
 */
router.use((req, res, next) => {
  const startTime = Date.now();
  const correlationId =
    req.headers["x-correlation-id"] ||
    `user-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  // Adiciona correlation ID ao request para rastreamento
  req.headers["x-correlation-id"] = correlationId;

  console.log(`🌐 [${correlationId}] ${req.method} ${req.path} - Iniciado`);

  // Override do res.json para capturar tempo de resposta
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    console.log(
      `📤 [${correlationId}] ${req.method} ${req.path} - ${res.statusCode} em ${duration}ms`
    );
    return originalJson.call(this, data);
  };

  next();
});

/**
 * Rate limiting específico para rotas de autenticação
 * Implementa proteção contra brute force
 */
const authRateLimit = (maxRequests: number = 5, windowMinutes: number = 15) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: any, next: any) => {
    const clientId = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Limpa entradas expiradas
    for (const [key, data] of attempts.entries()) {
      if (data.resetTime < now) {
        attempts.delete(key);
      }
    }

    // Verifica tentativas do cliente
    const clientAttempts = attempts.get(clientId) || {
      count: 0,
      resetTime: now + windowMs,
    };

    if (clientAttempts.count >= maxRequests && clientAttempts.resetTime > now) {
      const resetInMinutes = Math.ceil(
        (clientAttempts.resetTime - now) / 60000
      );
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas. Tente novamente em ${resetInMinutes} minutos`,
        retryAfter: resetInMinutes * 60,
      });
    }

    // Incrementa contador
    clientAttempts.count++;
    if (clientAttempts.resetTime < now) {
      clientAttempts.resetTime = now + windowMs;
      clientAttempts.count = 1;
    }

    attempts.set(clientId, clientAttempts);
    next();
  };
};

// =============================================
// ROTAS PÚBLICAS - Sem autenticação
// =============================================

/**
 * Informações da API de usuários
 * GET /usuarios
 */
router.get("/", (req, res) => {
  res.json({
    module: "Usuários API",
    version: "4.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      auth: {
        register: "POST /registrar",
        login: "POST /login",
        logout: "POST /logout",
        refresh: "POST /refresh",
      },
      profile: {
        get: "GET /perfil",
        update: "PUT /perfil",
      },
      recovery: {
        request: "POST /recuperar-senha",
        validate: "GET /recuperar-senha/validar/:token",
        reset: "POST /recuperar-senha/redefinir",
      },
    },
    status: "operational",
  });
});

/**
 * Registro de novo usuário com middleware de email
 * POST /registrar
 *
 * FLUXO:
 * 1. criarUsuario -> cria usuário e define res.locals.usuarioCriado
 * 2. WelcomeEmailMiddleware -> envia email de boas-vindas de forma assíncrona
 */
router.post(
  "/registrar",
  authRateLimit(3, 10), // Máximo 3 tentativas de registro por 10 minutos
  async (req, res, next) => {
    console.log("📝 Iniciando processo de registro");
    next();
  },
  criarUsuario,
  async (req, res, next) => {
    // Middleware de debug para verificar se dados foram definidos
    const correlationId = req.headers["x-correlation-id"];

    if (res.locals.usuarioCriado) {
      console.log(
        `✅ [${correlationId}] res.locals.usuarioCriado definido para email`
      );
    } else {
      console.warn(
        `⚠️ [${correlationId}] res.locals.usuarioCriado NÃO definido`
      );
    }

    next();
  },
  WelcomeEmailMiddleware.create()
);

/**
 * Login de usuário com rate limiting
 * POST /login
 */
router.post(
  "/login",
  authRateLimit(5, 15), // Máximo 5 tentativas de login por 15 minutos
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(
      `🔐 [${correlationId}] Tentativa de login para: ${
        req.body.documento || "documento não fornecido"
      }`
    );
    next();
  },
  loginUsuario
);

/**
 * Validação de refresh token
 * POST /refresh
 */
router.post(
  "/refresh",
  authRateLimit(10, 15), // Máximo 10 tentativas de refresh por 15 minutos
  refreshToken
);

// =============================================
// ROTAS PROTEGIDAS - Requerem autenticação
// =============================================

/**
 * Logout de usuário
 * POST /logout
 */
router.post(
  "/logout",
  authMiddleware(),
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(
      `🚪 [${correlationId}] Logout do usuário: ${
        req.user?.id || "ID não disponível"
      }`
    );
    next();
  },
  logoutUsuario
);

/**
 * Perfil do usuário autenticado
 * GET /perfil
 */
router.get(
  "/perfil",
  supabaseAuthMiddleware(),
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(
      `👤 [${correlationId}] Solicitação de perfil do usuário: ${
        req.user?.id || "ID não disponível"
      }`
    );
    next();
  },
  obterPerfil
);

// =============================================
// RECUPERAÇÃO DE SENHA - REGISTRO DEDICADO
// =============================================

/**
 * Rotas de recuperação de senha
 * Registradas com seu próprio rate limiting
 */
router.use(
  "/recuperar-senha",
  authRateLimit(3, 60), // Máximo 3 tentativas de recuperação por hora
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(`🔑 [${correlationId}] Solicitação de recuperação de senha`);
    next();
  },
  passwordRecoveryRoutes
);

// =============================================
// MIDDLEWARE DE TRATAMENTO DE ERROS
// =============================================

/**
 * Middleware de tratamento de erros específico para rotas de usuário
 */
router.use((err: any, req: any, res: any, next: any) => {
  const correlationId = req.headers["x-correlation-id"];
  const errorId = `err-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)}`;

  console.error(`❌ [${correlationId}] Erro na rota de usuário [${errorId}]:`, {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.id || "não autenticado",
  });

  // Resposta baseada no ambiente
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      errorId,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: err.message,
      stack: err.stack,
      errorId,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
});

// =============================================
// HEALTH CHECK ESPECÍFICO
// =============================================

/**
 * Health check específico do módulo de usuários
 * GET /health
 */
router.get("/health", async (req, res) => {
  try {
    // CORREÇÃO: Import com extensão .js obrigatória
    const { prisma } = await import("../../../config/prisma.js");

    // Testa conectividade com banco (query simples)
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "healthy",
      module: "usuarios",
      version: "4.0.0",
      timestamp: new Date().toISOString(),
      database: "connected",
      environment: process.env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      module: "usuarios",
      version: "4.0.0",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error:
        error instanceof Error ? error.message : "Database connection failed",
    });
  }
});

export { router as usuarioRoutes };

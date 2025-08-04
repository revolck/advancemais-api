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
 * Rotas de usuário atualizadas com sistema de verificação de email
 * Implementa middleware de email corrigido e funcional
 *
 * @author Sistema AdvanceMais
 * @version 7.0.0 - Sistema de verificação de email implementado
 */
const router = Router();

// ===========================
// MIDDLEWARES GLOBAIS
// ===========================

/**
 * Middleware de logging e correlation ID
 */
router.use((req, res, next) => {
  const startTime = Date.now();
  const correlationId =
    req.headers["x-correlation-id"] ||
    `user-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  // Adiciona correlation ID ao request
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
 * Rate limiting inteligente para autenticação
 */
const createAuthRateLimit = (
  maxRequests: number = 5,
  windowMinutes: number = 15
) => {
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
        code: "RATE_LIMIT_EXCEEDED",
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

// ===========================
// ROTAS PÚBLICAS
// ===========================

/**
 * Informações da API de usuários
 * GET /usuarios
 */
router.get("/", (req, res) => {
  res.json({
    module: "Usuários API",
    version: "7.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    features: {
      emailVerification: process.env.EMAIL_VERIFICATION_REQUIRED !== "false",
      registration: true,
      authentication: true,
      profileManagement: true,
      passwordRecovery: true,
    },
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
      verification: {
        verify: "GET /verificar-email?token=xxx",
        resend: "POST /reenviar-verificacao",
        status: "GET /status-verificacao/:userId",
      },
    },
    status: "operational",
  });
});

/**
 * Registro de novo usuário com middleware de email CORRIGIDO
 * POST /registrar
 *
 * FLUXO ATUALIZADO:
 * 1. Rate limiting (3 tentativas por 10 minutos)
 * 2. Log de início do processo
 * 3. criarUsuario -> cria usuário e define res.locals.usuarioCriado
 * 4. Middleware de debug -> verifica dados
 * 5. WelcomeEmailMiddleware -> envia email/verificação de forma assíncrona
 */
router.post(
  "/registrar",
  createAuthRateLimit(3, 10), // 3 tentativas por 10 minutos
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(`📝 [${correlationId}] Iniciando processo de registro`);
    next();
  },
  criarUsuario, // Controller principal que cria usuário
  async (req, res, next) => {
    // Middleware de debug para verificar dados
    const correlationId = req.headers["x-correlation-id"];

    console.log(
      `🔍 [${correlationId}] Verificando dados para middleware de email`
    );

    if (res.locals?.usuarioCriado?.usuario) {
      const user = res.locals.usuarioCriado.usuario;
      console.log(`✅ [${correlationId}] Dados prontos para email:`, {
        id: user.id,
        email: user.email,
        nome: user.nomeCompleto,
        tipo: user.tipoUsuario,
      });
    } else {
      console.warn(
        `⚠️ [${correlationId}] Dados não encontrados em res.locals.usuarioCriado`
      );
      console.warn(`⚠️ [${correlationId}] res.locals:`, res.locals);
    }

    next();
  },
  WelcomeEmailMiddleware.create() // Middleware de email assíncrono
);

/**
 * Login de usuário
 * POST /login
 */
router.post(
  "/login",
  createAuthRateLimit(5, 15), // 5 tentativas por 15 minutos
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
 * Refresh token
 * POST /refresh
 */
router.post(
  "/refresh",
  createAuthRateLimit(10, 15), // 10 tentativas por 15 minutos
  refreshToken
);

// ===========================
// ROTAS PROTEGIDAS
// ===========================

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
      `👤 [${correlationId}] Solicitação de perfil: ${
        req.user?.id || "ID não disponível"
      }`
    );
    next();
  },
  obterPerfil
);

// ===========================
// ROTAS DE RECUPERAÇÃO DE SENHA
// ===========================

/**
 * Rotas de recuperação de senha
 */
router.use(
  "/recuperar-senha",
  createAuthRateLimit(3, 60), // 3 tentativas por hora
  async (req, res, next) => {
    const correlationId = req.headers["x-correlation-id"];
    console.log(`🔑 [${correlationId}] Solicitação de recuperação de senha`);
    next();
  },
  passwordRecoveryRoutes
);

// ===========================
// MIDDLEWARE DE TRATAMENTO DE ERROS
// ===========================

/**
 * Middleware de tratamento de erros para rotas de usuário
 */
router.use((err: any, req: any, res: any, next: any) => {
  const correlationId = req.headers["x-correlation-id"] || "unknown";
  const errorId = `user-err-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)}`;

  console.error(`❌ [${correlationId}] Erro na rota de usuário:`, {
    errorId,
    method: req.method,
    path: req.path,
    error: err.message || err,
    stack: err.stack?.substring(0, 500), // Limita stack trace
  });

  // Determina status code apropriado
  let statusCode = 500;
  let message = "Erro interno do servidor";
  let code = "INTERNAL_ERROR";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Dados inválidos fornecidos";
    code = "VALIDATION_ERROR";
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Não autorizado";
    code = "UNAUTHORIZED";
  } else if (err.message?.includes("duplicate")) {
    statusCode = 409;
    message = "Dados já existem no sistema";
    code = "DUPLICATE_ERROR";
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    errorId,
    correlationId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === "development" && {
      error: err.message,
      stack: err.stack,
    }),
  });
});

export default router;

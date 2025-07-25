// IMPORTANTE: Carrega as configurações de ambiente PRIMEIRO
import "./config/env";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { serverConfig, isDevelopment } from "./config/env";
import { debugRouter, debugExpressApp } from "./utils/route-debug";

/**
 * Configuração principal da aplicação Express
 */
const app = express();

console.log("🔄 Iniciando configuração da aplicação...");

/**
 * Middlewares de segurança e parsing
 */
app.use(
  cors({
    origin: serverConfig.corsOrigin,
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

console.log("✅ Middlewares básicos configurados");

/**
 * Middleware de logging em desenvolvimento
 */
if (isDevelopment) {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

/**
 * Rotas básicas primeiro
 */
console.log("🔄 Configurando rotas básicas...");

app.get("/", (req, res) => {
  res.json({
    message: "AdvanceMais API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      usuarios: "/api/v1/usuarios",
      health: "/health",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.nodeEnv,
  });
});

console.log("✅ Rotas básicas configuradas");

/**
 * Debug da aplicação ANTES de carregar as rotas dos usuários
 */
if (isDevelopment) {
  console.log("📊 Estado da aplicação ANTES das rotas de usuários:");
  debugExpressApp(app);
}

/**
 * Carregamento das rotas de usuários com máximo cuidado
 */
console.log("🔄 Carregando rotas de usuários...");

try {
  // Importa o router de usuários
  const usuarioRoutes = require("./modules/usuarios/routes/usuario").default;

  console.log("✅ Módulo de rotas importado com sucesso");

  // Debug do router antes de registrar
  if (isDevelopment) {
    debugRouter(usuarioRoutes, "Usuários");
  }

  // TENTATIVA 1: Registrar as rotas
  console.log("🔄 Tentativa 1: Registrando rotas normalmente...");
  app.use("/api/v1/usuarios", usuarioRoutes);
  console.log("✅ Rotas registradas com sucesso");
} catch (error) {
  console.error("❌ Erro ao carregar rotas de usuários:", error);
  console.error("Stack completo:", error.stack);

  // TENTATIVA 2: Rotas mínimas de fallback
  console.log("🔄 Tentativa 2: Criando rotas de fallback...");

  const fallbackRouter = express.Router();

  fallbackRouter.get("/status", (req, res) => {
    res.status(503).json({
      message: "Serviço de usuários temporariamente indisponível",
      error: "Erro no carregamento das rotas",
    });
  });

  app.use("/api/v1/usuarios", fallbackRouter);
  console.log("✅ Rotas de fallback criadas");
}

/**
 * Debug da aplicação DEPOIS de carregar as rotas
 */
if (isDevelopment) {
  console.log("📊 Estado da aplicação DEPOIS das rotas de usuários:");
  debugExpressApp(app);
}

/**
 * Middleware de tratamento de rotas não encontradas
 */
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Rota não encontrada",
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: ["GET /", "GET /health", "GET /api/v1/usuarios/*"],
  });
});

/**
 * Middleware global de tratamento de erros
 */
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("❌ Erro capturado pelo middleware global:", err);

    // Erros específicos de path-to-regexp
    if (
      err.message &&
      (err.message.includes("pathToRegexpError") ||
        err.message.includes("Missing parameter name"))
    ) {
      console.error("🐛 Erro identificado como problema de rota mal formada");
      return res.status(500).json({
        message: "Erro interno de configuração de rotas",
        error: "Rota mal formada detectada",
        debug: isDevelopment ? err.stack : undefined,
      });
    }

    res.status(err.status || 500).json({
      message: err.message || "Erro interno do servidor",
      ...(isDevelopment && {
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }),
    });
  }
);

/**
 * Inicialização do servidor com handlers de erro
 */
console.log("🔄 Iniciando servidor...");

let server: any;

try {
  server = app.listen(serverConfig.port, () => {
    console.log("🚀 Servidor iniciado com sucesso!");
    console.log(`   📍 Porta: ${serverConfig.port}`);
    console.log(`   🌍 Ambiente: ${serverConfig.nodeEnv}`);
    console.log(`   📊 Health: http://localhost:${serverConfig.port}/health`);
    console.log(
      `   👥 API: http://localhost:${serverConfig.port}/api/v1/usuarios`
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Debug final após servidor iniciar
    if (isDevelopment) {
      console.log("📊 Estado final da aplicação:");
      debugExpressApp(app);
    }
  });
} catch (error) {
  console.error("❌ Erro fatal ao iniciar servidor:", error);
  process.exit(1);
}

/**
 * Tratamento de erros do servidor
 */
if (server) {
  server.on("error", (error: any) => {
    console.error("❌ Erro no servidor:", error);

    if (error.code === "EADDRINUSE") {
      console.error(`   A porta ${serverConfig.port} já está em uso`);
    }

    if (error.message && error.message.includes("pathToRegexpError")) {
      console.error("🐛 Erro de path-to-regexp detectado no servidor");
    }
  });
}

/**
 * Tratamento de sinais e erros não capturados
 */
process.on("SIGTERM", () => {
  console.log("📴 Recebido SIGTERM, encerrando servidor...");
  if (server) {
    server.close(() => {
      console.log("✅ Servidor encerrado gracefully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  console.log("📴 Recebido SIGINT, encerrando servidor...");
  if (server) {
    server.close(() => {
      console.log("✅ Servidor encerrado gracefully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
  console.error("   Promise:", promise);

  if (
    reason &&
    typeof reason === "object" &&
    (reason as any).message?.includes("pathToRegexpError")
  ) {
    console.error("🐛 Unhandled rejection relacionada a path-to-regexp");
  }
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);

  if (error.message && error.message.includes("pathToRegexpError")) {
    console.error("🐛 Uncaught exception relacionada a path-to-regexp");
    console.error(
      "   Isso pode ser causado por uma rota mal formada em algum middleware"
    );
  }

  process.exit(1);
});

console.log("✅ Configuração completa finalizada");

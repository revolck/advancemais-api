import "./config/env";

import express from "express";
import cors from "cors";
import type { CorsOptions, CorsOptionsDelegate } from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { serverConfig } from "./config/env";
import { appRoutes } from "./routes";
import { startExpiredUserCleanupJob } from "./modules/usuarios/services/user-cleanup-service";
import { setupSwagger } from "./config/swagger";
import { startKeepAlive } from "./utils/keep-alive";

/**
 * Aplicação principal - Advance+ API
 *
 * Configuração centralizada de middlewares e rotas
 * usando padrão de router centralizado para melhor organização
 *
 * @author Sistema Advance+
 * @version 2.1.0
 */

const app = express();
// Confia no proxy para que req.protocol reflita corretamente HTTPS
app.set("trust proxy", true);

// =============================================
// MIDDLEWARES GLOBAIS
// =============================================

/**
 * Configuração de CORS
 * Permite requisições do frontend configurado
 * e sempre aceita requisições do mesmo domínio do servidor
 */
const corsOptionsDelegate: CorsOptionsDelegate<express.Request> = (
  req,
  callback
) => {
  const origin = req.header("Origin");
  const allowedOrigins = Array.isArray(serverConfig.corsOrigin)
    ? serverConfig.corsOrigin
    : [serverConfig.corsOrigin];

  // Determina o host do servidor e compara apenas o host, independente do protocolo
  const serverHost = req.hostname;
  const originHost = origin ? new URL(origin).host : null;

  if (!origin || allowedOrigins.includes(origin) || originHost === serverHost) {
    const corsOptions: CorsOptions = {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "X-Requested-With",
      ],
      optionsSuccessStatus: 204,
    };
    return callback(null, corsOptions);
  }

  // Rejeita silenciosamente origens não permitidas para evitar erro 500
  return callback(null, { origin: false });
};

app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

/**
 * Middleware de segurança Helmet
 * Adiciona headers de segurança às respostas
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:",
        ],
        workerSrc: ["'self'", "blob:"],
      },
    },
  })
);

/**
 * Parser de JSON com limite configurável
 * Aceita payloads de até 10MB
 */
app.use(express.json({ limit: "10mb" }));

/**
 * Parser de dados URL-encoded
 * Para formulários HTML tradicionais
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Parser de cookies
 * Necessário para autenticação via cookies no Swagger
 */
app.use(cookieParser());

// =============================================
// SWAGGER DOCS
// =============================================
setupSwagger(app);

// =============================================
// ROUTER PRINCIPAL
// =============================================

/**
 * Carrega todas as rotas através do router centralizado
 * Inclui automaticamente: usuários, brevo, health checks
 */
try {
  app.use("/", appRoutes);
  console.log("✅ Router principal carregado com sucesso");
  startExpiredUserCleanupJob();
} catch (error) {
  console.error("❌ Erro crítico ao carregar router principal:", error);

  // Fallback mínimo em caso de erro crítico
  app.get("/", (req, res) => {
    res.status(503).json({
      message: "API temporariamente indisponível",
      error: "Falha na inicialização do router principal",
    });
  });

  app.get("/health", (req, res) => {
    res.status(503).json({
      status: "UNHEALTHY",
      error: "Router principal não carregado",
    });
  });
}

// =============================================
// TRATAMENTO DE ERROS GLOBAIS
// =============================================

/**
 * Catch-all para rotas não encontradas
 * Deve ser registrado após todas as outras rotas
 */
app.all("*", (req, res) => {
  res.status(404).json({
    message: "Rota não encontrada",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Middleware de tratamento de erros global
 * Captura qualquer erro não tratado na aplicação
 */
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("❌ Erro interno não tratado:", err);

    res.status(500).json({
      message: "Erro interno do servidor",
      timestamp: new Date().toISOString(),
      // Só mostra detalhes do erro em desenvolvimento
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack,
      }),
    });
  }
);

// =============================================
// INICIALIZAÇÃO DO SERVIDOR
// =============================================

/**
 * Inicia o servidor HTTP na porta configurada
 */
const server = app.listen(serverConfig.port, () => {
  console.clear();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 Advance+ API - Servidor Iniciado");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 URL Base: http://localhost:${serverConfig.port}`);
  console.log(`🌍 Ambiente: ${serverConfig.nodeEnv}`);
  console.log(`⏰ Iniciado em: ${new Date().toLocaleString("pt-BR")}`);
  console.log("");
  console.log("📋 Endpoints Principais:");
  console.log(
    `   💚 Health Check: http://localhost:${serverConfig.port}/health`
  );
  console.log(
    `   👥 Usuários: http://localhost:${serverConfig.port}/api/v1/usuarios`
  );
  console.log(
    `   📧 Brevo: http://localhost:${serverConfig.port}/api/v1/brevo`
  );
  console.log(
    `   🌐 Website: http://localhost:${serverConfig.port}/api/v1/website`
  );
  console.log("");
  console.log("🧪 Testes Rápidos:");
  console.log(`   curl http://localhost:${serverConfig.port}/health`);
  console.log(
    `   curl http://localhost:${serverConfig.port}/api/v1/brevo/health`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Inicia keep-alive para evitar hibernação da instância
  startKeepAlive();
});

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

/**
 * Graceful shutdown em caso de SIGTERM (Docker, PM2, etc.)
 */
process.on("SIGTERM", () => {
  console.log("🔄 SIGTERM recebido, encerrando servidor graciosamente...");
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso");
    process.exit(0);
  });
});

/**
 * Graceful shutdown em caso de SIGINT (Ctrl+C)
 */
process.on("SIGINT", () => {
  console.log("\n🔄 SIGINT recebido, encerrando servidor graciosamente...");
  server.close(() => {
    console.log("✅ Servidor encerrado com sucesso");
    process.exit(0);
  });
});

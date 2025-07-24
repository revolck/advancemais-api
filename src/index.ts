import express from "express";
import cors from "cors";
import helmet from "helmet";
import { usuarioRoutes } from "./modules/usuarios";

/**
 * Configuração principal da aplicação Express
 */
const app = express();

// Middlewares globais
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/**
 * Rotas da aplicação
 */
app.use("/api/usuarios", usuarioRoutes);

/**
 * Rota de health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

/**
 * Middleware de tratamento de rotas não encontradas
 */
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Rota não encontrada",
    path: req.originalUrl,
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
    console.error("Erro não tratado:", err);

    res.status(err.status || 500).json({
      message: err.message || "Erro interno do servidor",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`👥 API Usuários: http://localhost:${PORT}/api/usuarios`);
});

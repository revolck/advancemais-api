import "./config/env";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { serverConfig, isDevelopment } from "./config/env";

const app = express();

app.use(cors({ origin: serverConfig.corsOrigin, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "AdvanceMais API",
    version: "v1",
    endpoints: { usuarios: "/api/v1/usuarios", health: "/health" },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", uptime: process.uptime() });
});

try {
  const usuarioRoutes = require("./modules/usuarios/routes/usuario").default;
  app.use("/api/v1/usuarios", usuarioRoutes);
} catch (error) {
  console.error("❌ Erro ao carregar usuários");
  app.use("/api/v1/usuarios", (req, res) =>
    res.status(503).json({ message: "Serviço indisponível" })
  );
}

app.all("/*catchAll", (req, res) => {
  res
    .status(404)
    .json({ message: "Rota não encontrada", path: req.originalUrl });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    res.status(500).json({ message: "Erro interno" });
  }
);

const server = app.listen(serverConfig.port, () => {
  console.clear();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 AdvanceMais API");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📍 Servidor: http://localhost:${serverConfig.port}`);
  console.log(`🌍 Ambiente: ${serverConfig.nodeEnv}`);
  console.log(`📊 Health: http://localhost:${serverConfig.port}/health`);
  console.log(
    `👥 Usuários: http://localhost:${serverConfig.port}/api/v1/usuarios`
  );
  console.log(`⏰ Iniciado: ${new Date().toLocaleString("pt-BR")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());

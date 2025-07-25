import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";

/**
 * Router principal da aplicação
 * Centraliza todas as rotas dos módulos
 */
const router = Router();

/**
 * Rota de informações da API
 */
router.get("/", (req, res) => {
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

/**
 * Rota de health check
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "v1",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

/**
 * Rotas dos módulos - usando caminho fixo por enquanto
 */
router.use("/api/v1/usuarios", usuarioRoutes);

export { router as appRoutes };

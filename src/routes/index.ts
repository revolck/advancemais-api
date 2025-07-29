import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";

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
 * Modulo de usuários
 * - Gerenciamento de usuários
 * - Autenticação e autorização
 * - Perfis e permissões
 * - Recuperação de senha
 */
router.use("/api/v1/usuarios", usuarioRoutes);

/**
 * Modulo do mercadopago
 * - Integração com a API do MercadoPago
 * - Criação e gerenciamento de orders
 * - Assinaturas e cobranças recorrentes
 * - Webhooks para notificações em tempo real
 * - Reembolsos e cancelamentos
 * - Configurações e validações
 * - Logs e auditoria
 */
router.use("/api/v1/mercadopago", mercadoPagoRoutes);

export { router as appRoutes };

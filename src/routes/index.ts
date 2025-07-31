import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";

/**
 * Router principal da aplicação
 * Centraliza todas as rotas dos módulos
 *
 * @author Sistema AdvanceMais
 * @version 2.1.0
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
      mercadopago: "/api/v1/mercadopago",
      brevo: "/api/v1/brevo",
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

// =============================================
// MÓDULOS DA APLICAÇÃO
// =============================================

/**
 * Módulo de usuários
 * - Gerenciamento de usuários
 * - Autenticação e autorização
 * - Perfis e permissões
 * - Recuperação de senha
 */
router.use("/api/v1/usuarios", usuarioRoutes);

/**
 * Módulo do MercadoPago
 * - Integração com a API do MercadoPago
 * - Criação e gerenciamento de orders
 * - Assinaturas e cobranças recorrentes
 * - Webhooks para notificações em tempo real
 * - Reembolsos e cancelamentos
 * - Configurações e validações
 * - Logs e auditoria
 */
router.use("/api/v1/mercadopago", mercadoPagoRoutes);

/**
 * Módulo do Brevo (Email e SMS)
 * - Envio de emails transacionais
 * - Envio de SMS para verificação
 * - Templates HTML responsivos
 * - Sistema de retry automático
 * - Health checks e monitoramento
 * - Estatísticas de envio
 */
try {
  const brevoRoutes = require("../modules/brevo/routes").default;
  router.use("/api/v1/brevo", brevoRoutes);
  console.log("✅ Módulo Brevo registrado no router principal");
} catch (error) {
  console.error("❌ Erro ao carregar rotas do Brevo:", error);

  // Fallback em caso de erro
  router.use("/api/v1/brevo", (req, res) => {
    res.status(503).json({
      message: "Módulo Brevo temporariamente indisponível",
      error: "Falha ao carregar o módulo",
    });
  });
}

export { router as appRoutes };

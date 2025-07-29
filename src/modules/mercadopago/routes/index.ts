import { Router } from "express";
import ordersRoutes from "./orders";
import subscriptionsRoutes from "./subscriptions";
import webhooksRoutes from "./webhooks";
import configRoutes from "./config";

/**
 * Router principal do módulo MercadoPago
 * Centraliza todas as rotas dos submodulos
 */
const router = Router();

/**
 * Rota de informações do módulo
 */
router.get("/", (req, res) => {
  res.json({
    message: "MercadoPago Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      orders: "/api/v1/mercadopago/orders",
      subscriptions: "/api/v1/mercadopago/subscriptions",
      webhooks: "/api/v1/mercadopago/webhooks",
      config: "/api/v1/mercadopago/config",
    },
    documentation: {
      orders: "Gerenciamento de orders (pagamentos únicos)",
      subscriptions: "Gerenciamento de assinaturas (pagamentos recorrentes)",
      webhooks: "Recebimento de notificações do MercadoPago",
      config: "Configurações e informações da integração",
    },
  });
});

/**
 * Rota de health check específica do módulo
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    module: "mercadopago",
    timestamp: new Date().toISOString(),
    version: "v1",
    services: {
      orders: "active",
      subscriptions: "active",
      webhooks: "active",
      config: "active",
    },
  });
});

// Registra as rotas dos submodulos
router.use("/orders", ordersRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/config", configRoutes);

export { router as mercadoPagoRoutes };

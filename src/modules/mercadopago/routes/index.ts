import { Router } from "express";
import { ordersRoutes } from "./orders";
import { subscriptionsRoutes } from "./subscriptions";
import { webhooksRoutes } from "./webhooks";
import { configRoutes } from "./config";

/**
 * Router principal do módulo MercadoPago - CORRIGIDO
 * Centraliza todas as rotas dos submódulos
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2 - Correção de path-to-regexp
 */
const router = Router();

/**
 * Informações do módulo
 * GET /mercadopago
 */
router.get("/", (req, res) => {
  res.json({
    message: "MercadoPago Module API",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: {
      orders: "/orders",
      subscriptions: "/subscriptions",
      webhooks: "/webhooks",
      config: "/config",
    },
    status: "operational",
  });
});

/**
 * Health check do módulo
 * GET /mercadopago/health
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    module: "mercadopago",
    timestamp: new Date().toISOString(),
    version: "v1",
  });
});

// Registra as rotas dos submódulos
router.use("/orders", ordersRoutes);
router.use("/subscriptions", subscriptionsRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/config", configRoutes);

export { router as mercadoPagoRoutes };

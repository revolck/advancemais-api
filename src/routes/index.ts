import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";
import brevoRoutes from "../modules/brevo/routes";

/**
 * Router principal da aplicação - VERSÃO FINAL CORRIGIDA
 * Elimina problemas de path-to-regexp com rotas bem definidas
 *
 * @author Sistema AdvanceMais
 * @version 3.0.1
 */
const router = Router();

/**
 * Rota de informações da API
 * GET /
 */
router.get("/", (req, res) => {
  res.json({
    message: "AdvanceMais API",
    version: "v3.0.1",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    status: "operational",
    endpoints: {
      usuarios: "/api/v1/usuarios",
      mercadopago: "/api/v1/mercadopago",
      brevo: "/api/v1/brevo",
      health: "/health",
      docs: "/docs (em breve)",
    },
  });
});

/**
 * Health check global
 * GET /health
 */
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "v3.0.1",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
    modules: {
      usuarios: "✅ active",
      mercadopago: "✅ active",
      brevo: "✅ active",
    },
  });
});

// =============================================
// MÓDULOS DA APLICAÇÃO - COM TRY/CATCH ROBUSTO
// =============================================

/**
 * Módulo de usuários
 * /api/v1/usuarios/*
 */
try {
  router.use("/api/v1/usuarios", usuarioRoutes);
  console.log("✅ Módulo de usuários registrado com sucesso");
} catch (error) {
  console.error("❌ ERRO CRÍTICO - Módulo de usuários:", error);

  // Fallback para usuários
  router.use("/api/v1/usuarios", (req, res) => {
    res.status(503).json({
      message: "Módulo de usuários temporariamente indisponível",
      error: "Falha no carregamento",
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Módulo MercadoPago
 * /api/v1/mercadopago/*
 */
try {
  router.use("/api/v1/mercadopago", mercadoPagoRoutes);
  console.log("✅ Módulo MercadoPago registrado com sucesso");
} catch (error) {
  console.error("❌ ERRO CRÍTICO - Módulo MercadoPago:", error);

  // Fallback para MercadoPago
  router.use("/api/v1/mercadopago", (req, res) => {
    res.status(503).json({
      message: "Módulo MercadoPago temporariamente indisponível",
      error: "Falha no carregamento",
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Módulo Brevo
 * /api/v1/brevo/*
 */
try {
  router.use("/api/v1/brevo", brevoRoutes);
  console.log("✅ Módulo Brevo registrado com sucesso");
} catch (error) {
  console.error("❌ ERRO CRÍTICO - Módulo Brevo:", error);

  // Fallback para Brevo
  router.use("/api/v1/brevo", (req, res) => {
    res.status(503).json({
      message: "Módulo Brevo temporariamente indisponível",
      error: "Falha no carregamento do módulo de comunicação",
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Rota catch-all para 404
 * Deve ser a ÚLTIMA rota registrada
 */
router.all("*", (req, res) => {
  res.status(404).json({
    message: "Endpoint não encontrado",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      usuarios: "/api/v1/usuarios",
      mercadopago: "/api/v1/mercadopago",
      brevo: "/api/v1/brevo",
      health: "/health",
    },
  });
});

export { router as appRoutes };

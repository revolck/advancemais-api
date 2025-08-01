import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";
import { brevoRoutes } from "../modules/brevo/routes";

/**
 * Router principal da aplicação - VERSÃO FINAL CORRIGIDA
 * Elimina problemas de path-to-regexp com rotas bem definidas
 *
 * @author Sistema AdvanceMais
 * @version 3.0.2 - Correção definitiva do path-to-regexp
 */
const router = Router();

/**
 * Rota de informações da API
 * GET /
 */
router.get("/", (req, res) => {
  res.json({
    message: "AdvanceMais API",
    version: "v3.0.2",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    status: "operational",
    endpoints: {
      usuarios: "/api/v1/usuarios",
      mercadopago: "/api/v1/mercadopago",
      brevo: "/api/v1/brevo",
      health: "/health",
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
    version: "v3.0.2",
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    modules: {
      usuarios: "✅ active",
      mercadopago: "✅ active",
      brevo: "✅ active",
    },
  });
});

// =============================================
// MÓDULOS DA APLICAÇÃO - ROTAS BEM DEFINIDAS
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
  router.use("/api/v1/usuarios", (req, res) => {
    res.status(503).json({
      message: "Módulo de usuários temporariamente indisponível",
      error: "Falha no carregamento",
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
  router.use("/api/v1/mercadopago", (req, res) => {
    res.status(503).json({
      message: "Módulo MercadoPago temporariamente indisponível",
      error: "Falha no carregamento",
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
  router.use("/api/v1/brevo", (req, res) => {
    res.status(503).json({
      message: "Módulo Brevo temporariamente indisponível",
      error: "Falha no carregamento do módulo de comunicação",
    });
  });
}

export { router as appRoutes };

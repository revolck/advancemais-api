import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";
import { brevoRoutes } from "../modules/brevo/routes";
import { EmailVerificationController } from "../modules/brevo/controllers/email-verification-controller";

/**
 * Router principal da aplicação - VERSÃO BLINDADA
 * Elimina problemas de path-to-regexp definitivamente
 *
 * @author Sistema AdvanceMais
 * @version 3.0.3 - Correção definitiva Express 4.x
 */
const router = Router();
const emailVerificationController = new EmailVerificationController();

/**
 * Rota raiz da API
 * GET /
 */
router.get("/", (req, res) => {
  res.json({
    message: "AdvanceMais API",
    version: "v3.0.3",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    status: "operational",
    express_version: "4.x",
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
    version: "v3.0.3",
    uptime: Math.floor(process.uptime()),
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

// Rota pública para verificação de email
router.get("/verificar-email", emailVerificationController.verifyEmail);

// =============================================
// REGISTRO DE MÓDULOS - COM ERROR HANDLING
// =============================================

/**
 * Módulo de usuários - COM VALIDAÇÃO
 * /api/v1/usuarios/*
 */
if (usuarioRoutes) {
  try {
    router.use("/api/v1/usuarios", usuarioRoutes);
    console.log("✅ Módulo de usuários registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo de usuários:", error);
  }
} else {
  console.error("❌ usuarioRoutes não está definido");
}

/**
 * Módulo MercadoPago - COM VALIDAÇÃO
 * /api/v1/mercadopago/*
 */
if (mercadoPagoRoutes) {
  try {
    router.use("/api/v1/mercadopago", mercadoPagoRoutes);
    console.log("✅ Módulo MercadoPago registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo MercadoPago:", error);
  }
} else {
  console.error("❌ mercadoPagoRoutes não está definido");
}

/**
 * Módulo Brevo - COM VALIDAÇÃO
 * /api/v1/brevo/*
 */
if (brevoRoutes) {
  try {
    router.use("/api/v1/brevo", brevoRoutes);
    console.log("✅ Módulo Brevo registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo Brevo:", error);
  }
} else {
  console.error("❌ brevoRoutes não está definido");
}

/**
 * Catch-all para rotas não encontradas
 */
router.all("*", (req, res) => {
  res.status(404).json({
    message: "Endpoint não encontrado",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: "Verifique a documentação da API",
  });
});

export { router as appRoutes };

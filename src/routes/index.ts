import { Router } from "express";
import { usuarioRoutes } from "../modules/usuarios";
import { mercadoPagoRoutes } from "../modules/mercadopago";
import { brevoRoutes } from "../modules/brevo/routes";
import { websiteRoutes } from "../modules/website";
import { empresaRoutes } from "../modules/empresa";
import { auditRoutes } from "../modules/audit";
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
 * @openapi
 * /:
 *   get:
 *     summary: Rota raiz da API
 *     responses:
 *       200:
 *         description: Informações básicas e endpoints disponíveis
 *         content:
 *           application/json:
 *             example:
 *               message: "AdvanceMais API"
 *               version: "v3.0.3"
 *               status: "operational"
 *               endpoints:
 *                 usuarios: "/api/v1/usuarios"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/"
 */
router.get("/", (req, res) => {
  const data = {
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
      website: "/api/v1/website",
      empresa: "/api/v1/empresa",
      audit: "/api/v1/audit",
      health: "/health",
    },
  };

  if (req.headers["accept"]?.includes("application/json")) {
    return res.json(data);
  }

  const html = `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>${data.message}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; background: #f5f6fa; color: #2f3640; padding: 2rem; }
        h1 { margin-top: 0; }
        code { background: #dcdde1; padding: 2px 4px; border-radius: 4px; }
        ul { list-style: none; padding: 0; }
        li { margin: 0.5rem 0; }
        footer { margin-top: 2rem; font-size: 0.9rem; color: #718093; }
      </style>
    </head>
    <body>
      <h1>${data.message}</h1>
      <p><strong>Versão:</strong> ${data.version}</p>
      <p><strong>Ambiente:</strong> ${data.environment}</p>
      <p><strong>Status:</strong> ${data.status}</p>
      <h2>Endpoints</h2>
      <ul>
        <li>👥 Usuários: <code>${data.endpoints.usuarios}</code></li>
        <li>🏦 MercadoPago: <code>${data.endpoints.mercadopago}</code></li>
        <li>📧 Brevo: <code>${data.endpoints.brevo}</code></li>
        <li>🌐 Website: <code>${data.endpoints.website}</code></li>
      <li>🏢 Empresa: <code>${data.endpoints.empresa}</code></li>
        <li>📜 Audit: <code>${data.endpoints.audit}</code></li>
        <li>💚 Health: <code>${data.endpoints.health}</code></li>
      </ul>
      <footer>
        <p>Express ${data.express_version} • ${data.timestamp}</p>
      </footer>
    </body>
  </html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check global
 *     responses:
 *       200:
 *         description: Status do servidor
 *         content:
 *           application/json:
 *             example:
 *               status: "OK"
 *               uptime: 1
 *               version: "v3.0.3"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/health"
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
      website: "✅ active",
      empresa: "✅ active",
      audit: "✅ active",
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
 * Módulo Website - COM VALIDAÇÃO
 * /api/v1/website/*
 */
if (websiteRoutes) {
  try {
    router.use("/api/v1/website", websiteRoutes);
    console.log("✅ Módulo Website registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo Website:", error);
  }
} else {
  console.error("❌ websiteRoutes não está definido");
}

/**
 * Módulo Empresa - COM VALIDAÇÃO
 * /api/v1/empresa/*
 */
if (empresaRoutes) {
  try {
    router.use("/api/v1/empresa", empresaRoutes);
    console.log("✅ Módulo Empresa registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo Empresa:", error);
  }
} else {
  console.error("❌ empresaRoutes não está definido");
}

/**
 * Módulo de Auditoria - COM VALIDAÇÃO
 * /api/v1/audit/*
 */
if (auditRoutes) {
  try {
    router.use("/api/v1/audit", auditRoutes);
    console.log("✅ Módulo Auditoria registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo Auditoria:", error);
  }
} else {
  console.error("❌ auditRoutes não está definido");
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

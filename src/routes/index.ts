import { Router, type Request } from "express";

import redis from "@/config/redis";
import { publicCache } from "@/middlewares/cache-control";
import { docsRoutes } from "@/modules/docs";
import { brevoRoutes } from "@/modules/brevo/routes";
import { EmailVerificationController } from "@/modules/brevo/controllers/email-verification-controller";
import { usuarioRoutes } from "@/modules/usuarios";
import { websiteRoutes } from "@/modules/website";
import { setCacheHeaders, DEFAULT_TTL } from "@/utils/cache";

/**
 * Router principal da aplicação
 */
const router = Router();
const emailVerificationController = new EmailVerificationController();

const parseEtags = (header: Request["headers"]["if-none-match"]) => {
  if (!header) return [] as string[];
  const values = Array.isArray(header) ? header : header.split(",");
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^W\//, "").replace(/"/g, ""));
};

const normalizeTimestamp = (ttl: number) => {
  if (ttl <= 0) {
    return new Date().toISOString();
  }
  const bucket = Math.floor(Date.now() / (ttl * 1000)) * ttl * 1000;
  return new Date(bucket).toISOString();
};

/**
 * @openapi
 * /:
 *   get:
 *     summary: Rota raiz da API
 *     tags: [Default]
 *     responses:
 *       200:
 *         description: Informações básicas e endpoints disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiRootInfo'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/"
 */
router.get("/", publicCache, (req, res) => {
  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const timestamp = normalizeTimestamp(ttl);
  const data = {
    message: "Advance+ API",
    version: "v3.0.3",
    timestamp,
    environment: process.env.NODE_ENV,
    status: "operational",
    express_version: "4.x",
    endpoints: {
      usuarios: "/api/v1/usuarios",
      brevo: "/api/v1/brevo",
      website: "/api/v1/website",
      health: "/health",
    },
  };

  const etag = setCacheHeaders(res, data, ttl);
  if (parseEtags(req.headers["if-none-match"]).includes(etag)) {
    return res.status(304).end();
  }

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
        <li>📧 Brevo: <code>${data.endpoints.brevo}</code></li>
        <li>🌐 Website: <code>${data.endpoints.website}</code></li>
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
 *     tags: [Default]
 *     responses:
 *       200:
 *         description: Status do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GlobalHealthStatus'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/health"
 */
router.get("/health", publicCache, async (req, res) => {
  let redisStatus = "⚠️ not configured";
  if (process.env.REDIS_URL) {
    try {
      await redis.ping();
      redisStatus = "✅ active";
    } catch {
      redisStatus = "❌ inactive";
    }
  }

  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const uptimeRaw = Math.floor(process.uptime());
  const uptime = ttl > 0 ? Math.floor(uptimeRaw / ttl) * ttl : uptimeRaw;
  const payload = {
    status: "OK",
    timestamp: normalizeTimestamp(ttl),
    version: "v3.0.3",
    uptime,
    environment: process.env.NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
    },
    modules: {
      usuarios: "✅ active",
      brevo: "✅ active",
      website: "✅ active",
      redis: redisStatus,
    },
  };

  const etag = setCacheHeaders(res, payload, ttl);
  if (parseEtags(req.headers["if-none-match"]).includes(etag)) {
    return res.status(304).end();
  }

  res.json(payload);
});

// Rota pública para verificação de email
router.get(
  "/verificar-email",
  emailVerificationController.verifyEmail
);

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
 * Módulo de Documentação - COM VALIDAÇÃO
 * /docs/login
 */
if (docsRoutes) {
  try {
    router.use("/", docsRoutes);
    console.log("✅ Módulo Documentação registrado com sucesso");
  } catch (error) {
    console.error("❌ ERRO - Módulo Documentação:", error);
  }
} else {
  console.error("❌ docsRoutes não está definido");
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

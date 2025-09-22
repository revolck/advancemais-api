import { Router, type Request } from 'express';

import redis from '@/config/redis';
import { publicCache } from '@/middlewares/cache-control';
import { docsRoutes } from '@/modules/docs';
import { getBanimentosWatcherMetrics } from '@/modules/usuarios/banimentos/cron/ban-watcher';
import { brevoRoutes } from '@/modules/brevo/routes';
import { mercadopagoRoutes } from '@/modules/mercadopago';
import { EmailVerificationController } from '@/modules/brevo/controllers/email-verification-controller';
import { usuarioRoutes } from '@/modules/usuarios';
import { websiteRoutes } from '@/modules/website';
import { empresasRoutes } from '@/modules/empresas';
import { candidatosRoutes } from '@/modules/candidatos';
import { cursosRoutes } from '@/modules/cursos';
import { setCacheHeaders, DEFAULT_TTL } from '@/utils/cache';
import { logger } from '@/utils/logger';

/**
 * Router principal da aplicação
 */
const router = Router();
const emailVerificationController = new EmailVerificationController();
const routesLogger = logger.child({ module: 'Router' });

const parseEtags = (header: Request['headers']['if-none-match']) => {
  if (!header) return [] as string[];
  const values = Array.isArray(header) ? header : header.split(',');
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/^W\//, '').replace(/"/g, ''));
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
router.get('/', publicCache, (req, res) => {
  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const timestamp = normalizeTimestamp(ttl);
  const data = {
    message: 'Advance+ API',
    version: 'v3.0.3',
    timestamp,
    environment: process.env.NODE_ENV,
    status: 'operational',
    express_version: '4.x',
    endpoints: {
      usuarios: '/api/v1/usuarios',
      brevo: '/api/v1/brevo',
      website: '/api/v1/website',
      empresas: '/api/v1/empresas',
      candidatos: '/api/v1/candidatos',
      cursos: '/api/v1/cursos',
      candidatosAreasInteresse: '/api/v1/candidatos/areas-interesse',
      planosEmpresariais: '/api/v1/empresas/planos-empresariais',
      clientesEmpresas: '/api/v1/empresas/clientes',
      vagasEmpresariais: '/api/v1/empresas/vagas',
      mercadopagoAssinaturas: '/api/v1/mercadopago/assinaturas',
      mercadopagoLogs: '/api/v1/mercadopago/logs',
      health: '/health',
    },
  };

  const etag = setCacheHeaders(res, data, ttl);
  if (parseEtags(req.headers['if-none-match']).includes(etag)) {
    return res.status(304).end();
  }

  if (req.headers['accept']?.includes('application/json')) {
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
        <li>🏢 Empresas: <code>${data.endpoints.empresas}</code></li>
        <li>📦 Planos empresariais: <code>${data.endpoints.planosEmpresariais}</code></li>
        <li>🧾 Clientes (planos): <code>${data.endpoints.clientesEmpresas}</code></li>
        <li>💼 Vagas empresariais: <code>${data.endpoints.vagasEmpresariais}</code></li>
        <li>💳 MercadoPago - Assinaturas: <code>${data.endpoints.mercadopagoAssinaturas}</code></li>
        <li>💚 Health: <code>${data.endpoints.health}</code></li>
      </ul>
      <footer>
        <p>Express ${data.express_version} • ${data.timestamp}</p>
      </footer>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
router.get('/health', publicCache, async (req, res) => {
  let redisStatus = '⚠️ not configured';
  if (process.env.REDIS_URL) {
    try {
      await redis.ping();
      redisStatus = '✅ active';
    } catch {
      redisStatus = '❌ inactive';
    }
  }

  const ttl = Number(process.env.WEBSITE_CACHE_TTL || DEFAULT_TTL);
  const uptimeRaw = Math.floor(process.uptime());
  const uptime = ttl > 0 ? Math.floor(uptimeRaw / ttl) * ttl : uptimeRaw;
  const payload = {
    status: 'OK',
    timestamp: normalizeTimestamp(ttl),
    version: 'v3.0.3',
    uptime,
    environment: process.env.NODE_ENV,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    modules: {
      usuarios: '✅ active',
      brevo: '✅ active',
      website: '✅ active',
      empresas: '✅ active',
      candidatos: '✅ active',
      mercadopago: '✅ active',
      redis: redisStatus,
    },
    metrics: {
      bans: getBanimentosWatcherMetrics(),
    },
  };

  const etag = setCacheHeaders(res, payload, ttl);
  if (parseEtags(req.headers['if-none-match']).includes(etag)) {
    return res.status(304).end();
  }

  res.json(payload);
});

// Rota pública para verificação de email
router.get('/verificar-email', emailVerificationController.verifyEmail);

// =============================================
// REGISTRO DE MÓDULOS - COM ERROR HANDLING
// =============================================

/**
 * Módulo de usuários - COM VALIDAÇÃO
 * /api/v1/usuarios/*
 */
if (usuarioRoutes) {
  try {
    router.use('/api/v1/usuarios', usuarioRoutes);
    routesLogger.info(
      { feature: 'UsuariosModule' },
      '✅ Módulo de usuários registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error({ feature: 'UsuariosModule', err: error }, '❌ ERRO - Módulo de usuários');
  }
} else {
  routesLogger.error({ feature: 'UsuariosModule' }, '❌ usuarioRoutes não está definido');
}

/**
 * Módulo Brevo - COM VALIDAÇÃO
 * /api/v1/brevo/*
 */
if (brevoRoutes) {
  try {
    router.use('/api/v1/brevo', brevoRoutes);
    routesLogger.info({ feature: 'BrevoModule' }, '✅ Módulo Brevo registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'BrevoModule', err: error }, '❌ ERRO - Módulo Brevo');
  }
} else {
  routesLogger.error({ feature: 'BrevoModule' }, '❌ brevoRoutes não está definido');
}

/**
 * Módulo Mercado Pago - COM VALIDAÇÃO
 * /api/v1/mercadopago/*
 */
if (mercadopagoRoutes) {
  try {
    router.use('/api/v1/mercadopago', mercadopagoRoutes);
    routesLogger.info(
      { feature: 'MercadoPagoModule' },
      '✅ Módulo Mercado Pago registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error(
      { feature: 'MercadoPagoModule', err: error },
      '❌ ERRO - Módulo Mercado Pago',
    );
  }
} else {
  routesLogger.error({ feature: 'MercadoPagoModule' }, '❌ mercadopagoRoutes não está definido');
}

/**
 * Módulo Website - COM VALIDAÇÃO
 * /api/v1/website/*
 */
if (websiteRoutes) {
  try {
    router.use('/api/v1/website', websiteRoutes);
    routesLogger.info({ feature: 'WebsiteModule' }, '✅ Módulo Website registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'WebsiteModule', err: error }, '❌ ERRO - Módulo Website');
  }
} else {
  routesLogger.error({ feature: 'WebsiteModule' }, '❌ websiteRoutes não está definido');
}

/**
 * Módulo Empresas - COM VALIDAÇÃO
 * /api/v1/empresas/*
 */
if (empresasRoutes) {
  try {
    router.use('/api/v1/empresas', empresasRoutes);
    routesLogger.info({ feature: 'EmpresasModule' }, '✅ Módulo Empresas registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'EmpresasModule', err: error }, '❌ ERRO - Módulo Empresas');
  }
} else {
  routesLogger.error({ feature: 'EmpresasModule' }, '❌ empresasRoutes não está definido');
}

/**
 * Módulo Candidatos - COM VALIDAÇÃO
 * /api/v1/candidatos/*
 */
if (candidatosRoutes) {
  try {
    router.use('/api/v1/candidatos', candidatosRoutes);
    routesLogger.info(
      { feature: 'CandidatosModule' },
      '✅ Módulo Candidatos registrado com sucesso',
    );
  } catch (error) {
    routesLogger.error({ feature: 'CandidatosModule', err: error }, '❌ ERRO - Módulo Candidatos');
  }
} else {
  routesLogger.error({ feature: 'CandidatosModule' }, '❌ candidatosRoutes não está definido');
}

/**
 * Módulo Cursos - COM VALIDAÇÃO
 * /api/v1/cursos/*
 */
if (cursosRoutes) {
  try {
    router.use('/api/v1/cursos', cursosRoutes);
    routesLogger.info({ feature: 'CursosModule' }, '✅ Módulo Cursos registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'CursosModule', err: error }, '❌ ERRO - Módulo Cursos');
  }
} else {
  routesLogger.error({ feature: 'CursosModule' }, '❌ cursosRoutes não está definido');
}

/**
 * Módulo de Documentação - COM VALIDAÇÃO
 * /docs/login
 */
if (docsRoutes) {
  try {
    router.use('/', docsRoutes);
    routesLogger.info({ feature: 'DocsModule' }, '✅ Módulo Documentação registrado com sucesso');
  } catch (error) {
    routesLogger.error({ feature: 'DocsModule', err: error }, '❌ ERRO - Módulo Documentação');
  }
} else {
  routesLogger.error({ feature: 'DocsModule' }, '❌ docsRoutes não está definido');
}

/**
 * Catch-all para rotas não encontradas
 */
router.all('*', (req, res) => {
  res.status(404).json({
    message: 'Endpoint não encontrado',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Verifique a documentação da API',
  });
});

export { router as appRoutes };

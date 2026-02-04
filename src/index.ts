import './config/module-alias';
import './config/env';

import express from 'express';
import cors from 'cors';
import type { CorsOptions, CorsOptionsDelegate } from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { compressionMiddleware } from './middlewares/compression';
import { rateLimitMiddleware } from './middlewares/rate-limit';
import { correlationIdMiddleware } from './middlewares/correlation-id';
import { serverConfig } from './config/env';
import { appRoutes } from './routes';
import { startExpiredUserCleanupJob } from './modules/usuarios/services/user-cleanup-service';
import { setupSwagger } from './config/swagger';
import { startKeepAlive } from './utils/keep-alive';
import { prisma } from './config/prisma';
import redis from './config/redis';
import { errorMiddleware } from './middlewares/error';
import { logger } from '@/utils/logger';
import { startAssinaturasReconJob } from '@/modules/mercadopago/assinaturas/cron/reconcile';
import { startBoletoWatcherJob } from '@/modules/mercadopago/assinaturas/cron/boleto-watcher';
import { startBloqueiosWatcherJob } from '@/modules/usuarios/bloqueios/cron/bloqueio-watcher';
import { startEstagiosWatcherJob } from '@/modules/cursos/cron/estagios-watcher';
import { startTurmasStatusWatcherJob } from '@/modules/cursos/cron/turmas-status-watcher';
import { startCobrancaAutomaticaJob } from '@/modules/empresas/cartoes/cron/cobranca-automatica';
import { startAgendaCronJobs } from '@/modules/cursos/aulas/cron/agenda-jobs';

/**
 * Aplicação principal - Advance+ API
 *
 * Configuração centralizada de middlewares e rotas
 * usando padrão de router centralizado para melhor organização
 */

const bootstrapLogger = logger.child({ module: 'Bootstrap' });

const app = express();

// Exportar app para testes
export { app };

app.set('trust proxy', 1);

// =============================================
// MIDDLEWARES GLOBAIS
// =============================================

/**
 * Configuração de CORS
 * Permite requisições do frontend configurado
 * e sempre aceita requisições do mesmo domínio do servidor
 */
const corsOptionsDelegate: CorsOptionsDelegate<express.Request> = (req, callback) => {
  const origin = req.header('Origin');
  const allowedOrigins = Array.isArray(serverConfig.corsOrigin)
    ? serverConfig.corsOrigin
    : [serverConfig.corsOrigin];

  // Determina o host do servidor e compara apenas o host, independente do protocolo
  const serverHost = req.hostname;
  const originHost = origin ? new URL(origin).host : null;

  // Verifica se a origem está permitida
  const isOriginAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    originHost === serverHost ||
    allowedOrigins.includes('*');

  if (isOriginAllowed) {
    const corsOptions: CorsOptions = {
      origin: origin || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin'],
      optionsSuccessStatus: 204,
    };

    return callback(null, corsOptions);
  }

  // Rejeita silenciosamente origens não permitidas para evitar erro 500
  return callback(null, { origin: false });
};

app.use(cors(corsOptionsDelegate));
app.options('*', cors(corsOptionsDelegate));

/**
 * Middleware de segurança Helmet
 * Adiciona headers de segurança às respostas
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        workerSrc: ["'self'", 'blob:'],
      },
    },
  }),
);

/**
 * Parser de JSON com limite configurável
 * Aceita payloads de até 10MB
 */
// Captura raw body para validação HMAC do Mercado Pago somente no webhook
app.use(
  (express as any).json({
    limit: '10mb',
    verify: (req: any, _res: any, buf: Buffer) => {
      const url = (req as any).originalUrl || '';
      if (typeof url === 'string' && url.startsWith('/api/v1/mercadopago/assinaturas/webhook')) {
        (req as any).rawBody = buf.toString('utf8');
      }
    },
  }),
);

/**
 * Parser de dados URL-encoded
 * Para formulários HTML tradicionais
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Parser de cookies
 * Necessário para autenticação via cookies no Swagger
 */
app.use(cookieParser());

app.use(correlationIdMiddleware);
app.use(rateLimitMiddleware);

if (serverConfig.enableCompression) {
  app.use(compressionMiddleware);
}

// =============================================
// SWAGGER DOCS
// =============================================
setupSwagger(app);

// =============================================
// ROUTER PRINCIPAL
// =============================================

/**
 * Carrega todas as rotas através do router centralizado
 * Inclui automaticamente: usuários, brevo, health checks
 */
const routerLogger = bootstrapLogger.child({ context: 'RouterInit' });

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

try {
  app.use('/', appRoutes);
  routerLogger.info('✅ Router principal carregado com sucesso');
  if (!isTestEnv) {
    startExpiredUserCleanupJob();
    // Cron de reconciliação de assinaturas (habilitado via env)
    try {
      startAssinaturasReconJob();
      startBoletoWatcherJob();
      startBloqueiosWatcherJob();
      startEstagiosWatcherJob();
      startTurmasStatusWatcherJob();
      startCobrancaAutomaticaJob(); // Cobrança automática de cartões
      startAgendaCronJobs(); // Cron jobs de agenda (aulas, provas, entrevistas)
    } catch (e) {
      routerLogger.warn({ err: e }, '⚠️ Falha ao iniciar crons');
    }
  }
} catch (error) {
  routerLogger.error({ err: error }, '❌ Erro crítico ao carregar router principal');

  // Fallback mínimo em caso de erro crítico
  app.get('/', (req, res) => {
    res.status(503).json({
      message: 'API temporariamente indisponível',
      error: 'Falha na inicialização do router principal',
    });
  });

  app.get('/health', (req, res) => {
    res.status(503).json({
      status: 'UNHEALTHY',
      error: 'Router principal não carregado',
    });
  });
}

// =============================================
// TRATAMENTO DE ERROS GLOBAIS
// =============================================

/**
 * Catch-all para rotas não encontradas
 * Deve ser registrado após todas as outras rotas
 */
app.all('*', (req, res) => {
  res.status(404).json({
    message: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Middleware de tratamento de erros global
 * Captura qualquer erro não tratado na aplicação
 */
app.use(errorMiddleware);

// =============================================
// INICIALIZAÇÃO DO SERVIDOR
// =============================================

/**
 * Inicia o servidor HTTP na porta configurada
 */
let server: ReturnType<typeof app.listen> | null = null;
if (!isTestEnv) {
  server = app.listen(serverConfig.port, async () => {
    const startupLogger = bootstrapLogger.child({ context: 'ServerStart' });
    startupLogger.info(
      {
        baseUrl: `http://localhost:${serverConfig.port}`,
        environment: serverConfig.nodeEnv,
        startedAt: new Date().toISOString(),
      },
      '🚀 Advance+ API - Servidor iniciado',
    );

    if (process.env.REDIS_URL) {
      try {
        await redis.ping();
        startupLogger.info('🧠 Redis conectado');
      } catch (error) {
        startupLogger.error({ err: error }, '🧠 Redis indisponível');
      }
    } else {
      startupLogger.warn('🧠 Redis não configurado');
    }

    startupLogger.info(
      {
        endpoints: {
          health: `http://localhost:${serverConfig.port}/health`,
          usuarios: `http://localhost:${serverConfig.port}/api/v1/usuarios`,
          brevo: `http://localhost:${serverConfig.port}/api/v1/brevo`,
          website: `http://localhost:${serverConfig.port}/api/v1/website`,
          cursos: `http://localhost:${serverConfig.port}/api/v1/cursos`,
        },
      },
      '📋 Endpoints principais',
    );

    startupLogger.info(
      {
        commands: [
          `curl http://localhost:${serverConfig.port}/health`,
          `curl http://localhost:${serverConfig.port}/api/v1/brevo/health`,
        ],
      },
      '🧪 Testes rápidos',
    );

    // Inicia keep-alive para evitar hibernação da instância
    startKeepAlive();
  });
}

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

/**
 * Graceful shutdown em caso de SIGTERM (Docker, PM2, etc.)
 */
if (!isTestEnv && server) {
  process.on('SIGTERM', async () => {
    const shutdownLogger = bootstrapLogger.child({ context: 'Shutdown', signal: 'SIGTERM' });
    shutdownLogger.info('🔄 SIGTERM recebido, encerrando servidor graciosamente...');
    try {
      await prisma.$disconnect();
      shutdownLogger.info('🔌 Prisma desconectado');
    } catch (err) {
      shutdownLogger.error({ err }, 'Erro ao desconectar Prisma');
    }
    server?.close(() => {
      shutdownLogger.info('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });
}

/**
 * Graceful shutdown em caso de SIGINT (Ctrl+C)
 */
if (!isTestEnv && server) {
  process.on('SIGINT', async () => {
    const shutdownLogger = bootstrapLogger.child({ context: 'Shutdown', signal: 'SIGINT' });
    shutdownLogger.info('🔄 SIGINT recebido, encerrando servidor graciosamente...');
    try {
      await prisma.$disconnect();
      shutdownLogger.info('🔌 Prisma desconectado');
    } catch (err) {
      shutdownLogger.error({ err }, 'Erro ao desconectar Prisma');
    }
    server?.close(() => {
      shutdownLogger.info('✅ Servidor encerrado com sucesso');
      process.exit(0);
    });
  });
}

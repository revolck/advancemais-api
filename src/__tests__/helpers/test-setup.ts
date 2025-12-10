import express, { Express } from 'express';
import { appRoutes } from '@/routes';
import { errorMiddleware } from '@/middlewares/error';
import { correlationIdMiddleware } from '@/middlewares/correlation-id';
import { prisma } from '@/config/prisma';
import cookieParser from 'cookie-parser';

/**
 * Setup da aplicação Express para testes
 * Cria uma instância limpa do app sem inicializar o servidor
 */

let testApp: Express | null = null;

/**
 * Obtém a instância do app para testes
 */
export async function getTestApp(): Promise<Express> {
  if (testApp) {
    return testApp;
  }

  const app = express();

  // Middlewares básicos (mesmos do index.ts)
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(correlationIdMiddleware);

  // Rotas
  app.use('/', appRoutes);

  // Error handling (deve ser o último)
  app.use(errorMiddleware);

  testApp = app;
  return app;
}

/**
 * Setup global para testes
 */
export async function setupTestEnvironment(): Promise<void> {
  // Conectar ao banco
  await prisma.$connect();
}

/**
 * Teardown global para testes
 */
export async function teardownTestEnvironment(): Promise<void> {
  // Desconectar do banco
  await prisma.$disconnect();
}

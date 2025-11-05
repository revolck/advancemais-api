import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const healthLogger = logger.child({ module: 'DatabaseHealth' });

let lastHealthCheck: { healthy: boolean; timestamp: number; error?: string } = {
  healthy: false,
  timestamp: 0,
};

const HEALTH_CHECK_CACHE_MS = 5000; // Cache por 5 segundos

/**
 * Verifica a saúde da conexão com o banco de dados
 * @returns true se o banco está saudável, false caso contrário
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  // Retornar cache se ainda válido
  const now = Date.now();
  if (now - lastHealthCheck.timestamp < HEALTH_CHECK_CACHE_MS) {
    return lastHealthCheck.healthy;
  }

  try {
    // Query simples para testar conexão
    await prisma.$queryRaw`SELECT 1 as health_check`;

    lastHealthCheck = {
      healthy: true,
      timestamp: now,
    };

    return true;
  } catch (error: any) {
    healthLogger.warn(
      {
        error: error?.message,
        code: error?.code,
      },
      '⚠️ Database healthcheck falhou',
    );

    lastHealthCheck = {
      healthy: false,
      timestamp: now,
      error: error?.message,
    };

    return false;
  }
}

/**
 * Retorna o status completo do healthcheck
 */
export function getDatabaseHealthStatus() {
  return {
    ...lastHealthCheck,
    age: Date.now() - lastHealthCheck.timestamp,
  };
}

/**
 * Força uma nova verificação (ignora cache)
 */
export async function forceDatabaseHealthCheck(): Promise<boolean> {
  lastHealthCheck.timestamp = 0; // Invalida cache
  return checkDatabaseHealth();
}

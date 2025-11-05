import { prisma } from '@/config/prisma';
import { isPrismaConnectionError } from './prisma-errors';

/**
 * Verifica se o banco de dados está disponível com timeout (fail-fast)
 * @param timeoutMs - Timeout em milissegundos (padrão: 3s)
 * @returns true se disponível, false caso contrário
 */
export async function checkDatabaseConnection(timeoutMs = 3000): Promise<boolean> {
  try {
    // Tentar uma query simples para verificar conexão com timeout
    const queryPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Database connection check timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([queryPromise, timeoutPromise]);
    return true;
  } catch (error) {
    // Se for erro de conexão ou timeout, retornar false
    if (isPrismaConnectionError(error) || (error as Error)?.message?.includes('timeout')) {
      return false;
    }
    // Para outros erros, assumir que está disponível (pode ser erro de query)
    return true;
  }
}

/**
 * Verifica conexão e retorna erro se não disponível
 * @throws Error se o banco não estiver disponível
 */
export async function ensureDatabaseConnection(): Promise<void> {
  const isAvailable = await checkDatabaseConnection();
  if (!isAvailable) {
    throw new Error('Database connection not available');
  }
}


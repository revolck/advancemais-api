import { PrismaClientInitializationError } from '@prisma/client/runtime/library';

/**
 * Verifica se o erro é de conexão com o banco de dados
 * @param error - Erro a ser verificado
 * @returns true se for erro de conexão, false caso contrário
 */
export function isPrismaConnectionError(error: unknown): boolean {
  if (error instanceof PrismaClientInitializationError) {
    const message = error.message.toLowerCase();
    return (
      message.includes('tenant or user not found') ||
      message.includes('connection') ||
      message.includes('can\'t reach database') ||
      message.includes('fatal') ||
      message.includes('timeout') ||
      message.includes('econnrefused')
    );
  }
  return false;
}

/**
 * Trata erros de conexão do Prisma, logando como warning ao invés de error
 * @param error - Erro a ser tratado
 * @param logger - Logger para registrar o erro
 * @param context - Contexto adicional para o log
 * @returns true se foi erro de conexão (e foi tratado), false caso contrário
 */
export function handlePrismaConnectionError(
  error: unknown,
  logger: { warn: (data: any, message: string) => void },
  context?: string,
): boolean {
  if (isPrismaConnectionError(error)) {
    logger.warn(
      { err: error, context },
      '⚠️ Banco de dados não disponível, pulando operação',
    );
    return true;
  }
  return false;
}



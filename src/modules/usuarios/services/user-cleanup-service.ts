import { prisma } from '../../../config/prisma';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const cleanupLogger = logger.child({ module: 'UserCleanupService' });

/**
 * Remove usuários que não confirmaram o email e cujo token expirou.
 * @returns quantidade de registros removidos
 */
export async function deleteExpiredUnverifiedUsers(): Promise<number> {
  // Verificar conexão ANTES de tentar executar qualquer query
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    cleanupLogger.debug('Banco de dados não disponível, pulando limpeza de usuários expirados');
    return 0;
  }

  try {
    const result = await prisma.usuarios.deleteMany({
      where: {
        UsuariosVerificacaoEmail: {
          is: {
            emailVerificado: false,
            emailVerificationTokenExp: {
              lt: new Date(),
            },
          },
        },
      },
    });

    if (result.count > 0) {
      cleanupLogger.info(
        { removedCount: result.count },
        '🧹 Removidos usuários com verificação de email expirada',
      );
    }

    return result.count;
  } catch (error) {
    // Se for erro de conexão, apenas logar e retornar 0 (não falhar)
    if (handlePrismaConnectionError(error, cleanupLogger, 'deleteExpiredUnverifiedUsers')) {
      return 0;
    }

    // Para outros erros, re-lançar
    throw error;
  }
}

/**
 * Agenda verificação periódica para remoção de usuários expirados.
 * Aguarda 30s após inicialização (para Prisma conectar) e depois executa a cada hora.
 * Não executa em ambiente de teste ou desenvolvimento se o banco não estiver disponível.
 */
export function startExpiredUserCleanupJob(): void {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    cleanupLogger.debug('Test environment detectado, pulando job de limpeza');
    return;
  }

  const runCleanup = async () => {
    try {
      await deleteExpiredUnverifiedUsers();
    } catch (error) {
      // Tratar erros de conexão como warning, outros erros como error
      if (handlePrismaConnectionError(error, cleanupLogger, 'startExpiredUserCleanupJob')) {
        return; // Erro de conexão tratado, não precisa logar como error
      }

      // Para outros erros, logar como erro
      cleanupLogger.error({ err: error }, 'Erro ao remover usuários expirados');
    }
  };

  // ⏱️ AGUARDAR 30 segundos após inicialização (para Prisma conectar completamente)
  setTimeout(() => {
    cleanupLogger.info('🚀 Iniciando job de limpeza de usuários expirados');
    runCleanup(); // Primeira execução
    // Executa a cada hora
    setInterval(runCleanup, 60 * 60 * 1000);
  }, 30000); // 30 segundos
}

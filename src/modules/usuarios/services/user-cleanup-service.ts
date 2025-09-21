import { prisma } from '../../../config/prisma';
import { logger } from '@/utils/logger';

const cleanupLogger = logger.child({ module: 'UserCleanupService' });

/**
 * Remove usuários que não confirmaram o email e cujo token expirou.
 * @returns quantidade de registros removidos
 */
export async function deleteExpiredUnverifiedUsers(): Promise<number> {
  const result = await prisma.usuarios.deleteMany({
    where: {
      emailVerification: {
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
}

/**
 * Agenda verificação periódica para remoção de usuários expirados.
 * Executa imediatamente na inicialização e depois a cada hora.
 */
export function startExpiredUserCleanupJob(): void {
  const runCleanup = async () => {
    try {
      await deleteExpiredUnverifiedUsers();
    } catch (error) {
      cleanupLogger.error({ err: error }, 'Erro ao remover usuários expirados');
    }
  };

  // Executa uma vez na inicialização
  runCleanup();
  // Executa a cada hora
  setInterval(runCleanup, 60 * 60 * 1000);
}

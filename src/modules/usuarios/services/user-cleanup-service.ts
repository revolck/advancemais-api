import { prisma } from '../../../config/prisma';

/**
 * Remove usuários que não confirmaram o email e cujo token expirou.
 * @returns quantidade de registros removidos
 */
export async function deleteExpiredUnverifiedUsers(): Promise<number> {
  const result = await prisma.usuario.deleteMany({
    where: {
      emailVerificado: false,
      emailVerificationTokenExp: {
        lt: new Date(),
      },
    },
  });

  if (result.count > 0) {
    console.log(`🧹 Removidos ${result.count} usuários com verificação de email expirada`);
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
      console.error('Erro ao remover usuários expirados:', error);
    }
  };

  // Executa uma vez na inicialização
  runCleanup();
  // Executa a cada hora
  setInterval(runCleanup, 60 * 60 * 1000);
}

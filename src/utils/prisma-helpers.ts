import { randomUUID } from 'crypto';

/**
 * Adiciona campos obrigatórios faltantes em creates do Prisma
 */
export function addRequiredFields<T extends Record<string, any>>(
  data: T,
): T & { id?: string; atualizadoEm?: Date } {
  return {
    ...data,
    ...(data.id === undefined && { id: randomUUID() }),
    ...(data.atualizadoEm === undefined && { atualizadoEm: new Date() }),
  };
}



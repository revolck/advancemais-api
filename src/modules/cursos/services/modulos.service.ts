import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { moduloDetailedInclude, mapModulo } from './modulos.mapper';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const modulosLogger = logger.child({ module: 'CursosModulosService' });

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
): Promise<void> => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureModuloBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  moduloId: string,
): Promise<void> => {
  const modulo = await client.cursosTurmasModulos.findFirst({
    where: { id: moduloId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true },
  });

  if (!modulo) {
    const error = new Error('Módulo não encontrado para a turma informada');
    (error as any).code = 'MODULO_NOT_FOUND';
    throw error;
  }
};

const fetchModulo = async (client: PrismaClientOrTx, moduloId: string) => {
  const modulo = await client.cursosTurmasModulos.findUnique({
    where: { id: moduloId },
    ...moduloDetailedInclude,
  });

  if (!modulo) {
    const error = new Error('Módulo não encontrado');
    (error as any).code = 'MODULO_NOT_FOUND';
    throw error;
  }

  return mapModulo(modulo);
};

export const modulosService = {
  async list(cursoId: number, turmaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const modulos = await prisma.cursosTurmasModulos.findMany({
      where: { turmaId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      ...moduloDetailedInclude,
    });

    return modulos.map(mapModulo);
  },

  async get(cursoId: number, turmaId: string, moduloId: string) {
    await ensureModuloBelongsToTurma(prisma, cursoId, turmaId, moduloId);

    return fetchModulo(prisma, moduloId);
  },

  async create(
    cursoId: number,
    turmaId: string,
    data: {
      nome: string;
      descricao?: string | null;
      obrigatorio?: boolean;
      ordem?: number | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      const ordem = data.ordem ?? (await tx.cursosTurmasModulos.count({ where: { turmaId } })) + 1;

      const modulo = await tx.cursosTurmasModulos.create({
        data: {
          turmaId,
          nome: data.nome,
          descricao: data.descricao ?? null,
          obrigatorio: data.obrigatorio ?? true,
          ordem,
        },
      });

      modulosLogger.info({ turmaId, moduloId: modulo.id }, 'Módulo criado com sucesso');

      return fetchModulo(tx, modulo.id);
    });
  },

  async update(
    cursoId: number,
    turmaId: string,
    moduloId: string,
    data: {
      nome?: string;
      descricao?: string | null;
      obrigatorio?: boolean;
      ordem?: number | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureModuloBelongsToTurma(tx, cursoId, turmaId, moduloId);

      await tx.cursosTurmasModulos.update({
        where: { id: moduloId },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
          obrigatorio: data.obrigatorio ?? undefined,
          ordem: data.ordem ?? undefined,
        },
      });

      modulosLogger.info({ turmaId, moduloId }, 'Módulo atualizado com sucesso');

      return fetchModulo(tx, moduloId);
    });
  },

  async remove(cursoId: number, turmaId: string, moduloId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureModuloBelongsToTurma(tx, cursoId, turmaId, moduloId);

      await tx.cursosTurmasModulos.delete({ where: { id: moduloId } });

      modulosLogger.info({ turmaId, moduloId }, 'Módulo removido com sucesso');

      return { success: true } as const;
    });
  },
};

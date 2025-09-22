import { CursosMateriais, Prisma, TiposDeArquivos } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';

const aulasLogger = logger.child({ module: 'CursosAulasService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type AulaMaterialInput = {
  titulo: string;
  descricao?: string | null;
  tipo: CursosMateriais;
  tipoArquivo?: TiposDeArquivos | null;
  url?: string | null;
  duracaoEmSegundos?: number | null;
  tamanhoEmBytes?: number | null;
  ordem?: number | null;
};

type AulaInput = {
  moduloId?: string | null;
  nome?: string;
  descricao?: string | null;
  ordem?: number | null;
  materiais?: AulaMaterialInput[];
};

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

const ensureAulaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  aulaId: string,
): Promise<void> => {
  const aula = await client.cursosTurmasAulas.findFirst({
    where: {
      id: aulaId,
      turmaId,
      turma: { cursoId },
    },
    select: { id: true },
  });

  if (!aula) {
    const error = new Error('Aula não encontrada para a turma informada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }
};

const ensureModuloBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  moduloId: string,
): Promise<void> => {
  const modulo = await client.cursosTurmasModulos.findFirst({
    where: { id: moduloId, turmaId },
    select: { id: true },
  });

  if (!modulo) {
    const error = new Error('Módulo não encontrado para a turma informada');
    (error as any).code = 'MODULO_NOT_FOUND';
    throw error;
  }
};

const fetchAula = async (client: PrismaClientOrTx, aulaId: string): Promise<ReturnType<typeof mapAula>> => {
  const aula = await client.cursosTurmasAulas.findUnique({
    where: { id: aulaId },
    ...aulaWithMateriaisInclude,
  });

  if (!aula) {
    const error = new Error('Aula não encontrada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }

  return mapAula(aula as AulaWithMateriais);
};

const normalizeMaterialInput = (material: AulaMaterialInput) => ({
  titulo: material.titulo,
  descricao: material.descricao ?? null,
  tipo: material.tipo,
  tipoArquivo: material.tipoArquivo ?? null,
  url: material.url ?? null,
  duracaoEmSegundos: material.duracaoEmSegundos ?? null,
  tamanhoEmBytes: material.tamanhoEmBytes ?? null,
  ordem: material.ordem ?? 0,
});

export const aulasService = {
  async list(cursoId: number, turmaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const aulas = await prisma.cursosTurmasAulas.findMany({
      where: { turmaId },
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
      ...aulaWithMateriaisInclude,
    });

    return (aulas as AulaWithMateriais[]).map(mapAula);
  },

  async get(cursoId: number, turmaId: string, aulaId: string) {
    await ensureAulaBelongsToTurma(prisma, cursoId, turmaId, aulaId);

    return fetchAula(prisma, aulaId);
  },

  async create(cursoId: number, turmaId: string, data: AulaInput & { nome: string }) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const ordem = data.ordem ?? (await tx.cursosTurmasAulas.count({ where: { turmaId } })) + 1;

      const aula = await tx.cursosTurmasAulas.create({
        data: {
          turmaId,
          moduloId: data.moduloId ?? null,
          nome: data.nome,
          descricao: data.descricao ?? null,
          ordem,
        },
      });

      if (Array.isArray(data.materiais) && data.materiais.length > 0) {
        await tx.cursosTurmasAulasMateriais.createMany({
          data: data.materiais.map((material) => ({
            aulaId: aula.id,
            ...normalizeMaterialInput(material),
          })),
        });
      }

      aulasLogger.info({ turmaId, aulaId: aula.id }, 'Aula criada com sucesso');

      return fetchAula(tx, aula.id);
    });
  },

  async update(cursoId: number, turmaId: string, aulaId: string, data: AulaInput) {
    return prisma.$transaction(async (tx) => {
      await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      await tx.cursosTurmasAulas.update({
        where: { id: aulaId },
        data: {
          nome: data.nome ?? undefined,
          descricao: data.descricao ?? undefined,
          ordem: data.ordem ?? undefined,
          moduloId: data.moduloId ?? (data.moduloId === null ? null : undefined),
        },
      });

      if (Array.isArray(data.materiais)) {
        await tx.cursosTurmasAulasMateriais.deleteMany({ where: { aulaId } });

        if (data.materiais.length > 0) {
          await tx.cursosTurmasAulasMateriais.createMany({
            data: data.materiais.map((material) => ({
              aulaId,
              ...normalizeMaterialInput(material),
            })),
          });
        }
      }

      aulasLogger.info({ turmaId, aulaId }, 'Aula atualizada com sucesso');

      return fetchAula(tx, aulaId);
    });
  },

  async remove(cursoId: number, turmaId: string, aulaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureAulaBelongsToTurma(tx, cursoId, turmaId, aulaId);

      await tx.cursosTurmasAulas.delete({ where: { id: aulaId } });

      aulasLogger.info({ turmaId, aulaId }, 'Aula removida com sucesso');

      return { success: true } as const;
    });
  },
};

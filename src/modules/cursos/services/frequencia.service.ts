import { CursosFrequenciaStatus, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import {
  FrequenciaWithRelations,
  frequenciaWithRelations,
  mapFrequencia,
} from './frequencia.mapper';

const frequenciasLogger = logger.child({ module: 'CursosFrequenciaService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
) => {
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

const ensureMatriculaBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  matriculaId: string,
) => {
  const matricula = await client.cursosTurmasMatriculas.findFirst({
    where: { id: matriculaId, turmaId },
    select: { id: true },
  });

  if (!matricula) {
    const error = new Error('Matrícula não encontrada para a turma informada');
    (error as any).code = 'MATRICULA_NOT_FOUND';
    throw error;
  }
};

const ensureAulaBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  aulaId: string,
) => {
  const aula = await client.cursosTurmasAulas.findFirst({
    where: { id: aulaId, turmaId },
    select: { id: true },
  });

  if (!aula) {
    const error = new Error('Aula não encontrada para a turma informada');
    (error as any).code = 'AULA_NOT_FOUND';
    throw error;
  }
};

const ensureFrequenciaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  frequenciaId: string,
) => {
  const frequencia = await client.cursosFrequenciaAlunos.findFirst({
    where: { id: frequenciaId, turmaId, turma: { cursoId } },
    select: {
      id: true,
      turmaId: true,
      matriculaId: true,
      status: true,
      aulaId: true,
      justificativa: true,
    },
  });

  if (!frequencia) {
    const error = new Error('Registro de frequência não encontrado para a turma informada');
    (error as any).code = 'FREQUENCIA_NOT_FOUND';
    throw error;
  }

  return frequencia;
};

const normalizeNullable = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureJustificativaWhenRequired = (
  status: CursosFrequenciaStatus,
  justificativa?: string | null,
) => {
  if (status === CursosFrequenciaStatus.JUSTIFICADO) {
    const normalized = justificativa?.trim() ?? '';
    if (!normalized) {
      const error = new Error('Justificativa é obrigatória para registros justificados');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
  }
};

export const frequenciaService = {
  async list(
    cursoId: number,
    turmaId: string,
    filters: {
      matriculaId?: string;
      aulaId?: string;
      status?: CursosFrequenciaStatus;
      dataInicio?: Date;
      dataFim?: Date;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    if (filters.matriculaId) {
      await ensureMatriculaBelongsToTurma(prisma, turmaId, filters.matriculaId);
    }

    if (filters.aulaId) {
      await ensureAulaBelongsToTurma(prisma, turmaId, filters.aulaId);
    }

    const where: Prisma.CursosFrequenciaAlunosWhereInput = {
      turmaId,
      turma: { cursoId },
      matriculaId: filters.matriculaId ?? undefined,
      aulaId: filters.aulaId ?? undefined,
      status: filters.status ?? undefined,
    };

    if (filters.dataInicio || filters.dataFim) {
      where.dataReferencia = {
        gte: filters.dataInicio ?? undefined,
        lte: filters.dataFim ?? undefined,
      };
    }

    const frequencias = await prisma.cursosFrequenciaAlunos.findMany({
      where,
      orderBy: [
        { dataReferencia: 'desc' },
        { criadoEm: 'desc' },
      ],
      ...frequenciaWithRelations,
    });

    return frequencias.map(mapFrequencia);
  },

  async get(cursoId: number, turmaId: string, frequenciaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const frequencia = await prisma.cursosFrequenciaAlunos.findFirst({
      where: { id: frequenciaId, turmaId, turma: { cursoId } },
      ...frequenciaWithRelations,
    });

    if (!frequencia) {
      const error = new Error('Registro de frequência não encontrado para a turma informada');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    return mapFrequencia(frequencia);
  },

  async create(
    cursoId: number,
    turmaId: string,
    data: {
      matriculaId: string;
      aulaId?: string | null;
      dataReferencia?: Date;
      status: CursosFrequenciaStatus;
      justificativa?: string | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureMatriculaBelongsToTurma(tx, turmaId, data.matriculaId);

      if (data.aulaId) {
        await ensureAulaBelongsToTurma(tx, turmaId, data.aulaId);
      }

      ensureJustificativaWhenRequired(data.status, data.justificativa);

      try {
        const frequencia = (await tx.cursosFrequenciaAlunos.create({
          data: {
            turmaId,
            matriculaId: data.matriculaId,
            aulaId: data.aulaId ?? null,
            dataReferencia: data.dataReferencia ?? new Date(),
            status: data.status,
            justificativa: normalizeNullable(data.justificativa),
            observacoes: normalizeNullable(data.observacoes),
          },
          ...frequenciaWithRelations,
        })) as FrequenciaWithRelations;

        frequenciasLogger.info(
          { turmaId, frequenciaId: frequencia.id },
          'Frequência registrada para matrícula',
        );

        return mapFrequencia(frequencia);
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const duplicated = new Error('Já existe uma frequência registrada para esta combinação');
          (duplicated as any).code = 'DUPLICATE_FREQUENCIA';
          throw duplicated;
        }

        throw error;
      }
    });
  },

  async update(
    cursoId: number,
    turmaId: string,
    frequenciaId: string,
    data: {
      aulaId?: string | null;
      dataReferencia?: Date | null;
      status?: CursosFrequenciaStatus;
      justificativa?: string | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const frequenciaAtual = await ensureFrequenciaBelongsToTurma(tx, cursoId, turmaId, frequenciaId);

      if (data.aulaId !== undefined && data.aulaId !== null) {
        await ensureAulaBelongsToTurma(tx, turmaId, data.aulaId);
      }

      const statusFinal = data.status ?? frequenciaAtual.status;

      const justificativaFinal =
        data.justificativa !== undefined ? data.justificativa : frequenciaAtual.justificativa;

      ensureJustificativaWhenRequired(statusFinal, justificativaFinal);

      const frequencia = (await tx.cursosFrequenciaAlunos.update({
        where: { id: frequenciaId },
        data: {
          aulaId:
            data.aulaId !== undefined
              ? data.aulaId
                ? data.aulaId
                : null
              : undefined,
          dataReferencia: data.dataReferencia ?? undefined,
          status: data.status ?? undefined,
          justificativa: normalizeNullable(data.justificativa),
          observacoes: normalizeNullable(data.observacoes),
        },
        ...frequenciaWithRelations,
      })) as FrequenciaWithRelations;

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência atualizada');

      return mapFrequencia(frequencia);
    });
  },

  async remove(cursoId: number, turmaId: string, frequenciaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureFrequenciaBelongsToTurma(tx, cursoId, turmaId, frequenciaId);

      await tx.cursosFrequenciaAlunos.delete({ where: { id: frequenciaId } });

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência removida');

      return { success: true } as const;
    });
  },

  async listByMatricula(
    matriculaId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const matricula = await prisma.cursosTurmasMatriculas.findUnique({
      where: { id: matriculaId },
      include: {
        aluno: { select: { id: true, nomeCompleto: true, email: true } },
        turma: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            curso: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!matricula) {
      const error = new Error('Matrícula não encontrada');
      (error as any).code = 'MATRICULA_NOT_FOUND';
      throw error;
    }

    if (requesterId && matricula.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const frequencias = await prisma.cursosFrequenciaAlunos.findMany({
      where: { matriculaId },
      orderBy: [
        { dataReferencia: 'desc' },
        { criadoEm: 'desc' },
      ],
      ...frequenciaWithRelations,
    });

    return {
      matricula: {
        id: matricula.id,
        aluno: {
          id: matricula.aluno.id,
          nome: matricula.aluno.nomeCompleto,
          email: matricula.aluno.email,
        },
      },
      curso: {
        id: matricula.turma.curso.id,
        nome: matricula.turma.curso.nome,
      },
      turma: {
        id: matricula.turma.id,
        nome: matricula.turma.nome,
        codigo: matricula.turma.codigo,
      },
      frequencias: frequencias.map(mapFrequencia),
    };
  },
};

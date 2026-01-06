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
  cursoId: string,
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

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
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
  cursoId: string,
  turmaId: string,
  frequenciaId: string,
) => {
  const frequencia = await client.cursosFrequenciaAlunos.findFirst({
    where: { id: frequenciaId, turmaId, CursosTurmas: { cursoId } },
    select: {
      id: true,
      turmaId: true,
      inscricaoId: true,
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
    cursoId: string,
    turmaId: string,
    filters: {
      inscricaoId?: string;
      aulaId?: string;
      status?: CursosFrequenciaStatus;
      dataInicio?: Date;
      dataFim?: Date;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    if (filters.inscricaoId) {
      await ensureInscricaoBelongsToTurma(prisma, turmaId, filters.inscricaoId);
    }

    if (filters.aulaId) {
      await ensureAulaBelongsToTurma(prisma, turmaId, filters.aulaId);
    }

    const where: Prisma.CursosFrequenciaAlunosWhereInput = {
      turmaId,
      CursosTurmas: { cursoId },
      inscricaoId: filters.inscricaoId ?? undefined,
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
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: frequenciaWithRelations.include,
    });

    return frequencias.map(mapFrequencia);
  },

  async get(cursoId: string, turmaId: string, frequenciaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const frequencia = await prisma.cursosFrequenciaAlunos.findFirst({
      where: { id: frequenciaId, turmaId, CursosTurmas: { cursoId } },
      include: frequenciaWithRelations.include,
    });

    if (!frequencia) {
      const error = new Error('Registro de frequência não encontrado para a turma informada');
      (error as any).code = 'FREQUENCIA_NOT_FOUND';
      throw error;
    }

    return mapFrequencia(frequencia);
  },

  async create(
    cursoId: string,
    turmaId: string,
    data: {
      inscricaoId: string;
      aulaId?: string | null;
      dataReferencia?: Date;
      status: CursosFrequenciaStatus;
      justificativa?: string | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, data.inscricaoId);

      if (data.aulaId) {
        await ensureAulaBelongsToTurma(tx, turmaId, data.aulaId);
      }

      ensureJustificativaWhenRequired(data.status, data.justificativa);

      try {
        const frequencia = (await tx.cursosFrequenciaAlunos.create({
          data: {
            turmaId,
            inscricaoId: data.inscricaoId,
            aulaId: data.aulaId ?? null,
            dataReferencia: data.dataReferencia ?? new Date(),
            status: data.status,
            justificativa: normalizeNullable(data.justificativa),
            observacoes: normalizeNullable(data.observacoes),
          },
          include: frequenciaWithRelations.include,
        })) as FrequenciaWithRelations;

        frequenciasLogger.info(
          { turmaId, frequenciaId: frequencia.id },
          'Frequência registrada para inscrição',
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
    cursoId: string,
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
      const frequenciaAtual = await ensureFrequenciaBelongsToTurma(
        tx,
        cursoId,
        turmaId,
        frequenciaId,
      );

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
          aulaId: data.aulaId !== undefined ? (data.aulaId ? data.aulaId : null) : undefined,
          dataReferencia: data.dataReferencia ?? undefined,
          status: data.status ?? undefined,
          justificativa: normalizeNullable(data.justificativa),
          observacoes: normalizeNullable(data.observacoes),
        },
        include: frequenciaWithRelations.include,
      })) as FrequenciaWithRelations;

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência atualizada');

      return mapFrequencia(frequencia);
    });
  },

  async remove(cursoId: string, turmaId: string, frequenciaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureFrequenciaBelongsToTurma(tx, cursoId, turmaId, frequenciaId);

      await tx.cursosFrequenciaAlunos.delete({ where: { id: frequenciaId } });

      frequenciasLogger.info({ turmaId, frequenciaId }, 'Frequência removida');

      return { success: true } as const;
    });
  },

  async listByInscricao(
    inscricaoId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      include: {
        Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            Cursos: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada');
      (error as any).code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    if (requesterId && inscricao.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const frequencias = await prisma.cursosFrequenciaAlunos.findMany({
      where: { inscricaoId },
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: frequenciaWithRelations.include,
    });

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.Usuarios.id,
          nome: inscricao.Usuarios.nomeCompleto,
          email: inscricao.Usuarios.email,
        },
      },
      curso: {
        id: inscricao.CursosTurmas.Cursos.id,
        nome: inscricao.CursosTurmas.Cursos.nome,
      },
      turma: {
        id: inscricao.CursosTurmas.id,
        nome: inscricao.CursosTurmas.nome,
        codigo: inscricao.CursosTurmas.codigo,
      },
      frequencias: frequencias.map(mapFrequencia),
    };
  },

  /**
   * Retorna resumo de frequência por aluno para uma turma
   * Query params: periodo (TOTAL|DIA|SEMANA|MES), anchorDate (YYYY-MM-DD), search, page, pageSize
   */
  async resumo(
    cursoId: string,
    turmaId: string,
    filters: {
      periodo?: 'TOTAL' | 'DIA' | 'SEMANA' | 'MES';
      anchorDate?: Date;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const { periodo = 'TOTAL', anchorDate = new Date(), search, page = 1, pageSize = 10 } = filters;

    // Calcular intervalo de datas baseado no período
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    if (periodo !== 'TOTAL') {
      const anchor = new Date(anchorDate);
      anchor.setHours(0, 0, 0, 0);

      switch (periodo) {
        case 'DIA':
          dataInicio = new Date(anchor);
          dataFim = new Date(anchor);
          dataFim.setHours(23, 59, 59, 999);
          break;
        case 'SEMANA': {
          const dayOfWeek = anchor.getDay();
          dataInicio = new Date(anchor);
          dataInicio.setDate(anchor.getDate() - dayOfWeek);
          dataFim = new Date(dataInicio);
          dataFim.setDate(dataInicio.getDate() + 6);
          dataFim.setHours(23, 59, 59, 999);
          break;
        }
        case 'MES':
          dataInicio = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
          dataFim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
          dataFim.setHours(23, 59, 59, 999);
          break;
      }
    }

    // Buscar total de aulas no período
    const totalAulasNoPeriodo = await prisma.cursosTurmasAulas.count({
      where: {
        turmaId,
        deletedAt: null,
        ...(dataInicio && dataFim
          ? {
              OR: [
                { dataInicio: { gte: dataInicio, lte: dataFim } },
                { dataFim: { gte: dataInicio, lte: dataFim } },
              ],
            }
          : {}),
      },
    });

    // Buscar inscrições da turma com filtro de busca
    const inscricoesWhere: Prisma.CursosTurmasInscricoesWhereInput = {
      turmaId,
      status: { in: ['INSCRITO', 'EM_ANDAMENTO', 'EM_ESTAGIO'] },
      ...(search
        ? {
            Usuarios: {
              OR: [
                { nomeCompleto: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    };

    const [totalInscricoes, inscricoes] = await Promise.all([
      prisma.cursosTurmasInscricoes.count({ where: inscricoesWhere }),
      prisma.cursosTurmasInscricoes.findMany({
        where: inscricoesWhere,
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              UsuariosInformation: { select: { inscricao: true } },
            },
          },
        },
        orderBy: { Usuarios: { nomeCompleto: 'asc' } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Para cada inscrição, buscar contagens de frequência
    // Nota: O enum CursosFrequenciaStatus tem: PRESENTE, AUSENTE, JUSTIFICADO, ATRASADO
    const items = await Promise.all(
      inscricoes.map(async (inscricao) => {
        const frequenciaWhere: Prisma.CursosFrequenciaAlunosWhereInput = {
          inscricaoId: inscricao.id,
          turmaId,
          ...(dataInicio && dataFim ? { dataReferencia: { gte: dataInicio, lte: dataFim } } : {}),
        };

        const [presencas, ausencias, atrasados, justificadas] = await Promise.all([
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.PRESENTE },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.AUSENTE },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.ATRASADO },
          }),
          prisma.cursosFrequenciaAlunos.count({
            where: { ...frequenciaWhere, status: CursosFrequenciaStatus.JUSTIFICADO },
          }),
        ]);

        const totalAulas = presencas + ausencias + atrasados + justificadas;
        const taxaPresencaPct =
          totalAulas > 0 ? Math.round(((presencas + atrasados) / totalAulas) * 100) : 0;

        return {
          alunoId: inscricao.Usuarios.id,
          alunoNome: inscricao.Usuarios.nomeCompleto,
          alunoCodigo: inscricao.Usuarios.UsuariosInformation?.inscricao ?? null,
          totalAulas,
          presencas,
          ausencias,
          atrasados,
          justificadas,
          taxaPresencaPct,
        };
      }),
    );

    return {
      totalAulasNoPeriodo,
      items,
      pagination: {
        page,
        pageSize,
        total: totalInscricoes,
        totalPages: Math.ceil(totalInscricoes / pageSize),
      },
    };
  },
};

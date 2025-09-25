import { CursosAgendaTipo, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { agendaWithRelations, mapAgendaItem } from './agenda.mapper';

const agendaLogger = logger.child({ module: 'CursosAgendaService' });

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

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  provaId: string,
) => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId },
    select: { id: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }
};

const ensureAgendaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  agendaId: string,
) => {
  const agenda = await client.cursosTurmasAgenda.findFirst({
    where: { id: agendaId, turmaId, turma: { cursoId } },
    select: {
      id: true,
      turmaId: true,
      tipo: true,
      titulo: true,
      descricao: true,
      inicio: true,
      fim: true,
      aulaId: true,
      provaId: true,
    },
  });

  if (!agenda) {
    const error = new Error('Evento de agenda não encontrado para a turma informada');
    (error as any).code = 'AGENDA_NOT_FOUND';
    throw error;
  }

  return agenda;
};

const normalizeNullableString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const validateDateRange = (inicio: Date, fim?: Date | null) => {
  if (fim && fim.getTime() < inicio.getTime()) {
    const error = new Error('Data de término não pode ser anterior à data de início');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }
};

const ensureReferenceConsistency = async (
  client: PrismaClientOrTx,
  turmaId: string,
  tipo: CursosAgendaTipo,
  aulaId?: string | null,
  provaId?: string | null,
) => {
  if (tipo === CursosAgendaTipo.AULA) {
    if (!aulaId) {
      const error = new Error('Aula é obrigatória para eventos do tipo AULA');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
    await ensureAulaBelongsToTurma(client, turmaId, aulaId);
    if (provaId) {
      const error = new Error('Não é permitido vincular prova em eventos do tipo AULA');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
    return;
  }

  if (tipo === CursosAgendaTipo.PROVA) {
    if (!provaId) {
      const error = new Error('Prova é obrigatória para eventos do tipo PROVA');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
    await ensureProvaBelongsToTurma(client, turmaId, provaId);
    if (aulaId) {
      const error = new Error('Não é permitido vincular aula em eventos do tipo PROVA');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }
    return;
  }

  if (aulaId || provaId) {
    const error = new Error(`Eventos do tipo ${tipo} não podem referenciar aulas ou provas`);
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }
};

const applyDateFilters = (filters: {
  dataInicio?: Date;
  dataFim?: Date;
  apenasFuturos?: boolean;
}) => {
  let gte = filters.dataInicio;
  if (filters.apenasFuturos) {
    const now = new Date();
    gte = gte ? (gte.getTime() > now.getTime() ? gte : now) : now;
  }

  const lte = filters.dataFim;

  if (!gte && !lte) {
    return undefined;
  }

  return {
    gte: gte ?? undefined,
    lte: lte ?? undefined,
  } satisfies Prisma.DateTimeFilter;
};

export const agendaService = {
  async list(
    cursoId: number,
    turmaId: string,
    filters: {
      tipo?: CursosAgendaTipo;
      dataInicio?: Date;
      dataFim?: Date;
      apenasFuturos?: boolean;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const where: Prisma.CursosTurmasAgendaWhereInput = {
      turmaId,
      turma: { cursoId },
      tipo: filters.tipo ?? undefined,
    };

    const dataFilter = applyDateFilters(filters);
    if (dataFilter) {
      where.inicio = dataFilter;
    }

    const eventos = await prisma.cursosTurmasAgenda.findMany({
      where,
      orderBy: [{ inicio: 'asc' }, { criadoEm: 'asc' }],
      ...agendaWithRelations,
    });

    return eventos.map(mapAgendaItem);
  },

  async get(cursoId: number, turmaId: string, agendaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const evento = await prisma.cursosTurmasAgenda.findFirst({
      where: { id: agendaId, turmaId, turma: { cursoId } },
      ...agendaWithRelations,
    });

    if (!evento) {
      const error = new Error('Evento de agenda não encontrado para a turma informada');
      (error as any).code = 'AGENDA_NOT_FOUND';
      throw error;
    }

    return mapAgendaItem(evento);
  },

  async create(
    cursoId: number,
    turmaId: string,
    data: {
      tipo: CursosAgendaTipo;
      titulo: string;
      descricao?: string | null;
      inicio: Date;
      fim?: Date | null;
      aulaId?: string | null;
      provaId?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      const titulo = data.titulo.trim();
      if (!titulo) {
        const error = new Error('Título é obrigatório');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      validateDateRange(data.inicio, data.fim ?? null);
      await ensureReferenceConsistency(
        tx,
        turmaId,
        data.tipo,
        data.aulaId ?? null,
        data.provaId ?? null,
      );

      const evento = await tx.cursosTurmasAgenda.create({
        data: {
          turmaId,
          tipo: data.tipo,
          titulo,
          descricao: normalizeNullableString(data.descricao) ?? null,
          inicio: data.inicio,
          fim: data.fim ?? null,
          aulaId: data.aulaId ?? null,
          provaId: data.provaId ?? null,
        },
        ...agendaWithRelations,
      });

      agendaLogger.info({ turmaId, agendaId: evento.id }, 'Evento de agenda criado com sucesso');

      return mapAgendaItem(evento);
    });
  },

  async update(
    cursoId: number,
    turmaId: string,
    agendaId: string,
    data: {
      tipo?: CursosAgendaTipo;
      titulo?: string;
      descricao?: string | null;
      inicio?: Date;
      fim?: Date | null;
      aulaId?: string | null;
      provaId?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const agenda = await ensureAgendaBelongsToTurma(tx, cursoId, turmaId, agendaId);

      const tipo = data.tipo ?? agenda.tipo;
      const titulo = data.titulo !== undefined ? data.titulo.trim() : agenda.titulo;
      const descricao =
        data.descricao !== undefined ? normalizeNullableString(data.descricao) : agenda.descricao;
      const inicio = data.inicio ?? agenda.inicio;
      const fim = data.fim !== undefined ? data.fim : agenda.fim;
      const aulaId = data.aulaId !== undefined ? data.aulaId : agenda.aulaId;
      const provaId = data.provaId !== undefined ? data.provaId : agenda.provaId;

      if (!titulo) {
        const error = new Error('Título é obrigatório');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      validateDateRange(inicio, fim ?? null);
      await ensureReferenceConsistency(tx, turmaId, tipo, aulaId ?? null, provaId ?? null);

      await tx.cursosTurmasAgenda.update({
        where: { id: agendaId },
        data: {
          tipo,
          titulo,
          descricao,
          inicio,
          fim: fim ?? null,
          aulaId: aulaId ?? null,
          provaId: provaId ?? null,
        },
      });

      const atualizado = await tx.cursosTurmasAgenda.findUnique({
        where: { id: agendaId },
        ...agendaWithRelations,
      });

      if (!atualizado) {
        const error = new Error('Evento de agenda não encontrado após atualização');
        (error as any).code = 'AGENDA_NOT_FOUND';
        throw error;
      }

      agendaLogger.info({ turmaId, agendaId }, 'Evento de agenda atualizado com sucesso');

      return mapAgendaItem(atualizado);
    });
  },

  async delete(cursoId: number, turmaId: string, agendaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureAgendaBelongsToTurma(tx, cursoId, turmaId, agendaId);

      await tx.cursosTurmasAgenda.delete({ where: { id: agendaId } });

      agendaLogger.info({ turmaId, agendaId }, 'Evento de agenda removido');
    });
  },

  async listMy(
    alunoId: string,
    filters: {
      tipo?: CursosAgendaTipo;
      dataInicio?: Date;
      dataFim?: Date;
      apenasFuturos?: boolean;
      turmaId?: string;
    } = {},
  ) {
    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: { alunoId },
      select: {
        id: true,
        turmaId: true,
      },
    });

    if (inscricoes.length === 0) {
      return [];
    }

    let turmaIds = inscricoes.map((inscricao) => inscricao.turmaId);

    if (filters.turmaId) {
      if (!turmaIds.includes(filters.turmaId)) {
        const error = new Error('Aluno não está inscrito na turma informada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }
      turmaIds = [filters.turmaId];
    }

    const where: Prisma.CursosTurmasAgendaWhereInput = {
      turmaId: { in: turmaIds },
      tipo: filters.tipo ?? undefined,
    };

    const dataFilter = applyDateFilters(filters);
    if (dataFilter) {
      where.inicio = dataFilter;
    }

    const eventos = await prisma.cursosTurmasAgenda.findMany({
      where,
      orderBy: [{ inicio: 'asc' }, { criadoEm: 'asc' }],
      ...agendaWithRelations,
    });

    const inscricaoPorTurma = new Map(
      inscricoes.map((inscricao) => [inscricao.turmaId, inscricao.id]),
    );

    return eventos.map((evento) => ({
      ...mapAgendaItem(evento),
      inscricaoId: inscricaoPorTurma.get(evento.turmaId) ?? null,
    }));
  },
};

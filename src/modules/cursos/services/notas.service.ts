import { CursosNotasTipo, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { mapNota, NotaWithRelations, notaWithRelations } from './notas.mapper';

const notasLogger = logger.child({ module: 'CursosNotasService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const ensureTurmaBelongsToCurso = async (client: PrismaClientOrTx, cursoId: number, turmaId: string) => {
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

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  provaId: string,
) => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, turma: { cursoId } },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      peso: true,
    },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  return prova;
};

const ensureNotaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  notaId: string,
) => {
  const nota = await client.cursosNotas.findFirst({
    where: { id: notaId, turmaId, turma: { cursoId } },
    select: { id: true, inscricaoId: true, tipo: true, provaId: true, titulo: true },
  });

  if (!nota) {
    const error = new Error('Nota não encontrada para a turma informada');
    (error as any).code = 'NOTA_NOT_FOUND';
    throw error;
  }

  return nota;
};

const toDecimal = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  return new Prisma.Decimal(value);
};

const toDecimalOptional = (value: number | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Prisma.Decimal(value);
};

export const notasService = {
  async list(
    cursoId: number,
    turmaId: string,
    filters: {
      inscricaoId?: string;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const notas = await prisma.cursosNotas.findMany({
      where: {
        turmaId,
        turma: { cursoId },
        inscricaoId: filters.inscricaoId ?? undefined,
      },
      orderBy: [
        { dataReferencia: 'desc' },
        { criadoEm: 'desc' },
      ],
      ...notaWithRelations,
    });

    return notas.map(mapNota);
  },

  async get(cursoId: number, turmaId: string, notaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const nota = await prisma.cursosNotas.findFirst({
      where: { id: notaId, turmaId, turma: { cursoId } },
      ...notaWithRelations,
    });

    if (!nota) {
      const error = new Error('Nota não encontrada para a turma informada');
      (error as any).code = 'NOTA_NOT_FOUND';
      throw error;
    }

    return mapNota(nota);
  },

  async create(
    cursoId: number,
    turmaId: string,
    data: {
      inscricaoId: string;
      tipo: CursosNotasTipo;
      provaId?: string | null;
      referenciaExterna?: string | null;
      titulo?: string | null;
      descricao?: string | null;
      nota?: number | null;
      peso?: number | null;
      valorMaximo?: number | null;
      dataReferencia?: Date | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, data.inscricaoId);

      const prova =
        data.tipo === CursosNotasTipo.PROVA && data.provaId
          ? await ensureProvaBelongsToTurma(tx, cursoId, turmaId, data.provaId)
          : null;

      const titulo = data.tipo === CursosNotasTipo.PROVA && prova ? prova.titulo : data.titulo ?? null;

      if (!titulo) {
        const error = new Error('Título da nota é obrigatório');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      const nota = await tx.cursosNotas.create({
        data: {
          turmaId,
          inscricaoId: data.inscricaoId,
          tipo: data.tipo,
          provaId: prova?.id ?? null,
          referenciaExterna: data.referenciaExterna ?? null,
          titulo,
          descricao:
            data.tipo === CursosNotasTipo.PROVA && prova
              ? prova.descricao ?? null
              : data.descricao ?? null,
          nota: toDecimal(data.nota ?? null),
          peso: toDecimal(data.peso ?? (prova ? Number(prova.peso) : null)),
          valorMaximo: toDecimal(data.valorMaximo ?? null),
          dataReferencia: data.dataReferencia ?? new Date(),
          observacoes: data.observacoes ?? null,
        },
        ...notaWithRelations,
      });

      notasLogger.info({ turmaId, notaId: nota.id }, 'Nota criada para inscrição');

      return mapNota(nota);
    });
  },

  async update(
    cursoId: number,
    turmaId: string,
    notaId: string,
    data: {
      tipo?: CursosNotasTipo;
      provaId?: string | null;
      referenciaExterna?: string | null;
      titulo?: string | null;
      descricao?: string | null;
      nota?: number | null;
      peso?: number | null;
      valorMaximo?: number | null;
      dataReferencia?: Date | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const notaAtual = await ensureNotaBelongsToTurma(tx, cursoId, turmaId, notaId);

      let prova = null;
      if (data.provaId) {
        prova = await ensureProvaBelongsToTurma(tx, cursoId, turmaId, data.provaId);
      }

      const isProvaAfterUpdate =
        data.tipo === CursosNotasTipo.PROVA ||
        (data.tipo === undefined && notaAtual.tipo === CursosNotasTipo.PROVA);

      const tituloDerivadoDaProva = isProvaAfterUpdate
        ? prova?.titulo ?? (notaAtual.tipo === CursosNotasTipo.PROVA ? notaAtual.titulo : undefined)
        : undefined;

      let tituloParaAtualizar: string | undefined;
      if (data.titulo !== undefined) {
        const tituloInformado = data.titulo?.trim() ?? '';

        if (tituloInformado.length > 0) {
          tituloParaAtualizar = tituloInformado;
        } else if (tituloDerivadoDaProva) {
          tituloParaAtualizar = tituloDerivadoDaProva;
        } else if (notaAtual.titulo) {
          tituloParaAtualizar = notaAtual.titulo;
        } else {
          const error = new Error('Título da nota é obrigatório');
          (error as any).code = 'VALIDATION_ERROR';
          throw error;
        }
      } else if (tituloDerivadoDaProva) {
        tituloParaAtualizar = tituloDerivadoDaProva;
      }

      if (data.tipo === CursosNotasTipo.PROVA && !data.provaId && !notaAtual.provaId) {
        const error = new Error('provaId é obrigatório para notas de prova');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      if (
        (data.tipo === CursosNotasTipo.PROVA || notaAtual.tipo === CursosNotasTipo.PROVA) &&
        data.provaId === null
      ) {
        const error = new Error('provaId não pode ser removido para notas de prova');
        (error as any).code = 'VALIDATION_ERROR';
        throw error;
      }

      const nota = (await tx.cursosNotas.update({
        where: { id: notaId },
        data: {
          tipo: data.tipo ?? undefined,
          provaId:
            data.provaId !== undefined
              ? data.provaId
                ? data.provaId
                : null
              : undefined,
          referenciaExterna: data.referenciaExterna ?? undefined,
          titulo: tituloParaAtualizar,
          descricao:
            data.descricao !== undefined
              ? data.descricao
              : prova
                ? prova.descricao ?? null
                : undefined,
          nota: toDecimalOptional(data.nota),
          peso: toDecimalOptional(
            data.peso !== undefined ? data.peso : prova ? Number(prova.peso) : undefined,
          ),
          valorMaximo: toDecimalOptional(data.valorMaximo),
          dataReferencia: data.dataReferencia ?? undefined,
          observacoes: data.observacoes ?? undefined,
        },
        ...notaWithRelations,
      })) as NotaWithRelations;

      notasLogger.info({ turmaId, notaId }, 'Nota atualizada');

      return mapNota(nota);
    });
  },

  async remove(cursoId: number, turmaId: string, notaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureNotaBelongsToTurma(tx, cursoId, turmaId, notaId);

      await tx.cursosNotas.delete({ where: { id: notaId } });

      notasLogger.info({ turmaId, notaId }, 'Nota removida');

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

    const notas = await prisma.cursosNotas.findMany({
      where: { inscricaoId },
      orderBy: [
        { dataReferencia: 'desc' },
        { criadoEm: 'desc' },
      ],
      ...notaWithRelations,
    });

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.aluno.id,
          nome: inscricao.aluno.nomeCompleto,
          email: inscricao.aluno.email,
        },
      },
      curso: {
        id: inscricao.turma.curso.id,
        nome: inscricao.turma.curso.nome,
      },
      turma: {
        id: inscricao.turma.id,
        nome: inscricao.turma.nome,
        codigo: inscricao.turma.codigo,
      },
      notas: notas.map(mapNota),
    };
  },
};

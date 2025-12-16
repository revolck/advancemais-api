import { Prisma, CursosLocalProva, CursosNotasTipo } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { mapProva, provaDefaultInclude, provaWithEnviosInclude } from './provas.mapper';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const provasLogger = logger.child({ module: 'CursosProvasService' });

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
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

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }
};

const fetchProva = async (client: PrismaClientOrTx, provaId: string) => {
  const prova = await client.cursosTurmasProvas.findUnique({
    where: { id: provaId },
    ...provaWithEnviosInclude,
  });

  if (!prova) {
    const error = new Error('Prova não encontrada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  return mapProva(prova);
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

export const provasService = {
  async list(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const provas = await prisma.cursosTurmasProvas.findMany({
      where: { turmaId },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      ...provaWithEnviosInclude,
    });

    return provas.map(mapProva);
  },

  async get(cursoId: string, turmaId: string, provaId: string) {
    await ensureProvaBelongsToTurma(prisma, cursoId, turmaId, provaId);

    return fetchProva(prisma, provaId);
  },

  async create(
    cursoId: string,
    turmaId: string,
    data: {
      titulo: string;
      etiqueta: string;
      descricao?: string | null;
      peso: number;
      valePonto?: boolean;
      moduloId?: string | null;
      ativo?: boolean;
      ordem?: number | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const ordem = data.ordem ?? (await tx.cursosTurmasProvas.count({ where: { turmaId } })) + 1;

      const prova = await tx.cursosTurmasProvas.create({
        data: {
          turmaId,
          moduloId: data.moduloId ?? null,
          titulo: data.titulo,
          etiqueta: data.etiqueta,
          descricao: data.descricao ?? null,
          peso: new Prisma.Decimal(data.peso),
          valePonto: data.valePonto ?? true,
          ativo: data.ativo ?? true,
          ordem,
          localizacao: data.moduloId ? CursosLocalProva.MODULO : CursosLocalProva.TURMA,
        },
        ...provaDefaultInclude,
      });

      provasLogger.info({ turmaId, provaId: prova.id }, 'Prova criada com sucesso');

      return mapProva(prova);
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    provaId: string,
    data: {
      titulo?: string;
      etiqueta?: string;
      descricao?: string | null;
      peso?: number;
      valePonto?: boolean;
      moduloId?: string | null;
      ativo?: boolean;
      ordem?: number | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      await tx.cursosTurmasProvas.update({
        where: { id: provaId },
        data: {
          titulo: data.titulo ?? undefined,
          etiqueta: data.etiqueta ?? undefined,
          descricao: data.descricao ?? undefined,
          peso: data.peso !== undefined ? new Prisma.Decimal(data.peso) : undefined,
          valePonto: data.valePonto ?? undefined,
          moduloId: data.moduloId ?? (data.moduloId === null ? null : undefined),
          ativo: data.ativo ?? undefined,
          ordem: data.ordem ?? undefined,
          localizacao:
            data.moduloId !== undefined
              ? data.moduloId
                ? CursosLocalProva.MODULO
                : CursosLocalProva.TURMA
              : undefined,
        },
      });

      provasLogger.info({ turmaId, provaId }, 'Prova atualizada com sucesso');

      return fetchProva(tx, provaId);
    });
  },

  async remove(cursoId: string, turmaId: string, provaId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      await tx.cursosTurmasProvas.delete({ where: { id: provaId } });

      provasLogger.info({ turmaId, provaId }, 'Prova removida com sucesso');

      return { success: true } as const;
    });
  },

  async registrarNota(
    cursoId: string,
    turmaId: string,
    provaId: string,
    data: {
      inscricaoId: string;
      nota: number;
      pesoTotal?: number | null;
      realizadoEm?: Date | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: { id: data.inscricaoId, turmaId },
        select: { id: true },
      });

      if (!inscricao) {
        const error = new Error('Inscrição não encontrada para a turma informada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const prova = await tx.cursosTurmasProvas.findFirst({
        where: { id: provaId },
        select: { id: true, titulo: true, descricao: true, peso: true },
      });

      if (!prova) {
        const error = new Error('Prova não encontrada');
        (error as any).code = 'PROVA_NOT_FOUND';
        throw error;
      }

      const envio = await tx.cursosTurmasProvasEnvios.upsert({
        where: {
          provaId_inscricaoId: {
            provaId,
            inscricaoId: data.inscricaoId,
          },
        },
        update: {
          nota: toDecimal(data.nota),
          pesoTotal: toDecimal(data.pesoTotal ?? null) ?? undefined,
          realizadoEm: data.realizadoEm ?? undefined,
          observacoes: data.observacoes ?? undefined,
        },
        create: {
          provaId,
          inscricaoId: data.inscricaoId,
          nota: toDecimal(data.nota),
          pesoTotal: toDecimal(data.pesoTotal ?? null),
          realizadoEm: data.realizadoEm ?? null,
          observacoes: data.observacoes ?? null,
        },
      });

      const pesoValor = data.pesoTotal !== undefined ? data.pesoTotal : Number(prova.peso);
      const dataReferencia = data.realizadoEm ?? envio.realizadoEm ?? new Date();
      const observacoesValor =
        data.observacoes !== undefined ? (data.observacoes ?? null) : undefined;

      await tx.cursosNotas.upsert({
        where: {
          inscricaoId_provaId: {
            inscricaoId: data.inscricaoId,
            provaId,
          },
        },
        update: {
          nota: toDecimalOptional(data.nota),
          peso: toDecimalOptional(pesoValor),
          dataReferencia,
          observacoes: observacoesValor,
          titulo: prova.titulo,
          descricao: prova.descricao ?? null,
        },
        create: {
          turmaId,
          inscricaoId: data.inscricaoId,
          tipo: CursosNotasTipo.PROVA,
          provaId,
          titulo: prova.titulo,
          descricao: prova.descricao ?? null,
          nota: toDecimal(data.nota),
          peso: toDecimal(pesoValor),
          valorMaximo: null,
          dataReferencia,
          observacoes: observacoesValor ?? null,
        },
      });

      provasLogger.info(
        { turmaId, provaId, envioId: envio.id },
        'Nota de prova registrada/atualizada',
      );

      return fetchProva(tx, provaId);
    });
  },
};

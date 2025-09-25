import { CursosSituacaoFinal, CursosModelosRecuperacao, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import {
  ResultadoAplicacaoRecuperacao,
  applyRecoveryModels,
  computeFinalResult,
  computeInitialAverage,
  CursosFinalStatus,
  CursosModelosDeRecuperacao,
  CursosRegrasDeProvas,
  CursosReferenciasDeProvas,
  traduzirModelosPrisma,
} from '../utils/avaliacao';

const avaliacaoLogger = logger.child({ module: 'CursosAvaliacaoService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const defaultRegras: CursosRegrasDeProvas = {
  mediaMinima: 7,
  politicaRecuperacao: {
    habilitada: false,
    modelos: [],
  },
};

const round = (valor: Prisma.Decimal | number | null | undefined, precision = 2) => {
  if (valor === null || valor === undefined) {
    return null;
  }
  const numero = typeof valor === 'number' ? valor : valor.toNumber();
  const factor = 10 ** precision;
  return Math.round(numero * factor) / factor;
};

const mapStatusFinal = (status: CursosSituacaoFinal | null | undefined): CursosFinalStatus => {
  switch (status) {
    case CursosSituacaoFinal.APROVADO:
      return CursosFinalStatus.APROVADO;
    case CursosSituacaoFinal.REPROVADO:
      return CursosFinalStatus.REPROVADO;
    case CursosSituacaoFinal.EM_ANALISE:
    default:
      return CursosFinalStatus.EM_ANALISE;
  }
};

const mapModeloToPrisma = (modelo: CursosModelosDeRecuperacao | null | undefined) => {
  if (!modelo) return undefined;
  switch (modelo) {
    case CursosModelosDeRecuperacao.SUBSTITUI_MENOR:
      return CursosModelosRecuperacao.SUBSTITUI_MENOR;
    case CursosModelosDeRecuperacao.MEDIA_MINIMA_DIRETA:
      return CursosModelosRecuperacao.MEDIA_MINIMA_DIRETA;
    case CursosModelosDeRecuperacao.PROVA_FINAL_UNICA:
      return CursosModelosRecuperacao.PROVA_FINAL_UNICA;
    case CursosModelosDeRecuperacao.NOTA_MAXIMA_LIMITADA:
      return CursosModelosRecuperacao.NOTA_MAXIMA_LIMITADA;
    default:
      return undefined;
  }
};

const mapRegrasFromDb = (
  regras:
    | (Prisma.CursosTurmasRegrasAvaliacaoGetPayload<{ select: typeof regrasSelect }> & {
        modelosRecuperacao: CursosModelosRecuperacao[];
        ordemAplicacaoRecuperacao: CursosModelosRecuperacao[];
      })
    | null
    | undefined,
): CursosRegrasDeProvas => {
  if (!regras) {
    return defaultRegras;
  }

  return {
    mediaMinima: round(regras.mediaMinima, 1) ?? defaultRegras.mediaMinima,
    politicaRecuperacao: {
      habilitada: regras.politicaRecuperacaoAtiva,
      modelos: traduzirModelosPrisma(regras.modelosRecuperacao),
      ordemAplicacao: traduzirModelosPrisma(regras.ordemAplicacaoRecuperacao),
      notaMaxima: round(regras.notaMaximaRecuperacao, 1),
      pesoProvaFinal: round(regras.pesoProvaFinal, 2),
    },
  };
};

const regrasSelect = {
  id: true,
  mediaMinima: true,
  politicaRecuperacaoAtiva: true,
  modelosRecuperacao: true,
  ordemAplicacaoRecuperacao: true,
  notaMaximaRecuperacao: true,
  pesoProvaFinal: true,
  observacoes: true,
} as const;

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

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
): Promise<void> => {
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

const mapProvaToReferencia = (
  prova: Prisma.CursosTurmasProvasGetPayload<{ include: { envios: true } }>,
  inscricaoId: string,
): CursosReferenciasDeProvas => {
  const envio = prova.envios.find((item) => item.inscricaoId === inscricaoId) ?? null;
  return {
    id: prova.id,
    etiqueta: prova.etiqueta,
    peso: round(prova.peso, 2) ?? 0,
    nota: envio?.nota ? round(envio.nota, 1) : null,
  };
};

const buildRecuperacaoResponse = (
  recuperacao: Prisma.CursosTurmasRecuperacoesGetPayload<{
    include: {
      prova: { select: { id: true; etiqueta: true } };
    };
  }> | null,
  resultadoRecuperacao: ResultadoAplicacaoRecuperacao | null,
) => {
  if (!recuperacao) {
    return null;
  }

  return {
    id: recuperacao.id,
    notaRegistrada: recuperacao.notaFinal
      ? round(recuperacao.notaFinal, 1)
      : recuperacao.notaRecuperacao
        ? round(recuperacao.notaRecuperacao, 1)
        : null,
    notaRecuperacao:
      resultadoRecuperacao?.notaRecuperacao ??
      (recuperacao.notaRecuperacao ? round(recuperacao.notaRecuperacao, 1) : null),
    status: mapStatusFinal(recuperacao.statusFinal),
    prova: recuperacao.prova
      ? { id: recuperacao.prova.id, etiqueta: recuperacao.prova.etiqueta }
      : null,
    modeloAplicado: recuperacao.modeloAplicado
      ? traduzirModelosPrisma([recuperacao.modeloAplicado])[0]
      : null,
    detalhes: (recuperacao.detalhes as Record<string, unknown> | null) ?? undefined,
    observacoes: recuperacao.observacoes ?? undefined,
    aplicadoEm: recuperacao.aplicadoEm?.toISOString() ?? null,
    modelos: resultadoRecuperacao?.modelos ?? undefined,
  };
};

export const avaliacaoService = {
  async obterRegras(cursoId: number, turmaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const regras = await prisma.cursosTurmasRegrasAvaliacao.findUnique({
      where: { turmaId },
      select: regrasSelect,
    });

    return mapRegrasFromDb(regras as any);
  },

  async atualizarRegras(
    cursoId: number,
    turmaId: string,
    data: Partial<{
      mediaMinima: number | null;
      politicaRecuperacaoAtiva: boolean;
      modelosRecuperacao: CursosModelosDeRecuperacao[];
      ordemAplicacaoRecuperacao: CursosModelosDeRecuperacao[];
      notaMaximaRecuperacao: number | null;
      pesoProvaFinal: number | null;
      observacoes?: string | null;
    }> & { modelosRecuperacao?: CursosModelosDeRecuperacao[] },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      const modelos = data.modelosRecuperacao?.map(mapModeloToPrisma).filter(Boolean) as
        | CursosModelosRecuperacao[]
        | undefined;
      const ordem = data.ordemAplicacaoRecuperacao?.map(mapModeloToPrisma).filter(Boolean) as
        | CursosModelosRecuperacao[]
        | undefined;

      const regras = await tx.cursosTurmasRegrasAvaliacao.upsert({
        where: { turmaId },
        update: {
          mediaMinima:
            data.mediaMinima !== undefined && data.mediaMinima !== null
              ? new Prisma.Decimal(data.mediaMinima)
              : undefined,
          politicaRecuperacaoAtiva: data.politicaRecuperacaoAtiva ?? undefined,
          modelosRecuperacao: modelos ?? undefined,
          ordemAplicacaoRecuperacao: ordem ?? undefined,
          notaMaximaRecuperacao:
            data.notaMaximaRecuperacao !== undefined
              ? data.notaMaximaRecuperacao !== null
                ? new Prisma.Decimal(data.notaMaximaRecuperacao)
                : null
              : undefined,
          pesoProvaFinal:
            data.pesoProvaFinal !== undefined
              ? data.pesoProvaFinal !== null
                ? new Prisma.Decimal(data.pesoProvaFinal)
                : null
              : undefined,
          observacoes: data.observacoes ?? undefined,
        },
        create: {
          turmaId,
          mediaMinima: new Prisma.Decimal(data.mediaMinima ?? defaultRegras.mediaMinima),
          politicaRecuperacaoAtiva: data.politicaRecuperacaoAtiva ?? false,
          modelosRecuperacao: modelos ?? [],
          ordemAplicacaoRecuperacao: ordem ?? [],
          notaMaximaRecuperacao:
            data.notaMaximaRecuperacao !== undefined && data.notaMaximaRecuperacao !== null
              ? new Prisma.Decimal(data.notaMaximaRecuperacao)
              : null,
          pesoProvaFinal:
            data.pesoProvaFinal !== undefined && data.pesoProvaFinal !== null
              ? new Prisma.Decimal(data.pesoProvaFinal)
              : null,
          observacoes: data.observacoes ?? null,
        },
        select: regrasSelect,
      });

      avaliacaoLogger.info({ turmaId }, 'Regras de avaliação atualizadas');

      return mapRegrasFromDb(regras as any);
    });
  },

  async registrarRecuperacao(
    cursoId: number,
    turmaId: string,
    data: {
      inscricaoId: string;
      provaId?: string | null;
      envioId?: string | null;
      notaRecuperacao?: number | null;
      notaFinal?: number | null;
      mediaCalculada?: number | null;
      modeloAplicado?: CursosModelosDeRecuperacao | null;
      detalhes?: Record<string, unknown> | null;
      observacoes?: string | null;
      aplicadoEm?: Date | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureInscricaoBelongsToTurma(tx, turmaId, data.inscricaoId);

      if (data.provaId) {
        await ensureProvaBelongsToTurma(tx, cursoId, turmaId, data.provaId);
      }

      if (data.envioId) {
        const envio = await tx.cursosTurmasProvasEnvios.findFirst({
          where: { id: data.envioId, prova: { turmaId } },
          select: { inscricaoId: true },
        });
        if (!envio || envio.inscricaoId !== data.inscricaoId) {
          const error = new Error('Envio de prova não encontrado para a inscrição informada');
          (error as any).code = 'ENVIO_NOT_FOUND';
          throw error;
        }
      }

      const recuperacao = await tx.cursosTurmasRecuperacoes.create({
        data: {
          turmaId,
          inscricaoId: data.inscricaoId,
          provaId: data.provaId ?? null,
          envioId: data.envioId ?? null,
          notaRecuperacao:
            data.notaRecuperacao !== undefined && data.notaRecuperacao !== null
              ? new Prisma.Decimal(data.notaRecuperacao)
              : null,
          notaFinal:
            data.notaFinal !== undefined && data.notaFinal !== null
              ? new Prisma.Decimal(data.notaFinal)
              : null,
          mediaCalculada:
            data.mediaCalculada !== undefined && data.mediaCalculada !== null
              ? new Prisma.Decimal(data.mediaCalculada)
              : null,
          modeloAplicado: mapModeloToPrisma(data.modeloAplicado) ?? null,
          statusFinal: CursosSituacaoFinal.EM_ANALISE,
          detalhes:
            data.detalhes !== undefined
              ? data.detalhes
                ? (data.detalhes as Prisma.JsonObject)
                : Prisma.JsonNull
              : Prisma.JsonNull,
          observacoes: data.observacoes ?? null,
          aplicadoEm: data.aplicadoEm ?? new Date(),
          regraId:
            (
              await tx.cursosTurmasRegrasAvaliacao.findUnique({
                where: { turmaId },
                select: { id: true },
              })
            )?.id ?? null,
        },
        include: {
          prova: { select: { id: true, etiqueta: true } },
        },
      });

      avaliacaoLogger.info({ turmaId, recuperacaoId: recuperacao.id }, 'Recuperação registrada');

      return recuperacao;
    });
  },

  async calcularNotasInscricao(
    inscricaoId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      include: {
        aluno: { select: { id: true, nomeCompleto: true, email: true } },
        turma: {
          include: {
            curso: { select: { id: true, nome: true } },
            provas: {
              orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
              include: {
                envios: {
                  where: { inscricaoId },
                  orderBy: { atualizadoEm: 'desc' },
                },
              },
            },
            regrasAvaliacao: { select: regrasSelect },
          },
        },
        recuperacoes: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
          include: {
            prova: { select: { id: true, etiqueta: true } },
          },
        },
      },
    });

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada');
      (error as any).code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    if (requesterId && requesterId !== inscricao.alunoId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const regras = mapRegrasFromDb(inscricao.turma.regrasAvaliacao as any);
    const provasAtivas = inscricao.turma.provas.filter((prova) => prova.ativo !== false);
    const referencias: CursosReferenciasDeProvas[] = provasAtivas.map((prova) =>
      mapProvaToReferencia(prova as any, inscricaoId),
    );

    const mediaInicial = computeInitialAverage(referencias);
    const ultimaRecuperacao = inscricao.recuperacoes[0] ?? null;
    const notaRecuperacao = ultimaRecuperacao
      ? ultimaRecuperacao.notaFinal
        ? round(ultimaRecuperacao.notaFinal, 1)
        : ultimaRecuperacao.notaRecuperacao
          ? round(ultimaRecuperacao.notaRecuperacao, 1)
          : null
      : null;

    const resultadoRecuperacao = ultimaRecuperacao
      ? applyRecoveryModels(referencias, regras, notaRecuperacao)
      : null;

    const resultadoFinal = computeFinalResult({
      mediaInicial,
      regras,
      recuperacao: resultadoRecuperacao,
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
        id: inscricao.turmaId,
        nome: inscricao.turma.nome,
        codigo: inscricao.turma.codigo,
      },
      regras,
      provas: {
        referencias,
        mediaInicial: resultadoFinal.mediaInicial,
        statusInicial: resultadoFinal.statusInicial,
      },
      recuperacao: buildRecuperacaoResponse(ultimaRecuperacao, resultadoRecuperacao),
      resultadoFinal: {
        media: resultadoFinal.mediaFinal,
        status: resultadoFinal.statusFinal,
      },
    };
  },
};

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
  provaId: string,
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, turma: { cursoId } },
    select: { id: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }
};

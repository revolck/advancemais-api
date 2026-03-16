import {
  AuditoriaCategoria,
  CursosAvaliacaoTipo,
  CursosNotasTipo,
  Prisma,
  Roles,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { mapNota, NotaWithRelations, notaWithRelations } from './notas.mapper';
import type {
  CreateNotaManualInput,
  ListCursoNotasQuery,
  ListNotasGeralQuery,
} from '../validators/notas.schema';

const notasLogger = logger.child({ module: 'CursosNotasService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId, deletedAt: null },
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
  cursoId: string,
  turmaId: string,
  provaId: string,
) => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, CursosTurmas: { cursoId } },
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

const ensureOrigemItemBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  origem: {
    tipo: 'PROVA' | 'ATIVIDADE' | 'AULA' | 'OUTRO';
    id?: string | null;
    titulo?: string | null;
  },
) => {
  if (origem.tipo === 'OUTRO') {
    return {
      referenciaExterna: 'OUTRO',
      descricaoOrigem: origem.titulo?.trim() || null,
    };
  }

  if (!origem.id) {
    const error = new Error('Item de origem é obrigatório para PROVA, ATIVIDADE e AULA');
    (error as any).code = 'VALIDATION_ERROR';
    throw error;
  }

  if (origem.tipo === 'AULA') {
    const aula = await client.cursosTurmasAulas.findFirst({
      where: {
        id: origem.id,
        turmaId,
        cursoId,
        deletedAt: null,
      },
      select: {
        id: true,
        nome: true,
      },
    });

    if (!aula) {
      const error = new Error('Aula não encontrada para a turma informada');
      (error as any).code = 'AULA_NOT_FOUND';
      throw error;
    }

    return {
      referenciaExterna: `AULA:${aula.id}`,
      descricaoOrigem: aula.nome,
    };
  }

  const tipoEsperado =
    origem.tipo === 'PROVA' ? CursosAvaliacaoTipo.PROVA : CursosAvaliacaoTipo.ATIVIDADE;
  const avaliacao = await client.cursosTurmasProvas.findFirst({
    where: {
      id: origem.id,
      turmaId,
      cursoId,
      tipo: tipoEsperado,
    },
    select: {
      id: true,
      titulo: true,
    },
  });

  if (!avaliacao) {
    const error = new Error(
      origem.tipo === 'PROVA'
        ? 'Prova não encontrada para a turma informada'
        : 'Atividade não encontrada para a turma informada',
    );
    (error as any).code = origem.tipo === 'PROVA' ? 'PROVA_NOT_FOUND' : 'ATIVIDADE_NOT_FOUND';
    throw error;
  }

  return {
    referenciaExterna: `${origem.tipo}:${avaliacao.id}`,
    descricaoOrigem: avaliacao.titulo,
  };
};

const ensureNotaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  notaId: string,
) => {
  const nota = await client.cursosNotas.findFirst({
    where: { id: notaId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true, inscricaoId: true, tipo: true, provaId: true, titulo: true },
  });

  if (!nota) {
    const error = new Error('Nota não encontrada para a turma informada');
    (error as any).code = 'NOTA_NOT_FOUND';
    throw error;
  }

  return nota;
};

const ensureNotaIsManual = (nota: { provaId: string | null }) => {
  if (nota.provaId !== null) {
    const error = new Error(
      'Notas geradas automaticamente pelo sistema não podem ser alteradas ou removidas',
    );
    (error as any).code = 'NOTA_SYSTEM_LOCKED';
    throw error;
  }
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

const MAX_NOTA_FINAL = 10;
const EPSILON = 0.000001;

const normalizeNumber = (value: unknown) => Number(value ?? 0);
const roundOneDecimal = (value: number) => Number(value.toFixed(1));

const getConsolidatedNotaContext = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
  options?: {
    excludeManualNotaId?: string;
  },
) => {
  const [baseResult] = await client.$queryRaw<{ nota_base: number | string | Prisma.Decimal }[]>(
    Prisma.sql`
      SELECT
        CASE
          WHEN COALESCE(SUM(p.peso), 0) = 0 THEN 0
          ELSE (COALESCE(SUM(COALESCE(e.nota, 0) * p.peso), 0) / SUM(p.peso))
        END AS nota_base
      FROM "CursosTurmasProvas" p
      LEFT JOIN "CursosTurmasProvasEnvios" e
        ON e."provaId" = p.id
       AND e."inscricaoId" = ${inscricaoId}
      WHERE p."turmaId" = ${turmaId}
        AND p.ativo = true
    `,
  );

  const [manuaisResult] = await client.$queryRaw<
    { soma_manual: number | string | Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT COALESCE(SUM(n.nota), 0) AS soma_manual
      FROM "CursosNotas" n
      WHERE n."turmaId" = ${turmaId}
        AND n."inscricaoId" = ${inscricaoId}
        AND n."provaId" IS NULL
        ${options?.excludeManualNotaId ? Prisma.sql`AND n.id <> ${options.excludeManualNotaId}` : Prisma.empty}
    `,
  );

  const notaBase = normalizeNumber(baseResult?.nota_base);
  const ajustesManuais = normalizeNumber(manuaisResult?.soma_manual);
  const notaAtual = notaBase + ajustesManuais;
  const disponivelParaAdicionar = Math.max(0, MAX_NOTA_FINAL - notaAtual);

  return {
    notaBase,
    ajustesManuais,
    notaAtual,
    disponivelParaAdicionar,
  };
};

const buildNotaLimitErrorData = (notaAtual: number) => ({
  notaAtual: roundOneDecimal(notaAtual),
  maximoPermitido: MAX_NOTA_FINAL,
  disponivelParaAdicionar: roundOneDecimal(Math.max(0, MAX_NOTA_FINAL - notaAtual)),
});

const validateManualNotaCreateLimit = (notaAtual: number, notaNova: number) => {
  if (notaAtual >= MAX_NOTA_FINAL - EPSILON) {
    const error: any = new Error('Aluno já possui nota final 10.');
    error.code = 'NOTA_MAXIMA_ATINGIDA';
    error.data = buildNotaLimitErrorData(notaAtual);
    throw error;
  }

  if (notaAtual + notaNova > MAX_NOTA_FINAL + EPSILON) {
    const data = buildNotaLimitErrorData(notaAtual);
    const error: any = new Error(
      `Nota excede o limite. Disponível para adicionar: ${data.disponivelParaAdicionar.toFixed(1)}`,
    );
    error.code = 'NOTA_EXCEDE_LIMITE';
    error.data = data;
    throw error;
  }
};

const validateManualNotaUpdateLimit = (notaAtualSemNotaEditada: number, notaNova: number) => {
  if (notaAtualSemNotaEditada + notaNova > MAX_NOTA_FINAL + EPSILON) {
    const data = buildNotaLimitErrorData(notaAtualSemNotaEditada);
    const error: any = new Error(
      `Nota excede o limite. Disponível para adicionar: ${data.disponivelParaAdicionar.toFixed(1)}`,
    );
    error.code = 'NOTA_EXCEDE_LIMITE';
    error.data = data;
    throw error;
  }
};

const parseOrigemFromReferencia = (
  referenciaExterna: string | null,
  tituloOrigem: string | null,
): {
  tipo: 'PROVA' | 'ATIVIDADE' | 'AULA' | 'OUTRO' | 'SISTEMA';
  id: string | null;
  titulo: string | null;
} => {
  if (!referenciaExterna) {
    return { tipo: 'SISTEMA', id: null, titulo: tituloOrigem ?? 'Cálculo automático do sistema' };
  }

  const [rawTipo, rawId] = referenciaExterna.split(':', 2);
  const tipoUpper = rawTipo?.trim().toUpperCase();
  const tipo = ['PROVA', 'ATIVIDADE', 'AULA', 'OUTRO', 'SISTEMA'].includes(tipoUpper)
    ? (tipoUpper as 'PROVA' | 'ATIVIDADE' | 'AULA' | 'OUTRO' | 'SISTEMA')
    : 'OUTRO';

  const id = rawId?.trim() ? rawId.trim() : null;
  return { tipo, id, titulo: tituloOrigem ?? null };
};

const roleLabelMap: Partial<Record<Roles, string>> = {
  ADMIN: 'Administrador',
  MODERADOR: 'Moderador',
  PEDAGOGICO: 'Setor Pedagógico',
  INSTRUTOR: 'Instrutor',
};

const formatRoleLabel = (role: Roles | null | undefined) => {
  if (!role) return 'Usuário';
  return roleLabelMap[role] ?? role;
};

type ManualNotaRow = {
  id: string;
  inscricaoId: string;
  nota: Prisma.Decimal | null;
  titulo: string | null;
  descricao: string | null;
  referenciaExterna: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

type NotaHistoryEntry = {
  id: string;
  action: 'ADDED';
  at: string;
  nota: number;
  motivo: string | null;
  origem: string;
  alteradoPor: {
    id: string | null;
    nome: string;
    role: string | null;
    roleLabel: string;
  };
};

const resolveManualNotaActors = async (notaIds: string[]) => {
  const map = new Map<
    string,
    {
      id: string | null;
      nome: string;
      role: string | null;
      roleLabel: string;
    }
  >();

  if (!notaIds.length) {
    return map;
  }

  const logs = await prisma.auditoriaLogs.findMany({
    where: {
      entidadeId: { in: notaIds },
      entidadeTipo: 'CURSO_NOTA',
      acao: 'NOTA_MANUAL_ADICIONADA',
    },
    orderBy: { criadoEm: 'desc' },
    select: {
      entidadeId: true,
      usuarioId: true,
      Usuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          role: true,
        },
      },
    },
  });

  for (const log of logs) {
    if (!log.entidadeId || map.has(log.entidadeId)) {
      continue;
    }

    const actorId = log.Usuarios?.id ?? log.usuarioId ?? null;
    const actorName = log.Usuarios?.nomeCompleto ?? 'Sistema';
    const actorRole = log.Usuarios?.role ?? null;
    map.set(log.entidadeId, {
      id: actorId,
      nome: actorName,
      role: actorRole,
      roleLabel: formatRoleLabel(actorRole),
    });
  }

  return map;
};

const buildManualNotasPayload = async (manuais: ManualNotaRow[]) => {
  const historicoPorInscricao = new Map<string, NotaHistoryEntry[]>();
  const ultimaOrigemManualPorInscricao = new Map<
    string,
    {
      motivo: string | null;
      origem: {
        tipo: 'PROVA' | 'ATIVIDADE' | 'AULA' | 'OUTRO' | 'SISTEMA';
        id: string | null;
        titulo: string | null;
      };
    }
  >();

  const atoresPorNotaId = await resolveManualNotaActors(manuais.map((item) => item.id));

  for (const item of manuais) {
    const actor = atoresPorNotaId.get(item.id) ?? {
      id: null,
      nome: 'Sistema',
      role: null,
      roleLabel: 'Sistema',
    };

    const list = historicoPorInscricao.get(item.inscricaoId) ?? [];
    list.push({
      id: item.id,
      action: 'ADDED',
      at: item.criadoEm.toISOString(),
      nota: item.nota ? Number(item.nota) : 0,
      motivo: item.titulo ?? null,
      origem: `${actor.nome} (${actor.roleLabel})`,
      alteradoPor: actor,
    });
    historicoPorInscricao.set(item.inscricaoId, list);

    if (!ultimaOrigemManualPorInscricao.has(item.inscricaoId)) {
      ultimaOrigemManualPorInscricao.set(item.inscricaoId, {
        motivo: item.titulo ?? null,
        origem: parseOrigemFromReferencia(item.referenciaExterna, item.descricao ?? null),
      });
    }
  }

  return {
    historicoPorInscricao,
    ultimaOrigemManualPorInscricao,
  };
};

export const notasService = {
  async list(
    cursoId: string,
    turmaId: string,
    filters: {
      inscricaoId?: string;
    } = {},
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const notas = await prisma.cursosNotas.findMany({
      where: {
        turmaId,
        CursosTurmas: { cursoId },
        inscricaoId: filters.inscricaoId ?? undefined,
      },
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: notaWithRelations.include,
    });

    return notas.map(mapNota);
  },

  async get(cursoId: string, turmaId: string, notaId: string) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const nota = await prisma.cursosNotas.findFirst({
      where: { id: notaId, turmaId, CursosTurmas: { cursoId } },
      include: notaWithRelations.include,
    });

    if (!nota) {
      const error = new Error('Nota não encontrada para a turma informada');
      (error as any).code = 'NOTA_NOT_FOUND';
      throw error;
    }

    return mapNota(nota);
  },

  async create(
    cursoId: string,
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

      const titulo =
        data.tipo === CursosNotasTipo.PROVA && prova ? prova.titulo : (data.titulo ?? null);

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
              ? (prova.descricao ?? null)
              : (data.descricao ?? null),
          nota: toDecimal(data.nota ?? null),
          peso: toDecimal(data.peso ?? (prova ? Number(prova.peso) : null)),
          valorMaximo: toDecimal(data.valorMaximo ?? null),
          dataReferencia: data.dataReferencia ?? new Date(),
          observacoes: data.observacoes ?? null,
        },
        include: notaWithRelations.include,
      });

      notasLogger.info({ turmaId, notaId: nota.id }, 'Nota criada para inscrição');

      return mapNota(nota);
    });
  },

  async update(
    cursoId: string,
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
      ensureNotaIsManual(notaAtual);

      if (data.nota !== undefined) {
        const consolidadoSemNotaEditada = await getConsolidatedNotaContext(
          tx,
          turmaId,
          notaAtual.inscricaoId,
          {
            excludeManualNotaId: notaId,
          },
        );
        validateManualNotaUpdateLimit(consolidadoSemNotaEditada.notaAtual, data.nota ?? 0);
      }

      let prova = null;
      if (data.provaId) {
        prova = await ensureProvaBelongsToTurma(tx, cursoId, turmaId, data.provaId);
      }

      const isProvaAfterUpdate =
        data.tipo === CursosNotasTipo.PROVA ||
        (data.tipo === undefined && notaAtual.tipo === CursosNotasTipo.PROVA);

      const tituloDerivadoDaProva = isProvaAfterUpdate
        ? (prova?.titulo ??
          (notaAtual.tipo === CursosNotasTipo.PROVA ? notaAtual.titulo : undefined))
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
          provaId: data.provaId !== undefined ? (data.provaId ? data.provaId : null) : undefined,
          referenciaExterna: data.referenciaExterna ?? undefined,
          titulo: tituloParaAtualizar,
          descricao:
            data.descricao !== undefined
              ? data.descricao
              : prova
                ? (prova.descricao ?? null)
                : undefined,
          nota: toDecimalOptional(data.nota),
          peso: toDecimalOptional(
            data.peso !== undefined ? data.peso : prova ? Number(prova.peso) : undefined,
          ),
          valorMaximo: toDecimalOptional(data.valorMaximo),
          dataReferencia: data.dataReferencia ?? undefined,
          observacoes: data.observacoes ?? undefined,
        },
        include: notaWithRelations.include,
      })) as NotaWithRelations;

      notasLogger.info({ turmaId, notaId }, 'Nota atualizada');

      return mapNota(nota);
    });
  },

  async remove(cursoId: string, turmaId: string, notaId: string) {
    return prisma.$transaction(async (tx) => {
      const notaAtual = await ensureNotaBelongsToTurma(tx, cursoId, turmaId, notaId);
      ensureNotaIsManual(notaAtual);

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

    const notas = await prisma.cursosNotas.findMany({
      where: { inscricaoId },
      orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
      include: notaWithRelations.include,
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
      notas: notas.map(mapNota),
    };
  },

  async createManualLancamento(
    cursoId: string,
    turmaId: string,
    data: CreateNotaManualInput,
    context?: {
      criadoPorId?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: { turmaId, alunoId: data.alunoId },
        select: { id: true },
      });

      if (!inscricao) {
        const error: any = new Error('Aluno não possui inscrição nesta turma');
        error.code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const consolidadoAtual = await getConsolidatedNotaContext(tx, turmaId, inscricao.id);
      validateManualNotaCreateLimit(consolidadoAtual.notaAtual, data.nota);

      const origemItem = await ensureOrigemItemBelongsToTurma(tx, cursoId, turmaId, data.origem);

      const nota = await tx.cursosNotas.create({
        data: {
          turmaId,
          inscricaoId: inscricao.id,
          tipo: CursosNotasTipo.BONUS,
          provaId: null,
          referenciaExterna: origemItem.referenciaExterna,
          titulo: data.motivo,
          descricao: origemItem.descricaoOrigem,
          nota: new Prisma.Decimal(data.nota),
          peso: null,
          valorMaximo: null,
          dataReferencia: new Date(),
          observacoes: null,
        },
        include: notaWithRelations.include,
      });

      if (context?.criadoPorId) {
        await tx.auditoriaLogs.create({
          data: {
            categoria: AuditoriaCategoria.CURSO,
            tipo: 'CURSO_NOTA',
            acao: 'NOTA_MANUAL_ADICIONADA',
            usuarioId: context.criadoPorId,
            entidadeId: nota.id,
            entidadeTipo: 'CURSO_NOTA',
            descricao: `Nota manual adicionada (${data.origem.tipo}) para inscrição ${inscricao.id}`,
            dadosNovos: {
              notaId: nota.id,
              nota: data.nota,
              motivo: data.motivo,
              origem: data.origem,
              cursoId,
              turmaId,
              alunoId: data.alunoId,
              inscricaoId: inscricao.id,
            },
            metadata: {
              createdBy: context.criadoPorId,
              createdAt: nota.criadoEm.toISOString(),
              ip: context.ip ?? null,
              userAgent: context.userAgent ?? null,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
          },
        });
      }

      notasLogger.info({ turmaId, notaId: nota.id }, 'Lançamento manual de nota criado');
      return mapNota(nota);
    });
  },

  async clearLancamentosManuais(cursoId: string, turmaId: string, alunoId: string) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: { turmaId, alunoId },
        select: { id: true },
      });

      if (!inscricao) {
        const error: any = new Error('Aluno não possui inscrição nesta turma');
        error.code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const deleted = await tx.cursosNotas.deleteMany({
        where: {
          turmaId,
          inscricaoId: inscricao.id,
          provaId: null,
        },
      });

      return { success: true, deletedCount: deleted.count } as const;
    });
  },

  async listCursoNotas(cursoId: string, query: ListCursoNotasQuery) {
    const { turmaIds, search, page, pageSize, orderBy, order } = query;

    const turmas = await prisma.cursosTurmas.findMany({
      where: { id: { in: turmaIds }, cursoId },
      select: { id: true },
    });

    if (turmas.length !== turmaIds.length) {
      const error: any = new Error('Uma ou mais turmas são inválidas para o curso informado');
      error.code = 'INVALID_TURMA_FILTER';
      throw error;
    }

    const turmaPlaceholders = turmaIds.map((_, index) => `$${index + 2}`).join(', ');
    const baseParams: any[] = [cursoId, ...turmaIds];

    const searchParamIndex = baseParams.length + 1;
    const hasSearch = !!(search && search.trim().length);
    if (hasSearch) {
      baseParams.push(`%${search!.trim()}%`);
    }

    const searchClause = hasSearch
      ? ` AND (
          u."nomeCompleto" ILIKE $${searchParamIndex}
          OR u.email ILIKE $${searchParamIndex}
          OR COALESCE(u.cpf, '') ILIKE $${searchParamIndex}
          OR COALESCE(u."codUsuario", '') ILIKE $${searchParamIndex}
          OR COALESCE(ui.inscricao, '') ILIKE $${searchParamIndex}
        )`
      : '';

    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint as count
       FROM "CursosTurmasInscricoes" i
       INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
       INNER JOIN "Usuarios" u ON u.id = i."alunoId"
       LEFT JOIN "UsuariosInformation" ui ON ui."usuarioId" = u.id
       WHERE t."cursoId" = $1
         AND i."turmaId"::text IN (${turmaPlaceholders})
         ${searchClause}`,
      ...baseParams,
    );

    const total = Number(countResult?.[0]?.count ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const orderByMap: Record<ListCursoNotasQuery['orderBy'], string> = {
      alunoNome: 'aluno_nome',
      nota: 'nota_final_original',
      atualizadoEm: 'atualizado_em',
    };

    const orderColumn = orderByMap[orderBy] ?? orderByMap.alunoNome;
    const orderDirection = order === 'desc' ? 'DESC' : 'ASC';

    const rows = await prisma.$queryRawUnsafe<
      {
        curso_id: string;
        curso_nome: string;
        turma_id: string;
        turma_nome: string;
        turma_codigo: string;
        inscricao_id: string;
        aluno_id: string;
        aluno_nome: string;
        aluno_codigo: string | null;
        aluno_cpf: string | null;
        aluno_matricula: string | null;
        aluno_avatar_url: string | null;
        nota_base: string | number;
        ajustes_manuais: string | number;
        nota_final_original: string | number;
        atualizado_em: Date | string | null;
      }[]
    >(
      `WITH base AS (
        SELECT
          i.id AS inscricao_id,
          i."turmaId" AS turma_id,
          SUM(COALESCE(e.nota, 0) * p.peso) AS soma_ponderada,
          SUM(p.peso) AS soma_pesos,
          MAX(e."atualizadoEm") AS envios_atualizado_em
        FROM "CursosTurmasInscricoes" i
        INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
        INNER JOIN "CursosTurmasProvas" p
          ON p."turmaId" = i."turmaId"
         AND p.ativo = true
        LEFT JOIN "CursosTurmasProvasEnvios" e
          ON e."provaId" = p.id
         AND e."inscricaoId" = i.id
        WHERE t."cursoId" = $1
          AND i."turmaId"::text IN (${turmaPlaceholders})
        GROUP BY i.id, i."turmaId"
      ),
      manuais AS (
        SELECT
          n."inscricaoId" AS inscricao_id,
          SUM(COALESCE(n.nota, 0)) AS soma_manual
        FROM "CursosNotas" n
        WHERE n."turmaId"::text IN (${turmaPlaceholders})
          AND n."provaId" IS NULL
        GROUP BY n."inscricaoId"
      ),
      notas_all AS (
        SELECT
          n."inscricaoId" AS inscricao_id,
          MAX(n."atualizadoEm") AS notas_atualizado_em
        FROM "CursosNotas" n
        WHERE n."turmaId"::text IN (${turmaPlaceholders})
        GROUP BY n."inscricaoId"
      )
      SELECT
        t."cursoId" AS curso_id,
        c.nome AS curso_nome,
        i."turmaId" AS turma_id,
        t.nome AS turma_nome,
        t.codigo AS turma_codigo,
        i.id AS inscricao_id,
        i."alunoId" AS aluno_id,
        u."nomeCompleto" AS aluno_nome,
        u."codUsuario" AS aluno_codigo,
        u.cpf AS aluno_cpf,
        ui.inscricao AS aluno_matricula,
        ui."avatarUrl" AS aluno_avatar_url,
        CASE
          WHEN COALESCE(base.soma_pesos, 0) = 0 THEN 0
          ELSE (COALESCE(base.soma_ponderada, 0) / base.soma_pesos)
        END AS nota_base,
        COALESCE(manuais.soma_manual, 0) AS ajustes_manuais,
        LEAST(
          10,
          CASE
            WHEN COALESCE(base.soma_pesos, 0) = 0 THEN 0
            ELSE (COALESCE(base.soma_ponderada, 0) / base.soma_pesos)
          END + COALESCE(manuais.soma_manual, 0)
        ) AS nota_final_original,
        NULLIF(
          GREATEST(
            COALESCE(notas_all.notas_atualizado_em, 'epoch'::timestamp),
            COALESCE(base.envios_atualizado_em, 'epoch'::timestamp),
            COALESCE(i."criadoEm", 'epoch'::timestamp)
          ),
          'epoch'::timestamp
        ) AS atualizado_em
      FROM "CursosTurmasInscricoes" i
      INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
      INNER JOIN "Cursos" c ON c.id = t."cursoId"
      INNER JOIN "Usuarios" u ON u.id = i."alunoId"
      LEFT JOIN "UsuariosInformation" ui ON ui."usuarioId" = u.id
      LEFT JOIN base ON base.inscricao_id = i.id
      LEFT JOIN manuais ON manuais.inscricao_id = i.id
      LEFT JOIN notas_all ON notas_all.inscricao_id = i.id
      WHERE t."cursoId" = $1
        AND i."turmaId"::text IN (${turmaPlaceholders})
        ${searchClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ${pageSize} OFFSET ${skip}`,
      ...baseParams,
    );

    const inscricaoIds = rows.map((r) => r.inscricao_id);
    const manuais = inscricaoIds.length
      ? await prisma.cursosNotas.findMany({
          where: {
            turmaId: { in: turmaIds },
            inscricaoId: { in: inscricaoIds },
            provaId: null,
          },
          orderBy: [{ atualizadoEm: 'desc' }, { criadoEm: 'desc' }],
          select: {
            id: true,
            inscricaoId: true,
            nota: true,
            titulo: true,
            descricao: true,
            referenciaExterna: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        })
      : [];

    const { historicoPorInscricao, ultimaOrigemManualPorInscricao } =
      await buildManualNotasPayload(manuais);

    return {
      items: rows.map((row) => {
        const hasManual = historicoPorInscricao.has(row.inscricao_id);
        const origemPayload = ultimaOrigemManualPorInscricao.get(row.inscricao_id)?.origem ?? {
          tipo: 'SISTEMA' as const,
          id: null,
          titulo: 'Cálculo automático do sistema',
        };

        return {
          // Contrato novo (dashboard)
          cursoId: row.curso_id,
          cursoNome: row.curso_nome,
          turmaId: row.turma_id,
          turmaNome: row.turma_nome,
          turmaCodigo: row.turma_codigo,
          inscricaoId: row.inscricao_id,
          alunoId: row.aluno_id,
          alunoNome: row.aluno_nome,
          avatarUrl: row.aluno_avatar_url,
          cpf: row.aluno_cpf,
          matricula: row.aluno_matricula ?? row.aluno_codigo,
          nota: Number(row.nota_final_original),
          atualizadoEm:
            row.atualizado_em instanceof Date
              ? row.atualizado_em.toISOString()
              : row.atualizado_em
                ? new Date(row.atualizado_em).toISOString()
                : null,
          motivo:
            ultimaOrigemManualPorInscricao.get(row.inscricao_id)?.motivo ??
            'Nota consolidada automaticamente pelo sistema',
          origem: origemPayload,
          isManual: hasManual,
          history: historicoPorInscricao.get(row.inscricao_id) ?? [],

          // Campos legados (mantidos por compatibilidade)
          alunoCodigo: row.aluno_codigo,
          alunoCpf: row.aluno_cpf,
          alunoMatricula: row.aluno_matricula,
          notaBase: Number(row.nota_base),
          ajustesManuais: Number(row.ajustes_manuais),
          notaFinalOriginal: Number(row.nota_final_original),
        };
      }),
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalPages: totalPages || 1,
        hasNext: totalPages > 0 && safePage < totalPages,
        hasPrevious: safePage > 1,
        isPageAdjusted: safePage !== page,
      },
    };
  },

  async listNotasGeral(
    query: ListNotasGeralQuery,
    options?: {
      alunoId?: string;
    },
  ) {
    const { cursoId, turmaIds, search, page, pageSize, orderBy, order } = query;
    const alunoIdFilter = options?.alunoId;

    if (turmaIds && turmaIds.length > 0) {
      const turmas = await prisma.cursosTurmas.findMany({
        where: cursoId ? { id: { in: turmaIds }, cursoId } : { id: { in: turmaIds } },
        select: { id: true },
      });

      if (turmas.length !== turmaIds.length) {
        const error: any = new Error('Uma ou mais turmas são inválidas para o curso informado');
        error.code = 'INVALID_TURMA_FILTER';
        throw error;
      }
    }

    const baseParams: any[] = [];
    let cursoParamIndex: number | null = null;
    let turmaStartParamIndex: number | null = null;
    let alunoParamIndex: number | null = null;
    let searchParamIndex: number | null = null;

    if (cursoId) {
      baseParams.push(cursoId);
      cursoParamIndex = baseParams.length;
    }

    if (turmaIds && turmaIds.length > 0) {
      turmaStartParamIndex = baseParams.length + 1;
      baseParams.push(...turmaIds);
    }

    if (alunoIdFilter) {
      alunoParamIndex = baseParams.length + 1;
      baseParams.push(alunoIdFilter);
    }

    if (search && search.trim().length > 0) {
      searchParamIndex = baseParams.length + 1;
      baseParams.push(`%${search.trim()}%`);
    }

    const buildTurmaInClause = (column: string) => {
      if (!turmaIds || turmaIds.length === 0 || !turmaStartParamIndex) {
        return '';
      }

      const placeholders = turmaIds
        .map((_, index) => `$${turmaStartParamIndex! + index}`)
        .join(', ');
      return `${column}::text IN (${placeholders})`;
    };

    const buildWhereClause = (clauses: (string | false)[]) => {
      const validClauses = clauses.filter(Boolean) as string[];
      if (validClauses.length === 0) {
        return '';
      }
      return `WHERE ${validClauses.join('\n        AND ')}`;
    };

    const whereMain = buildWhereClause([
      cursoParamIndex ? `t."cursoId" = $${cursoParamIndex}` : false,
      buildTurmaInClause('i."turmaId"'),
      alunoParamIndex ? `i."alunoId" = $${alunoParamIndex}` : false,
      searchParamIndex
        ? `(
          u."nomeCompleto" ILIKE $${searchParamIndex}
          OR u.email ILIKE $${searchParamIndex}
          OR COALESCE(u.cpf, '') ILIKE $${searchParamIndex}
          OR COALESCE(u."codUsuario", '') ILIKE $${searchParamIndex}
          OR COALESCE(ui.inscricao, '') ILIKE $${searchParamIndex}
        )`
        : false,
    ]);

    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint as count
       FROM "CursosTurmasInscricoes" i
       INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
       INNER JOIN "Usuarios" u ON u.id = i."alunoId"
       LEFT JOIN "UsuariosInformation" ui ON ui."usuarioId" = u.id
       ${whereMain}`,
      ...baseParams,
    );

    const total = Number(countResult?.[0]?.count ?? 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const orderByMap: Record<ListCursoNotasQuery['orderBy'], string> = {
      alunoNome: 'aluno_nome',
      nota: 'nota_final_original',
      atualizadoEm: 'atualizado_em',
    };

    const orderColumn = orderByMap[orderBy] ?? orderByMap.alunoNome;
    const orderDirection = order === 'desc' ? 'DESC' : 'ASC';

    const whereBase = buildWhereClause([
      cursoParamIndex ? `t."cursoId" = $${cursoParamIndex}` : false,
      buildTurmaInClause('i."turmaId"'),
      alunoParamIndex ? `i."alunoId" = $${alunoParamIndex}` : false,
    ]);

    const whereManuais = buildWhereClause([
      cursoParamIndex ? `tm."cursoId" = $${cursoParamIndex}` : false,
      buildTurmaInClause('n."turmaId"'),
      `n."provaId" IS NULL`,
    ]);

    const whereNotasAll = buildWhereClause([
      cursoParamIndex ? `tm."cursoId" = $${cursoParamIndex}` : false,
      buildTurmaInClause('n."turmaId"'),
    ]);

    const rows = await prisma.$queryRawUnsafe<
      {
        curso_id: string;
        curso_nome: string;
        turma_id: string;
        turma_nome: string;
        turma_codigo: string;
        inscricao_id: string;
        aluno_id: string;
        aluno_nome: string;
        aluno_codigo: string | null;
        aluno_cpf: string | null;
        aluno_matricula: string | null;
        aluno_avatar_url: string | null;
        nota_base: string | number;
        ajustes_manuais: string | number;
        nota_final_original: string | number;
        atualizado_em: Date | string | null;
      }[]
    >(
      `WITH base AS (
        SELECT
          i.id AS inscricao_id,
          i."turmaId" AS turma_id,
          SUM(COALESCE(e.nota, 0) * p.peso) AS soma_ponderada,
          SUM(p.peso) AS soma_pesos,
          MAX(e."atualizadoEm") AS envios_atualizado_em
        FROM "CursosTurmasInscricoes" i
        INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
        INNER JOIN "CursosTurmasProvas" p
          ON p."turmaId" = i."turmaId"
         AND p.ativo = true
        LEFT JOIN "CursosTurmasProvasEnvios" e
          ON e."provaId" = p.id
         AND e."inscricaoId" = i.id
        ${whereBase}
        GROUP BY i.id, i."turmaId"
      ),
      manuais AS (
        SELECT
          n."inscricaoId" AS inscricao_id,
          SUM(COALESCE(n.nota, 0)) AS soma_manual
        FROM "CursosNotas" n
        INNER JOIN "CursosTurmas" tm ON tm.id = n."turmaId"
        ${whereManuais}
        GROUP BY n."inscricaoId"
      ),
      notas_all AS (
        SELECT
          n."inscricaoId" AS inscricao_id,
          MAX(n."atualizadoEm") AS notas_atualizado_em
        FROM "CursosNotas" n
        INNER JOIN "CursosTurmas" tm ON tm.id = n."turmaId"
        ${whereNotasAll}
        GROUP BY n."inscricaoId"
      )
      SELECT
        t."cursoId" AS curso_id,
        c.nome AS curso_nome,
        i."turmaId" AS turma_id,
        t.nome AS turma_nome,
        t.codigo AS turma_codigo,
        i.id AS inscricao_id,
        i."alunoId" AS aluno_id,
        u."nomeCompleto" AS aluno_nome,
        u."codUsuario" AS aluno_codigo,
        u.cpf AS aluno_cpf,
        ui.inscricao AS aluno_matricula,
        ui."avatarUrl" AS aluno_avatar_url,
        CASE
          WHEN COALESCE(base.soma_pesos, 0) = 0 THEN 0
          ELSE (COALESCE(base.soma_ponderada, 0) / base.soma_pesos)
        END AS nota_base,
        COALESCE(manuais.soma_manual, 0) AS ajustes_manuais,
        LEAST(
          10,
          CASE
            WHEN COALESCE(base.soma_pesos, 0) = 0 THEN 0
            ELSE (COALESCE(base.soma_ponderada, 0) / base.soma_pesos)
          END + COALESCE(manuais.soma_manual, 0)
        ) AS nota_final_original,
        NULLIF(
          GREATEST(
            COALESCE(notas_all.notas_atualizado_em, 'epoch'::timestamp),
            COALESCE(base.envios_atualizado_em, 'epoch'::timestamp),
            COALESCE(i."criadoEm", 'epoch'::timestamp)
          ),
          'epoch'::timestamp
        ) AS atualizado_em
      FROM "CursosTurmasInscricoes" i
      INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
      INNER JOIN "Cursos" c ON c.id = t."cursoId"
      INNER JOIN "Usuarios" u ON u.id = i."alunoId"
      LEFT JOIN "UsuariosInformation" ui ON ui."usuarioId" = u.id
      LEFT JOIN base ON base.inscricao_id = i.id
      LEFT JOIN manuais ON manuais.inscricao_id = i.id
      LEFT JOIN notas_all ON notas_all.inscricao_id = i.id
      ${whereMain}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT ${pageSize} OFFSET ${skip}`,
      ...baseParams,
    );

    const inscricaoIds = rows.map((r) => r.inscricao_id);
    const notasManuaisWhere: Prisma.CursosNotasWhereInput = {
      inscricaoId: { in: inscricaoIds },
      provaId: null,
    };

    if (turmaIds && turmaIds.length > 0) {
      notasManuaisWhere.turmaId = { in: turmaIds };
    }

    const manuais = inscricaoIds.length
      ? await prisma.cursosNotas.findMany({
          where: notasManuaisWhere,
          orderBy: [{ atualizadoEm: 'desc' }, { criadoEm: 'desc' }],
          select: {
            id: true,
            inscricaoId: true,
            nota: true,
            titulo: true,
            descricao: true,
            referenciaExterna: true,
            criadoEm: true,
            atualizadoEm: true,
          },
        })
      : [];

    const { historicoPorInscricao, ultimaOrigemManualPorInscricao } =
      await buildManualNotasPayload(manuais);

    return {
      items: rows.map((row) => {
        const hasManual = historicoPorInscricao.has(row.inscricao_id);
        const origemPayload = ultimaOrigemManualPorInscricao.get(row.inscricao_id)?.origem ?? {
          tipo: 'SISTEMA' as const,
          id: null,
          titulo: 'Cálculo automático do sistema',
        };

        return {
          cursoId: row.curso_id,
          cursoNome: row.curso_nome,
          turmaId: row.turma_id,
          turmaNome: row.turma_nome,
          turmaCodigo: row.turma_codigo,
          inscricaoId: row.inscricao_id,
          alunoId: row.aluno_id,
          alunoNome: row.aluno_nome,
          avatarUrl: row.aluno_avatar_url,
          cpf: row.aluno_cpf,
          matricula: row.aluno_matricula ?? row.aluno_codigo,
          nota: Number(row.nota_final_original),
          atualizadoEm:
            row.atualizado_em instanceof Date
              ? row.atualizado_em.toISOString()
              : row.atualizado_em
                ? new Date(row.atualizado_em).toISOString()
                : null,
          motivo:
            ultimaOrigemManualPorInscricao.get(row.inscricao_id)?.motivo ??
            'Nota consolidada automaticamente pelo sistema',
          origem: origemPayload,
          isManual: hasManual,
          history: historicoPorInscricao.get(row.inscricao_id) ?? [],
          alunoCodigo: row.aluno_codigo,
          alunoCpf: row.aluno_cpf,
          alunoMatricula: row.aluno_matricula,
          notaBase: Number(row.nota_base),
          ajustesManuais: Number(row.ajustes_manuais),
          notaFinalOriginal: Number(row.nota_final_original),
        };
      }),
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalPages: totalPages || 1,
        hasNext: totalPages > 0 && safePage < totalPages,
        hasPrevious: safePage > 1,
        isPageAdjusted: safePage !== page,
      },
    };
  },
};

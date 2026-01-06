import { CursosNotasTipo, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { mapNota, NotaWithRelations, notaWithRelations } from './notas.mapper';
import type { CreateNotaManualInput, ListCursoNotasQuery } from '../validators/notas.schema';

const notasLogger = logger.child({ module: 'CursosNotasService' });

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
    criadoPorId?: string,
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

      const referenciaExterna =
        data.origem && data.origem.tipo
          ? `${data.origem.tipo}${data.origem.id ? `:${data.origem.id}` : ''}`
          : null;

      const nota = await tx.cursosNotas.create({
        data: {
          turmaId,
          inscricaoId: inscricao.id,
          tipo: CursosNotasTipo.BONUS,
          provaId: null,
          referenciaExterna,
          titulo: data.motivo,
          descricao: data.origem?.titulo ?? null,
          nota: new Prisma.Decimal(data.nota),
          peso: null,
          valorMaximo: null,
          dataReferencia: new Date(),
          observacoes: null,
        },
        include: notaWithRelations.include,
      });

      if (criadoPorId) {
        try {
          await tx.cursosNotas.update({
            where: { id: nota.id },
            data: { observacoes: `criadoPor:${criadoPorId}` },
          });
        } catch {
          // best-effort (campo observacoes é opcional)
        }
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
      const error: any = new Error(
        'Uma ou mais turmas não foram encontradas para o curso informado',
      );
      error.code = 'TURMA_NOT_FOUND';
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
        turma_id: string;
        inscricao_id: string;
        aluno_id: string;
        aluno_nome: string;
        aluno_codigo: string | null;
        aluno_cpf: string | null;
        aluno_matricula: string | null;
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
        i."turmaId" AS turma_id,
        i.id AS inscricao_id,
        i."alunoId" AS aluno_id,
        u."nomeCompleto" AS aluno_nome,
        u."codUsuario" AS aluno_codigo,
        u.cpf AS aluno_cpf,
        ui.inscricao AS aluno_matricula,
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
        GREATEST(
          COALESCE(notas_all.notas_atualizado_em, 'epoch'::timestamp),
          COALESCE(base.envios_atualizado_em, 'epoch'::timestamp)
        ) AS atualizado_em
      FROM "CursosTurmasInscricoes" i
      INNER JOIN "CursosTurmas" t ON t.id = i."turmaId"
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
          orderBy: { criadoEm: 'desc' },
          select: {
            id: true,
            inscricaoId: true,
            nota: true,
            titulo: true,
            criadoEm: true,
          },
        })
      : [];

    const historicoPorInscricao = new Map<
      string,
      { id: string; action: 'ADDED'; at: string; nota: number; motivo: string | null }[]
    >();
    for (const item of manuais) {
      const list = historicoPorInscricao.get(item.inscricaoId) ?? [];
      list.push({
        id: item.id,
        action: 'ADDED',
        at: item.criadoEm.toISOString(),
        nota: item.nota ? Number(item.nota) : 0,
        motivo: item.titulo ?? null,
      });
      historicoPorInscricao.set(item.inscricaoId, list);
    }

    return {
      items: rows.map((row) => ({
        cursoId: row.curso_id,
        turmaId: row.turma_id,
        inscricaoId: row.inscricao_id,
        alunoId: row.aluno_id,
        alunoNome: row.aluno_nome,
        alunoCodigo: row.aluno_codigo,
        alunoCpf: row.aluno_cpf,
        alunoMatricula: row.aluno_matricula,
        notaBase: Number(row.nota_base),
        ajustesManuais: Number(row.ajustes_manuais),
        notaFinalOriginal: Number(row.nota_final_original),
        atualizadoEm:
          row.atualizado_em instanceof Date
            ? row.atualizado_em.toISOString()
            : row.atualizado_em
              ? new Date(row.atualizado_em).toISOString()
              : null,
        history: historicoPorInscricao.get(row.inscricao_id) ?? [],
      })),
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

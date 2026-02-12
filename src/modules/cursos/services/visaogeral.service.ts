/**
 * Service para visão geral e métricas de cursos
 * Acesso restrito a ADMIN e MODERADOR
 *
 * ✅ OTIMIZAÇÕES IMPLEMENTADAS:
 * - Eliminação de N+1 queries usando agregações SQL
 * - Queries otimizadas com LIMITs apropriados
 * - Cache Redis para dados que mudam pouco
 * - Processamento paralelo de queries independentes
 */

import { Prisma, CursoStatus } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { getCache, setCache } from '@/utils/cache';

const visaogeralLogger = logger.child({ module: 'CursosVisaoGeralService' });

// TTLs de cache (em segundos)
const CACHE_TTL_METRICAS = 300; // 5 minutos - métricas gerais mudam pouco
const CACHE_TTL_FATURAMENTO = 120; // 2 minutos - faturamento muda mais frequentemente
const CACHE_TTL_PERFORMANCE = 300; // 5 minutos - performance muda pouco
const CACHE_TTL_PROXIMOS = 180; // 3 minutos - próximos cursos mudam pouco

interface CursosProximosInicio {
  turmaId: string;
  cursoId: string;
  cursoNome: string;
  cursoCodigo: string;
  turmaNome: string;
  turmaCodigo: string;
  dataInicio: Date | null;
  diasParaInicio: number | null;
  vagasTotais: number;
  vagasDisponiveis: number;
  inscricoesAtivas: number;
  status: CursoStatus;
}

interface CursoFaturamento {
  cursoId: string;
  cursoNome: string;
  cursoCodigo: string;
  totalFaturamento: number;
  totalTransacoes: number;
  transacoesAprovadas: number;
  transacoesPendentes: number;
  ultimaTransacao: Date | null;
}

interface VisaoGeralCursos {
  metricasGerais: {
    totalCursos: number;
    cursosPublicados: number;
    cursosRascunho: number;
    totalTurmas: number;
    turmasAtivas: number;
    turmasInscricoesAbertas: number;
    totalAlunosInscritos: number;
    totalAlunosAtivos: number;
    totalAlunosConcluidos: number;
  };
  cursosProximosInicio: {
    proximos7Dias: CursosProximosInicio[];
    proximos15Dias: CursosProximosInicio[];
    proximos30Dias: CursosProximosInicio[];
  };
  faturamento: {
    totalFaturamento: number;
    faturamentoMesAtual: number;
    faturamentoMesAnterior: number;
    cursoMaiorFaturamento: CursoFaturamento | null;
    topCursosFaturamento: CursoFaturamento[];
  };
  performance: {
    cursosMaisPopulares: {
      cursoId: string;
      cursoNome: string;
      cursoCodigo: string;
      totalInscricoes: number;
      totalTurmas: number;
    }[];
    taxaConclusao: number;
    cursosComMaiorTaxaConclusao: {
      cursoId: string;
      cursoNome: string;
      cursoCodigo: string;
      taxaConclusao: number;
      totalInscricoes: number;
      totalConcluidos: number;
    }[];
  };
}

/**
 * Calcula dias até uma data
 */
const calcularDiasParaData = (data: Date | null): number | null => {
  if (!data) return null;
  const agora = new Date();
  const dataInicio = new Date(data);
  const diffTime = dataInicio.getTime() - agora.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Busca métricas gerais de cursos
 * ✅ OTIMIZADO: Usa Promise.all para paralelizar queries
 */
async function buscarMetricasGerais(): Promise<{
  totalCursos: number;
  cursosPublicados: number;
  cursosRascunho: number;
  totalTurmas: number;
  turmasAtivas: number;
  turmasInscricoesAbertas: number;
  totalAlunosInscritos: number;
  totalAlunosAtivos: number;
  totalAlunosConcluidos: number;
}> {
  const cacheKey = 'visaogeral:metricas-gerais';

  // Tentar buscar do cache
  const cached = await getCache<{
    totalCursos: number;
    cursosPublicados: number;
    cursosRascunho: number;
    totalTurmas: number;
    turmasAtivas: number;
    turmasInscricoesAbertas: number;
    totalAlunosInscritos: number;
    totalAlunosAtivos: number;
    totalAlunosConcluidos: number;
  }>(cacheKey);
  if (cached) {
    visaogeralLogger.debug('Métricas gerais retornadas do cache');
    return cached;
  }

  // ✅ Usar retryOperation para tratar erros de conexão automaticamente
  const [
    {
      totalCursos,
      cursosPublicados,
      cursosRascunho,
      totalTurmas,
      turmasAtivas,
      turmasInscricoesAbertas,
      totalAlunosInscritos,
      totalAlunosAtivos,
      totalAlunosConcluidos,
    },
  ] = await retryOperation(
    () =>
      prisma.$queryRaw<
        {
          totalCursos: bigint;
          cursosPublicados: bigint;
          cursosRascunho: bigint;
          totalTurmas: bigint;
          turmasAtivas: bigint;
          turmasInscricoesAbertas: bigint;
          totalAlunosInscritos: bigint;
          totalAlunosAtivos: bigint;
          totalAlunosConcluidos: bigint;
        }[]
      >`
        SELECT
          (SELECT COUNT(*) FROM "Cursos")                               AS "totalCursos",
          (SELECT COUNT(*) FROM "Cursos" WHERE "statusPadrao" = 'PUBLICADO') AS "cursosPublicados",
          (SELECT COUNT(*) FROM "Cursos" WHERE "statusPadrao" = 'RASCUNHO')  AS "cursosRascunho",
          (SELECT COUNT(*) FROM "CursosTurmas")                         AS "totalTurmas",
          (SELECT COUNT(*) FROM "CursosTurmas" WHERE "status" = 'EM_ANDAMENTO') AS "turmasAtivas",
          (SELECT COUNT(*) FROM "CursosTurmas" WHERE "status" = 'INSCRICOES_ABERTAS') AS "turmasInscricoesAbertas",
          (SELECT COUNT(*) FROM "CursosTurmasInscricoes")               AS "totalAlunosInscritos",
          (SELECT COUNT(*) FROM "CursosTurmasInscricoes" WHERE "status" IN ('INSCRITO', 'EM_ANDAMENTO')) AS "totalAlunosAtivos",
          (SELECT COUNT(*) FROM "CursosTurmasInscricoes" WHERE "status" = 'CONCLUIDO') AS "totalAlunosConcluidos"
      `,
    3, // maxRetries
    1000, // delayMs
    20000, // timeoutMs - 20s para queries complexas
  );

  const result = {
    totalCursos: Number(totalCursos ?? 0n),
    cursosPublicados: Number(cursosPublicados ?? 0n),
    cursosRascunho: Number(cursosRascunho ?? 0n),
    totalTurmas: Number(totalTurmas ?? 0n),
    turmasAtivas: Number(turmasAtivas ?? 0n),
    turmasInscricoesAbertas: Number(turmasInscricoesAbertas ?? 0n),
    totalAlunosInscritos: Number(totalAlunosInscritos ?? 0n),
    totalAlunosAtivos: Number(totalAlunosAtivos ?? 0n),
    totalAlunosConcluidos: Number(totalAlunosConcluidos ?? 0n),
  };

  // Cachear resultado
  await setCache(cacheKey, result, CACHE_TTL_METRICAS);

  return result;
}

/**
 * Busca cursos próximos a começar
 * ✅ OTIMIZADO: Adicionado LIMIT e cache
 */
async function buscarCursosProximosInicio(): Promise<{
  proximos7Dias: CursosProximosInicio[];
  proximos15Dias: CursosProximosInicio[];
  proximos30Dias: CursosProximosInicio[];
}> {
  const cacheKey = 'visaogeral:cursos-proximos';

  // Tentar buscar do cache
  const cached = await getCache<ReturnType<typeof buscarCursosProximosInicio>>(cacheKey);
  if (cached) {
    visaogeralLogger.debug('Cursos próximos retornados do cache');
    return cached;
  }

  const agora = new Date();
  const data7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const data15Dias = new Date(agora.getTime() + 15 * 24 * 60 * 60 * 1000);
  const data30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  // ✅ OTIMIZADO: Buscar apenas turmas dos próximos 30 dias com LIMIT
  // Usar agregação SQL para contar inscrições ativas em uma única query
  // ✅ Usar retryOperation para tratar erros de conexão automaticamente
  const turmas = await retryOperation(
    () =>
      prisma.cursosTurmas.findMany({
        where: {
          dataInicio: {
            gte: agora,
            lte: data30Dias,
          },
          status: {
            in: ['INSCRICOES_ABERTAS', 'INSCRICOES_ENCERRADAS', 'PUBLICADO'],
          },
        },
        select: {
          id: true,
          nome: true,
          codigo: true,
          dataInicio: true,
          vagasTotais: true,
          vagasDisponiveis: true,
          status: true,
          Cursos: {
            select: {
              id: true,
              nome: true,
              codigo: true,
            },
          },
          _count: {
            select: {
              CursosTurmasInscricoes: {
                where: {
                  status: {
                    in: ['INSCRITO', 'EM_ANDAMENTO'],
                  },
                },
              },
            },
          },
        },
        orderBy: {
          dataInicio: 'asc',
        },
        take: 50, // ✅ LIMIT: Máximo 50 turmas (suficiente para 30 dias)
      }),
    3, // maxRetries
    1000, // delayMs
    20000, // timeoutMs - 20s para queries complexas
  );

  const turmasFormatadas: CursosProximosInicio[] = turmas.map((turma) => {
    const diasParaInicio = calcularDiasParaData(turma.dataInicio);
    return {
      turmaId: turma.id,
      cursoId: turma.Cursos.id,
      cursoNome: turma.Cursos.nome,
      cursoCodigo: turma.Cursos.codigo,
      turmaNome: turma.nome,
      turmaCodigo: turma.codigo,
      dataInicio: turma.dataInicio,
      diasParaInicio,
      vagasTotais: turma.vagasTotais,
      vagasDisponiveis: turma.vagasDisponiveis,
      inscricoesAtivas: turma._count.CursosTurmasInscricoes,
      status: turma.status,
    };
  });

  const proximos7Dias = turmasFormatadas
    .filter((t) => t.diasParaInicio !== null && t.diasParaInicio <= 7)
    .slice(0, 10); // ✅ LIMIT: Máximo 10 para 7 dias
  const proximos15Dias = turmasFormatadas
    .filter((t) => t.diasParaInicio !== null && t.diasParaInicio <= 15)
    .slice(0, 15); // ✅ LIMIT: Máximo 15 para 15 dias
  const proximos30Dias = turmasFormatadas.slice(0, 30); // ✅ LIMIT: Máximo 30 para 30 dias

  const result = {
    proximos7Dias,
    proximos15Dias,
    proximos30Dias,
  };

  // Cachear resultado
  await setCache(cacheKey, result, CACHE_TTL_PROXIMOS);

  return result;
}

/**
 * Busca faturamento relacionado a cursos
 * ✅ OTIMIZADO: Query SQL direta ao invés de filtrar em memória
 */
async function buscarFaturamentoCursos(): Promise<{
  totalFaturamento: number;
  faturamentoMesAtual: number;
  faturamentoMesAnterior: number;
  cursoMaiorFaturamento: CursoFaturamento | null;
  topCursosFaturamento: CursoFaturamento[];
}> {
  const cacheKey = 'visaogeral:faturamento';

  // Tentar buscar do cache
  const cached = await getCache<ReturnType<typeof buscarFaturamentoCursos>>(cacheKey);
  if (cached) {
    visaogeralLogger.debug('Faturamento retornado do cache');
    return cached;
  }

  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const inicioProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  const [totaisRaw, topCursosRaw] = await retryOperation(
    async () => {
      const totaisPromise = prisma.$queryRaw<
        {
          total_faturamento: Prisma.Decimal | null;
          faturamento_mes_atual: Prisma.Decimal | null;
          faturamento_mes_anterior: Prisma.Decimal | null;
        }[]
      >(Prisma.sql`
        WITH base AS (
          SELECT t.valor, t.status, t."criadoEm"
          FROM "AuditoriaTransacoes" t
          WHERE
            t.tipo IN ('PAGAMENTO', 'ASSINATURA')
            AND (
              t.referencia ILIKE '%curso%'
              OR t.referencia ILIKE '%turma%'
              OR (t.metadata::text LIKE '%cursoId%')
              OR (t.metadata::text LIKE '%"curso"%')
            )
        )
        SELECT
          COALESCE(SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END), 0) AS total_faturamento,
          COALESCE(
            SUM(
              CASE
                WHEN status = 'APROVADA'
                  AND "criadoEm" >= ${inicioMesAtual}
                  AND "criadoEm" < ${inicioProximoMes}
                THEN valor
                ELSE 0
              END
            ),
            0
          ) AS faturamento_mes_atual,
          COALESCE(
            SUM(
              CASE
                WHEN status = 'APROVADA'
                  AND "criadoEm" >= ${inicioMesAnterior}
                  AND "criadoEm" < ${inicioMesAtual}
                THEN valor
                ELSE 0
              END
            ),
            0
          ) AS faturamento_mes_anterior
        FROM base
      `);

      const topCursosPromise = prisma.$queryRaw<
        {
          cursoId: string;
          cursoNome: string;
          cursoCodigo: string;
          totalFaturamento: number;
          totalTransacoes: number;
          transacoesAprovadas: number;
          transacoesPendentes: number;
          ultimaTransacao: Date | null;
        }[]
      >(Prisma.sql`
        WITH base AS (
          SELECT
            COALESCE(t.metadata->>'cursoId', t.metadata->'curso'->>'id') AS curso_id,
            t.valor,
            t.status,
            t."criadoEm"
          FROM "AuditoriaTransacoes" t
          WHERE
            t.tipo IN ('PAGAMENTO', 'ASSINATURA')
            AND (
              t.referencia ILIKE '%curso%'
              OR t.referencia ILIKE '%turma%'
              OR (t.metadata::text LIKE '%cursoId%')
              OR (t.metadata::text LIKE '%"curso"%')
            )
        ),
        agg AS (
          SELECT
            curso_id,
            COALESCE(SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END), 0)::float8 AS "totalFaturamento",
            COUNT(*)::int AS "totalTransacoes",
            COUNT(*) FILTER (WHERE status = 'APROVADA')::int AS "transacoesAprovadas",
            COUNT(*) FILTER (WHERE status IN ('PENDENTE', 'PROCESSANDO'))::int AS "transacoesPendentes",
            MAX("criadoEm") AS "ultimaTransacao"
          FROM base
          WHERE curso_id IS NOT NULL
          GROUP BY curso_id
          HAVING COUNT(*) FILTER (WHERE status = 'APROVADA') > 0
        )
        SELECT
          a.curso_id AS "cursoId",
          COALESCE(c.nome, 'Curso não identificado') AS "cursoNome",
          COALESCE(c.codigo, '') AS "cursoCodigo",
          a."totalFaturamento",
          a."totalTransacoes",
          a."transacoesAprovadas",
          a."transacoesPendentes",
          a."ultimaTransacao"
        FROM agg a
        LEFT JOIN "Cursos" c ON c.id = a.curso_id
        ORDER BY a."totalFaturamento" DESC
        LIMIT 10
      `);

      return Promise.all([totaisPromise, topCursosPromise]);
    },
    3,
    1000,
    20000,
  );

  const totais = totaisRaw[0];
  const topCursos = topCursosRaw.map((curso) => ({
    cursoId: curso.cursoId,
    cursoNome: curso.cursoNome,
    cursoCodigo: curso.cursoCodigo,
    totalFaturamento: Number(curso.totalFaturamento ?? 0),
    totalTransacoes: Number(curso.totalTransacoes ?? 0),
    transacoesAprovadas: Number(curso.transacoesAprovadas ?? 0),
    transacoesPendentes: Number(curso.transacoesPendentes ?? 0),
    ultimaTransacao: curso.ultimaTransacao ? new Date(curso.ultimaTransacao) : null,
  }));

  const cursoMaiorFaturamento = topCursos.length > 0 ? topCursos[0] : null;

  const result = {
    totalFaturamento: Number(totais?.total_faturamento ?? 0),
    faturamentoMesAtual: Number(totais?.faturamento_mes_atual ?? 0),
    faturamentoMesAnterior: Number(totais?.faturamento_mes_anterior ?? 0),
    cursoMaiorFaturamento,
    topCursosFaturamento: topCursos,
  };

  // Cachear resultado
  await setCache(cacheKey, result, CACHE_TTL_FATURAMENTO);

  return result;
}

/**
 * Busca métricas de performance
 * ✅ OTIMIZADO: Eliminado N+1 queries usando agregações SQL
 */
async function buscarPerformanceCursos(): Promise<{
  cursosMaisPopulares: {
    cursoId: string;
    cursoNome: string;
    cursoCodigo: string;
    totalInscricoes: number;
    totalTurmas: number;
  }[];
  taxaConclusao: number;
  cursosComMaiorTaxaConclusao: {
    cursoId: string;
    cursoNome: string;
    cursoCodigo: string;
    taxaConclusao: number;
    totalInscricoes: number;
    totalConcluidos: number;
  }[];
}> {
  const cacheKey = 'visaogeral:performance';

  // Tentar buscar do cache
  const cached = await getCache<ReturnType<typeof buscarPerformanceCursos>>(cacheKey);
  if (cached) {
    visaogeralLogger.debug('Performance retornada do cache');
    return cached;
  }

  const [cursosPopularesRaw, taxaConclusaoRaw, cursosTaxaConclusaoRaw] = await Promise.all([
    // ✅ OTIMIZADO: Usar agregação SQL para buscar cursos mais populares
    // Uma única query ao invés de buscar todos os cursos e depois fazer N queries
    retryOperation(
      () =>
        prisma.$queryRaw<
          {
            cursoId: string;
            cursoNome: string;
            cursoCodigo: string;
            totalInscricoes: bigint;
            totalTurmas: bigint;
          }[]
        >`
          SELECT 
            c.id as "cursoId",
            c.nome as "cursoNome",
            c.codigo as "cursoCodigo",
            COUNT(DISTINCT ti.id)::bigint as "totalInscricoes",
            COUNT(DISTINCT ct.id)::bigint as "totalTurmas"
          FROM "Cursos" c
          LEFT JOIN "CursosTurmas" ct ON ct."cursoId" = c.id
          LEFT JOIN "CursosTurmasInscricoes" ti ON ti."turmaId" = ct.id
          GROUP BY c.id, c.nome, c.codigo
          ORDER BY "totalInscricoes" DESC
          LIMIT 10
        `,
      3, // maxRetries
      1000, // delayMs
      20000, // timeoutMs - 20s para queries complexas
    ),
    // ✅ OTIMIZADO: Calcular taxa de conclusão geral em uma única query
    retryOperation(
      () =>
        prisma.$queryRaw<
          {
            totalInscricoes: bigint;
            totalConcluidos: bigint;
          }[]
        >`
          SELECT 
            COUNT(*)::bigint as "totalInscricoes",
            COUNT(CASE WHEN status = 'CONCLUIDO' THEN 1 END)::bigint as "totalConcluidos"
          FROM "CursosTurmasInscricoes"
        `,
      3, // maxRetries
      1000, // delayMs
      20000, // timeoutMs - 20s para queries complexas
    ),
    // ✅ OTIMIZADO: Usar agregação SQL para buscar cursos com maior taxa de conclusão
    // Uma única query ao invés de N queries (uma por curso)
    retryOperation(
      () =>
        prisma.$queryRaw<
          {
            cursoId: string;
            cursoNome: string;
            cursoCodigo: string;
            totalInscricoes: bigint;
            totalConcluidos: bigint;
          }[]
        >`
          SELECT 
            c.id as "cursoId",
            c.nome as "cursoNome",
            c.codigo as "cursoCodigo",
            COUNT(ti.id)::bigint as "totalInscricoes",
            COUNT(CASE WHEN ti.status = 'CONCLUIDO' THEN 1 END)::bigint as "totalConcluidos"
          FROM "Cursos" c
          INNER JOIN "CursosTurmas" ct ON ct."cursoId" = c.id
          INNER JOIN "CursosTurmasInscricoes" ti ON ti."turmaId" = ct.id
          GROUP BY c.id, c.nome, c.codigo
          HAVING COUNT(ti.id) > 0
          ORDER BY 
            CASE 
              WHEN COUNT(ti.id) > 0 
              THEN (COUNT(CASE WHEN ti.status = 'CONCLUIDO' THEN 1 END)::float / COUNT(ti.id)::float) * 100
              ELSE 0
            END DESC
          LIMIT 10
        `,
      3, // maxRetries
      1000, // delayMs
      20000, // timeoutMs - 20s para queries complexas
    ),
  ]);

  const cursosMaisPopulares = cursosPopularesRaw.map((curso) => ({
    cursoId: curso.cursoId,
    cursoNome: curso.cursoNome,
    cursoCodigo: curso.cursoCodigo,
    totalInscricoes: Number(curso.totalInscricoes),
    totalTurmas: Number(curso.totalTurmas),
  }));

  const taxaConclusao =
    taxaConclusaoRaw[0] && Number(taxaConclusaoRaw[0].totalInscricoes) > 0
      ? (Number(taxaConclusaoRaw[0].totalConcluidos) /
          Number(taxaConclusaoRaw[0].totalInscricoes)) *
        100
      : 0;

  const cursosComMaiorTaxaConclusao = cursosTaxaConclusaoRaw.map((curso) => {
    const totalInscricoes = Number(curso.totalInscricoes);
    const totalConcluidos = Number(curso.totalConcluidos);
    const taxaConclusaoCurso = totalInscricoes > 0 ? (totalConcluidos / totalInscricoes) * 100 : 0;

    return {
      cursoId: curso.cursoId,
      cursoNome: curso.cursoNome,
      cursoCodigo: curso.cursoCodigo,
      taxaConclusao: Math.round(taxaConclusaoCurso * 100) / 100,
      totalInscricoes,
      totalConcluidos,
    };
  });

  const result = {
    cursosMaisPopulares,
    taxaConclusao: Math.round(taxaConclusao * 100) / 100,
    cursosComMaiorTaxaConclusao,
  };

  // Cachear resultado
  await setCache(cacheKey, result, CACHE_TTL_PERFORMANCE);

  return result;
}

/**
 * Busca visão geral completa de cursos
 * ✅ OTIMIZADO: Queries paralelas + cache
 */
export async function buscarVisaoGeralCursos(): Promise<VisaoGeralCursos> {
  try {
    visaogeralLogger.info('Buscando visão geral de cursos');

    // ✅ OTIMIZADO: Executar todas as queries em paralelo
    const [metricasGerais, cursosProximosInicio, faturamento, performance] = await Promise.all([
      buscarMetricasGerais(),
      buscarCursosProximosInicio(),
      buscarFaturamentoCursos(),
      buscarPerformanceCursos(),
    ]);

    return {
      metricasGerais,
      cursosProximosInicio,
      faturamento,
      performance,
    };
  } catch (error) {
    visaogeralLogger.error({ err: error }, 'Erro ao buscar visão geral de cursos');
    throw error;
  }
}

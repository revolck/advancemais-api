import { Prisma } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { getCache, setCache } from '@/utils/cache';
import { logger } from '@/utils/logger';

const faturamentoLogger = logger.child({ module: 'CursosFaturamentoTendenciasService' });

const CACHE_TTL_SECONDS = 120;

export type FaturamentoPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface FaturamentoTendenciasQuery {
  period: FaturamentoPeriod;
  startDate?: string;
  endDate?: string;
  tz?: string;
  top?: number;
}

type HistoricalRow = {
  date: string;
  faturamento: number;
  transacoes: number;
  transacoesAprovadas: number;
  cursos: number;
};

type TopCursoRow = {
  cursoId: string;
  cursoNome: string;
  cursoCodigo: string;
  totalFaturamento: number;
  totalTransacoes: number;
  transacoesAprovadas: number;
  transacoesPendentes: number;
  ultimaTransacao: string | null;
};

const sanitizeTz = (tz?: string) => {
  const value = (tz ?? 'America/Sao_Paulo').trim();
  if (value.length < 3 || value.length > 64) return 'America/Sao_Paulo';
  // Evitar injeção em timezone: aceita apenas IANA simples
  if (!/^[A-Za-z_/-]+$/.test(value)) return 'America/Sao_Paulo';
  return value;
};

const clampTop = (top?: number) => {
  if (!Number.isFinite(top)) return 10;
  const value = Math.trunc(top as number);
  return Math.max(1, Math.min(50, value));
};

const validateCustomDates = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) {
    throw Object.assign(new Error('startDate e endDate são obrigatórios para period=custom'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(startDate) ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate)
  ) {
    throw Object.assign(new Error('Formato inválido de data. Use YYYY-MM-DD'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (endDate < startDate) {
    throw Object.assign(new Error('endDate deve ser >= startDate'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }
};

export async function buscarFaturamentoTendenciasCursos(query: FaturamentoTendenciasQuery) {
  const allowedPeriods: FaturamentoPeriod[] = ['day', 'week', 'month', 'year', 'custom'];
  const period = String(query.period) as FaturamentoPeriod;
  const tz = sanitizeTz(query.tz);
  const top = clampTop(query.top);

  if (!allowedPeriods.includes(period)) {
    throw Object.assign(new Error('period inválido. Use day|week|month|year|custom'), {
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  }

  if (period === 'custom') {
    validateCustomDates(query.startDate, query.endDate);
  }

  const cacheKey = `cursos:visaogeral:faturamento:tendencias:${period}:${query.startDate ?? ''}:${query.endDate ?? ''}:${tz}:${top}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  const cursosAtivosPromise = prisma.cursos.count({ where: { statusPadrao: 'PUBLICADO' } });

  const { bounds, totals, historicalData, topCursosFaturamento } = await retryOperation(
    async () => {
      const bounds = await prisma.$queryRaw<
        {
          start_local: Date;
          end_local_exclusive: Date;
          prev_start_local: Date;
          prev_end_local_exclusive: Date;
          start_date: string;
          end_date: string;
        }[]
      >(
        Prisma.sql`
          WITH inp AS (
            SELECT
              ${period}::text AS period,
              ${query.startDate ?? null}::date AS start_date,
              ${query.endDate ?? null}::date AS end_date,
              ${tz}::text AS tz,
              ((now() AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS now_local
          ),
          bounds AS (
            SELECT
              CASE period
                WHEN 'day' THEN date_trunc('day', now_local)
                WHEN 'week' THEN date_trunc('week', now_local)
                WHEN 'month' THEN date_trunc('month', now_local)
                WHEN 'year' THEN date_trunc('year', now_local)
                WHEN 'custom' THEN (start_date::timestamp)
                ELSE date_trunc('month', now_local)
              END AS start_local,
              CASE period
                WHEN 'day' THEN date_trunc('day', now_local) + interval '1 day'
                WHEN 'week' THEN date_trunc('week', now_local) + interval '1 week'
                WHEN 'month' THEN date_trunc('month', now_local) + interval '1 month'
                WHEN 'year' THEN date_trunc('year', now_local) + interval '1 year'
                WHEN 'custom' THEN ((end_date::timestamp) + interval '1 day')
                ELSE date_trunc('month', now_local) + interval '1 month'
              END AS end_local_exclusive
            FROM inp
          ),
          with_prev AS (
            SELECT
              start_local,
              end_local_exclusive,
              (start_local - (end_local_exclusive - start_local)) AS prev_start_local,
              start_local AS prev_end_local_exclusive,
              to_char(start_local::date, 'YYYY-MM-DD') AS start_date,
              to_char((end_local_exclusive - interval '1 day')::date, 'YYYY-MM-DD') AS end_date
            FROM bounds
          )
          SELECT * FROM with_prev
        `,
      );

      const b = bounds[0];

      const totals = await prisma.$queryRaw<
        {
          faturamento_atual: Prisma.Decimal | null;
          faturamento_anterior: Prisma.Decimal | null;
          total_transacoes: bigint;
          transacoes_aprovadas: bigint;
        }[]
      >(
        Prisma.sql`
          WITH bounds AS (
            SELECT
              ${b.start_local}::timestamp AS start_local,
              ${b.end_local_exclusive}::timestamp AS end_local_exclusive,
              ${b.prev_start_local}::timestamp AS prev_start_local,
              ${b.prev_end_local_exclusive}::timestamp AS prev_end_local_exclusive,
              ${tz}::text AS tz
          ),
          base AS (
            SELECT
              t.id,
              t.valor,
              t.status,
              t.tipo,
              t.referencia,
              t.metadata,
              t."criadoEm",
              ((t."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM bounds)) AS criado_local
            FROM "AuditoriaTransacoes" t
            WHERE
              t.tipo IN ('PAGAMENTO', 'ASSINATURA')
              AND (
                t.referencia ILIKE '%curso%'
                OR t.referencia ILIKE '%turma%'
                OR (t.metadata::text LIKE '%cursoId%')
                OR (t.metadata::text LIKE '%\"curso\"%')
              )
          ),
          atual AS (
            SELECT * FROM base
            WHERE criado_local >= (SELECT start_local FROM bounds)
              AND criado_local < (SELECT end_local_exclusive FROM bounds)
          ),
          anterior AS (
            SELECT * FROM base
            WHERE criado_local >= (SELECT prev_start_local FROM bounds)
              AND criado_local < (SELECT prev_end_local_exclusive FROM bounds)
          )
          SELECT
            COALESCE(SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END), 0) AS faturamento_atual,
            COALESCE((SELECT SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END) FROM anterior), 0) AS faturamento_anterior,
            COUNT(*)::bigint AS total_transacoes,
            COUNT(*) FILTER (WHERE status = 'APROVADA')::bigint AS transacoes_aprovadas
          FROM atual
        `,
      );

      const totalsRow = totals[0];

      const historicalData = await prisma.$queryRaw<HistoricalRow[]>(
        Prisma.sql`
          WITH bounds AS (
            SELECT
              ${b.start_local}::timestamp AS start_local,
              ${b.end_local_exclusive}::timestamp AS end_local_exclusive,
              ${period}::text AS period,
              ${tz}::text AS tz
          ),
          base AS (
            SELECT
              t.valor,
              t.status,
              ((t."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM bounds)) AS criado_local,
              COALESCE(t.metadata->>'cursoId', t.metadata->'curso'->>'id') AS curso_id
            FROM "AuditoriaTransacoes" t
            WHERE
              t.tipo IN ('PAGAMENTO', 'ASSINATURA')
              AND (
                t.referencia ILIKE '%curso%'
                OR t.referencia ILIKE '%turma%'
                OR (t.metadata::text LIKE '%cursoId%')
                OR (t.metadata::text LIKE '%\"curso\"%')
              )
          ),
          filtered AS (
            SELECT *
            FROM base
            WHERE criado_local >= (SELECT start_local FROM bounds)
              AND criado_local < (SELECT end_local_exclusive FROM bounds)
          ),
          bucketed AS (
            SELECT
              CASE (SELECT period FROM bounds)
                WHEN 'day' THEN date_trunc('hour', criado_local)
                WHEN 'year' THEN date_trunc('month', criado_local)
                ELSE date_trunc('day', criado_local)
              END AS bucket,
              valor,
              status,
              curso_id
            FROM filtered
          )
          SELECT
            CASE (SELECT period FROM bounds)
              WHEN 'day' THEN to_char(bucket, 'YYYY-MM-DD\"T\"HH24:00:00')
              WHEN 'year' THEN to_char(bucket, 'YYYY-MM')
              ELSE to_char(bucket, 'YYYY-MM-DD')
            END AS date,
            COALESCE(SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END), 0)::float8 AS faturamento,
            COUNT(*)::int AS transacoes,
            COUNT(*) FILTER (WHERE status = 'APROVADA')::int AS transacoesAprovadas,
            COUNT(DISTINCT curso_id)::int AS cursos
          FROM bucketed
          GROUP BY bucket
          ORDER BY bucket ASC
        `,
      );

      const topCursosFaturamento = await prisma.$queryRaw<TopCursoRow[]>(
        Prisma.sql`
          WITH bounds AS (
            SELECT
              ${b.start_local}::timestamp AS start_local,
              ${b.end_local_exclusive}::timestamp AS end_local_exclusive,
              ${tz}::text AS tz
          ),
          base AS (
            SELECT
              t.valor,
              t.status,
              t."criadoEm",
              ((t."criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE (SELECT tz FROM bounds)) AS criado_local,
              COALESCE(t.metadata->>'cursoId', t.metadata->'curso'->>'id') AS curso_id
            FROM "AuditoriaTransacoes" t
            WHERE
              t.tipo IN ('PAGAMENTO', 'ASSINATURA')
              AND (
                t.referencia ILIKE '%curso%'
                OR t.referencia ILIKE '%turma%'
                OR (t.metadata::text LIKE '%cursoId%')
                OR (t.metadata::text LIKE '%\"curso\"%')
              )
          ),
          filtered AS (
            SELECT *
            FROM base
            WHERE criado_local >= (SELECT start_local FROM bounds)
              AND criado_local < (SELECT end_local_exclusive FROM bounds)
              AND curso_id IS NOT NULL
          ),
          agg AS (
            SELECT
              curso_id,
              COALESCE(SUM(CASE WHEN status = 'APROVADA' THEN valor ELSE 0 END), 0)::float8 AS total_faturamento,
              COUNT(*)::int AS total_transacoes,
              COUNT(*) FILTER (WHERE status = 'APROVADA')::int AS transacoes_aprovadas,
              COUNT(*) FILTER (WHERE status IN ('PENDENTE','PROCESSANDO'))::int AS transacoes_pendentes,
              MAX("criadoEm") AS ultima_transacao
            FROM filtered
            GROUP BY curso_id
          )
          SELECT
            a.curso_id AS "cursoId",
            COALESCE(c.nome, 'Curso não identificado') AS "cursoNome",
            COALESCE(c.codigo, '') AS "cursoCodigo",
            a.total_faturamento AS "totalFaturamento",
            a.total_transacoes AS "totalTransacoes",
            a.transacoes_aprovadas AS "transacoesAprovadas",
            a.transacoes_pendentes AS "transacoesPendentes",
            CASE WHEN a.ultima_transacao IS NULL THEN NULL ELSE a.ultima_transacao::text END AS "ultimaTransacao"
          FROM agg a
          LEFT JOIN "Cursos" c ON c.id = a.curso_id
          ORDER BY a.total_faturamento DESC
          LIMIT ${top}
        `,
      );

      return {
        bounds: {
          startDate: b.start_date,
          endDate: b.end_date,
        },
        totals: {
          faturamentoAtual: Number(totalsRow?.faturamento_atual ?? 0),
          faturamentoAnterior: Number(totalsRow?.faturamento_anterior ?? 0),
          totalTransacoes: Number(totalsRow?.total_transacoes ?? 0n),
          transacoesAprovadas: Number(totalsRow?.transacoes_aprovadas ?? 0n),
        },
        historicalData,
        topCursosFaturamento,
      };
    },
    2,
    500,
    20000,
  );

  const cursosAtivos = await cursosAtivosPromise;

  const faturamentoMesAtual = totals.faturamentoAtual;
  const faturamentoMesAnterior = totals.faturamentoAnterior;

  const result = {
    success: true,
    data: {
      period,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      faturamentoMesAtual,
      faturamentoMesAnterior,
      totalTransacoes: totals.totalTransacoes,
      transacoesAprovadas: totals.transacoesAprovadas,
      cursosAtivos,
      historicalData,
      topCursosFaturamento,
      cursoMaiorFaturamento: topCursosFaturamento.length > 0 ? topCursosFaturamento[0] : null,
    },
  };

  await setCache(cacheKey, result, CACHE_TTL_SECONDS);
  faturamentoLogger.debug({ period, tz }, 'Faturamento de tendências cacheado');

  return result;
}

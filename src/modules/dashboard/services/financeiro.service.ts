import { Prisma, TransacaoStatus, TransacaoTipo } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { transacoesService } from '@/modules/auditoria/services/transacoes.service';
import { logger } from '@/utils/logger';
import type { DashboardFinanceiroFilters } from '../validators/financeiro.schema';

const financeiroLogger = logger.child({ module: 'DashboardFinanceiroService' });

const transacaoInclude = {
  Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      codUsuario: true,
      role: true,
    },
  },
  Usuarios_AuditoriaTransacoes_empresaIdToUsuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      codUsuario: true,
      role: true,
    },
  },
} satisfies Prisma.AuditoriaTransacoesInclude;

type FinanceiroTransacaoRow = Prisma.AuditoriaTransacoesGetPayload<{
  include: typeof transacaoInclude;
}>;

type FinanceiroMeta = Record<string, unknown>;

type DateRange = {
  periodo: DashboardFinanceiroFilters['periodo'];
  mesReferencia: string | null;
  dataInicio: Date;
  dataFim: Date;
  agruparPor: 'day' | 'week' | 'month';
  timezone: string;
};

type RankingItem = {
  position: number;
  name: string;
  value: number;
  valorFormatado: string;
};

type SubscriptionPlanRow = Prisma.EmpresasPlanoGetPayload<{
  include: {
    PlanosEmpresariais: { select: { id: true; nome: true } };
    Usuarios: { select: { id: true; nomeCompleto: true; codUsuario: true } };
  };
}>;

const tipoLabels: Record<TransacaoTipo, string> = {
  PAGAMENTO: 'Pagamento',
  REEMBOLSO: 'Reembolso',
  ESTORNO: 'Estorno',
  ASSINATURA: 'Assinatura',
  CUPOM: 'Cupom',
  TAXA: 'Taxa',
};

const statusLabels: Record<TransacaoStatus, string> = {
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
};

const gatewayLabels: Record<string, string> = {
  MERCADO_PAGO: 'Mercado Pago',
  MERCADOPAGO: 'Mercado Pago',
  STRIPE: 'Stripe',
  PAGARME: 'Pagar.me',
  MANUAL: 'Manual',
};

const asJsonObject = (value: Prisma.JsonValue | null): FinanceiroMeta | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as FinanceiroMeta;
};

const getString = (object: FinanceiroMeta | null, ...keys: string[]): string | null => {
  if (!object) {
    return null;
  }

  for (const key of keys) {
    const value = object[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const getNestedObject = (object: FinanceiroMeta | null, key: string): FinanceiroMeta | null => {
  if (!object) {
    return null;
  }

  const value = object[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as FinanceiroMeta;
};

const normalizeGateway = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[.]+/g, '')
    .toUpperCase();
};

const getGatewayLabel = (gateway: string | null): string | null => {
  if (!gateway) {
    return null;
  }

  return (
    gatewayLabels[gateway] ??
    gateway
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ')
  );
};

const formatCurrency = (value: number, currency: string = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);

const sumMonetaryValues = (rows: FinanceiroTransacaoRow[]) =>
  rows.reduce((sum, row) => sum + Math.round(Number(row.valor) * 100), 0) / 100;

const startOfCurrentUtcMonth = (baseDate: Date) =>
  new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0));

const endOfUtcMonth = (year: number, monthZeroBased: number) =>
  new Date(Date.UTC(year, monthZeroBased + 1, 0, 23, 59, 59, 999));

const startOfUtcMonth = (year: number, monthZeroBased: number) =>
  new Date(Date.UTC(year, monthZeroBased, 1, 0, 0, 0, 0));

const inferGrouping = (start: Date, end: Date): 'day' | 'week' | 'month' => {
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays > 120) {
    return 'month';
  }

  if (diffDays > 45) {
    return 'week';
  }

  return 'day';
};

const buildDateRange = (filters: DashboardFinanceiroFilters): DateRange => {
  const now = new Date();

  if (filters.mesReferencia) {
    const [year, month] = filters.mesReferencia.split('-').map(Number);
    const monthIndex = month - 1;
    const start = startOfUtcMonth(year, monthIndex);
    const end = endOfUtcMonth(year, monthIndex);

    return {
      periodo: 'month',
      mesReferencia: filters.mesReferencia,
      dataInicio: start,
      dataFim: end,
      agruparPor: filters.agruparPor ?? 'day',
      timezone: filters.timezone,
    };
  }

  if (filters.periodo === 'custom' && filters.dataInicio && filters.dataFim) {
    const start = new Date(filters.dataInicio);
    const end = new Date(filters.dataFim);

    return {
      periodo: 'custom',
      mesReferencia: null,
      dataInicio: start,
      dataFim: end,
      agruparPor: filters.agruparPor ?? inferGrouping(start, end),
      timezone: filters.timezone,
    };
  }

  if (filters.periodo === 'month') {
    const start = startOfCurrentUtcMonth(now);
    const end = endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth());

    return {
      periodo: 'month',
      mesReferencia: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
      dataInicio: start,
      dataFim: end,
      agruparPor: filters.agruparPor ?? 'day',
      timezone: filters.timezone,
    };
  }

  const end = now;
  let start = new Date(end);

  switch (filters.periodo) {
    case '7d':
      start.setUTCDate(start.getUTCDate() - 6);
      break;
    case '90d':
      start.setUTCDate(start.getUTCDate() - 89);
      break;
    case '12m':
      start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1, 0, 0, 0, 0));
      break;
    case '30d':
    default:
      start.setUTCDate(start.getUTCDate() - 29);
      break;
  }

  return {
    periodo: filters.periodo,
    mesReferencia: null,
    dataInicio: start,
    dataFim: end,
    agruparPor:
      filters.agruparPor ??
      (filters.periodo === '12m' ? 'month' : filters.periodo === '90d' ? 'week' : 'day'),
    timezone: filters.timezone,
  };
};

const buildPreviousRange = (range: DateRange) => {
  if (range.periodo === 'month') {
    const reference = new Date(range.dataInicio);
    const previousMonthStart = startOfUtcMonth(
      reference.getUTCMonth() === 0 ? reference.getUTCFullYear() - 1 : reference.getUTCFullYear(),
      reference.getUTCMonth() === 0 ? 11 : reference.getUTCMonth() - 1,
    );
    const previousMonthEnd = endOfUtcMonth(
      previousMonthStart.getUTCFullYear(),
      previousMonthStart.getUTCMonth(),
    );

    return {
      dataInicio: previousMonthStart,
      dataFim: previousMonthEnd,
    };
  }

  const durationMs = range.dataFim.getTime() - range.dataInicio.getTime() + 1;
  const previousEnd = new Date(range.dataInicio.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

  return {
    dataInicio: previousStart,
    dataFim: previousEnd,
  };
};

const calculateVariation = (currentValue: number, previousValue: number) => {
  if (previousValue === 0) {
    if (currentValue === 0) {
      return 0;
    }

    return 100;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
};

const calculateTrend = (currentValue: number, previousValue: number): 'up' | 'down' | 'stable' => {
  if (currentValue > previousValue) return 'up';
  if (currentValue < previousValue) return 'down';
  return 'stable';
};

const startOfUtcWeek = (date: Date) => {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const getWeekNumber = (date: Date) => {
  const weekStart = startOfUtcWeek(date);
  const yearStart = startOfUtcWeek(new Date(Date.UTC(weekStart.getUTCFullYear(), 0, 1)));
  const diffMs = weekStart.getTime() - yearStart.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
};

const formatBucketLabel = (date: Date, grouping: 'day' | 'week' | 'month') => {
  switch (grouping) {
    case 'month':
      return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
    case 'week':
      return `Sem ${String(getWeekNumber(date)).padStart(2, '0')}/${date.getUTCFullYear()}`;
    case 'day':
    default:
      return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
};

const getBucketKey = (date: Date, grouping: 'day' | 'week' | 'month') => {
  switch (grouping) {
    case 'month':
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    case 'week': {
      const weekStart = startOfUtcWeek(date);
      return `${weekStart.getUTCFullYear()}-W${String(getWeekNumber(weekStart)).padStart(2, '0')}`;
    }
    case 'day':
    default:
      return date.toISOString().slice(0, 10);
  }
};

const isApprovedRevenueRow = (row: FinanceiroTransacaoRow) =>
  row.status === TransacaoStatus.APROVADA &&
  (row.tipo === TransacaoTipo.PAGAMENTO || row.tipo === TransacaoTipo.ASSINATURA);

const isRefundRow = (row: FinanceiroTransacaoRow) =>
  row.tipo === TransacaoTipo.REEMBOLSO && row.status === TransacaoStatus.APROVADA;

const isChargebackRow = (row: FinanceiroTransacaoRow) =>
  row.tipo === TransacaoTipo.ESTORNO && row.status === TransacaoStatus.ESTORNADA;

const isPendingRow = (row: FinanceiroTransacaoRow) =>
  row.status === TransacaoStatus.PENDENTE || row.status === TransacaoStatus.PROCESSANDO;

const toValueLabelPairs = (map: Map<string, number>) =>
  [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export class DashboardFinanceiroService {
  async obterDashboard(filters: DashboardFinanceiroFilters) {
    try {
      const range = buildDateRange(filters);
      const previousRange = buildPreviousRange(range);

      const [currentRows, previousRows, subscriptionRows, preview] = await Promise.all([
        prisma.auditoriaTransacoes.findMany({
          where: {
            criadoEm: {
              gte: range.dataInicio,
              lte: range.dataFim,
            },
          },
          include: transacaoInclude,
          orderBy: { criadoEm: 'desc' },
        }),
        prisma.auditoriaTransacoes.findMany({
          where: {
            criadoEm: {
              gte: previousRange.dataInicio,
              lte: previousRange.dataFim,
            },
          },
          include: transacaoInclude,
        }),
        prisma.empresasPlano.findMany({
          where: {
            OR: [
              { criadoEm: { gte: range.dataInicio, lte: range.dataFim } },
              { atualizadoEm: { gte: range.dataInicio, lte: range.dataFim } },
              { proximaCobranca: { gte: range.dataInicio, lte: range.dataFim } },
              { status: 'ATIVO' },
            ],
          },
          include: {
            PlanosEmpresariais: {
              select: {
                id: true,
                nome: true,
              },
            },
            Usuarios: {
              select: {
                id: true,
                nomeCompleto: true,
                codUsuario: true,
              },
            },
          },
        }),
        transacoesService.listarTransacoesDashboard({
          page: 1,
          pageSize: filters.ultimasTransacoesLimit,
          search: undefined,
          tipos: [],
          status: [],
          usuarioId: undefined,
          empresaId: undefined,
          gateway: undefined,
          dataInicio: range.dataInicio.toISOString(),
          dataFim: range.dataFim.toISOString(),
          sortBy: 'criadoEm',
          sortDir: 'desc',
        }),
      ]);

      const currentMeta = await this.buildEnrichment(currentRows);
      const approvedRows = currentRows.filter(isApprovedRevenueRow);
      const previousApprovedRows = previousRows.filter(isApprovedRevenueRow);
      const refundRows = currentRows.filter(isRefundRow);
      const previousRefundRows = previousRows.filter(isRefundRow);
      const chargebackRows = currentRows.filter(isChargebackRow);
      const previousChargebackRows = previousRows.filter(isChargebackRow);
      const pendingRows = currentRows.filter(isPendingRow);
      const previousPendingRows = previousRows.filter(isPendingRow);

      const receitaBruta = sumMonetaryValues(approvedRows);
      const receitaBrutaAnterior = sumMonetaryValues(previousApprovedRows);
      const valorReembolsado = sumMonetaryValues(refundRows);
      const valorReembolsadoAnterior = sumMonetaryValues(previousRefundRows);
      const valorEstornado = sumMonetaryValues(chargebackRows);
      const valorEstornadoAnterior = sumMonetaryValues(previousChargebackRows);
      const receitaLiquida = roundCurrency(receitaBruta - valorReembolsado - valorEstornado);
      const receitaLiquidaAnterior = roundCurrency(
        receitaBrutaAnterior - valorReembolsadoAnterior - valorEstornadoAnterior,
      );
      const ticketMedio =
        approvedRows.length > 0 ? roundCurrency(receitaBruta / approvedRows.length) : 0;
      const ticketMedioAnterior =
        previousApprovedRows.length > 0
          ? roundCurrency(receitaBrutaAnterior / previousApprovedRows.length)
          : 0;
      const estornosEReembolsos = roundCurrency(valorReembolsado + valorEstornado);
      const estornosEReembolsosAnterior = roundCurrency(
        valorReembolsadoAnterior + valorEstornadoAnterior,
      );

      const evolucaoReceita = this.buildRevenueSeries(approvedRows, range.agruparPor);
      const evolucaoTransacoes = this.buildTransactionSeries(currentRows, range.agruparPor);
      const distribuicaoPorStatus = this.buildStatusDistribution(currentRows);
      const distribuicaoPorTipo = this.buildTypeDistribution(currentRows);
      const distribuicaoPorGateway = this.buildGatewayDistribution(currentRows);
      const rankings = this.buildRankings(approvedRows, currentMeta);
      const assinaturas = this.buildSubscriptionSummary(subscriptionRows, currentRows, range);

      return {
        filtrosAplicados: {
          periodo: range.periodo,
          mesReferencia: range.mesReferencia,
          dataInicio: range.dataInicio.toISOString(),
          dataFim: range.dataFim.toISOString(),
          agruparPor: range.agruparPor,
          timezone: range.timezone,
        },
        cards: {
          receitaBruta: {
            valor: receitaBruta,
            valorFormatado: formatCurrency(receitaBruta),
            variacaoPercentual: calculateVariation(receitaBruta, receitaBrutaAnterior),
            tendencia: calculateTrend(receitaBruta, receitaBrutaAnterior),
          },
          receitaLiquida: {
            valor: receitaLiquida,
            valorFormatado: formatCurrency(receitaLiquida),
            variacaoPercentual: calculateVariation(receitaLiquida, receitaLiquidaAnterior),
            tendencia: calculateTrend(receitaLiquida, receitaLiquidaAnterior),
          },
          ticketMedio: {
            valor: ticketMedio,
            valorFormatado: formatCurrency(ticketMedio),
            variacaoPercentual: calculateVariation(ticketMedio, ticketMedioAnterior),
            tendencia: calculateTrend(ticketMedio, ticketMedioAnterior),
          },
          transacoesAprovadas: {
            valor: approvedRows.length,
            variacaoPercentual: calculateVariation(
              approvedRows.length,
              previousApprovedRows.length,
            ),
            tendencia: calculateTrend(approvedRows.length, previousApprovedRows.length),
          },
          transacoesPendentes: {
            valor: pendingRows.length,
            variacaoPercentual: calculateVariation(pendingRows.length, previousPendingRows.length),
            tendencia: calculateTrend(pendingRows.length, previousPendingRows.length),
          },
          estornosEReembolsos: {
            valor: estornosEReembolsos,
            valorFormatado: formatCurrency(estornosEReembolsos),
            variacaoPercentual: calculateVariation(
              estornosEReembolsos,
              estornosEReembolsosAnterior,
            ),
            tendencia: calculateTrend(estornosEReembolsos, estornosEReembolsosAnterior),
          },
        },
        graficos: {
          evolucaoReceita,
          evolucaoTransacoes,
          distribuicaoPorStatus,
          distribuicaoPorTipo,
          distribuicaoPorGateway,
        },
        rankings,
        assinaturas,
        ultimasTransacoes: preview.items.map((item) => ({
          id: item.id,
          codigoExibicao: item.codigoExibicao,
          tipo: item.tipo,
          tipoLabel: item.tipoLabel,
          status: item.status,
          statusLabel: item.statusLabel,
          valor: item.valor,
          valorFormatado: item.valorFormatado,
          gateway: item.gateway,
          gatewayLabel: item.gatewayLabel,
          descricao: item.descricao,
          criadoEm: item.criadoEm,
        })),
        acoesRapidas: {
          detalhesTransacoesUrl: '/dashboard/auditoria/transacoes',
          detalhesAssinaturasUrl: '/dashboard/auditoria/assinaturas',
        },
      };
    } catch (error) {
      financeiroLogger.error({ err: error, filters }, 'Erro ao obter dashboard financeiro');
      throw Object.assign(new Error('Não foi possível carregar o dashboard financeiro.'), {
        code: 'DASHBOARD_FINANCEIRO_ERROR',
        statusCode: 500,
      });
    }
  }

  obterFiltrosDisponiveis() {
    return {
      periodos: [
        { value: '7d', label: '7 dias' },
        { value: '30d', label: '30 dias' },
        { value: '90d', label: '90 dias' },
        { value: '12m', label: '12 meses' },
        { value: 'month', label: 'Mês atual' },
        { value: 'custom', label: 'Personalizado' },
      ],
      agruparPor: [
        { value: 'day', label: 'Dia' },
        { value: 'week', label: 'Semana' },
        { value: 'month', label: 'Mês' },
      ],
    };
  }

  private async buildEnrichment(rows: FinanceiroTransacaoRow[]) {
    const cursoIds = new Set<string>();
    const planoIds = new Set<string>();

    for (const row of rows) {
      const meta = asJsonObject(row.metadata);
      const curso = getNestedObject(meta, 'curso');
      const plano = getNestedObject(meta, 'plano');
      const cursoId = getString(meta, 'cursoId') ?? getString(curso, 'id');
      const planoId =
        getString(meta, 'planoId', 'planosEmpresariaisId', 'empresasPlanoId') ??
        getString(plano, 'id');

      if (cursoId) {
        cursoIds.add(cursoId);
      }

      if (planoId) {
        planoIds.add(planoId);
      }
    }

    const [cursos, planos] = await Promise.all([
      cursoIds.size > 0
        ? prisma.cursos.findMany({
            where: { id: { in: [...cursoIds] } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),
      planoIds.size > 0
        ? prisma.planosEmpresariais.findMany({
            where: { id: { in: [...planoIds] } },
            select: { id: true, nome: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      cursos: new Map(cursos.map((curso) => [curso.id, curso.nome])),
      planos: new Map(planos.map((plano) => [plano.id, plano.nome])),
    };
  }

  private getCourseName(
    row: FinanceiroTransacaoRow,
    enrichment: Awaited<ReturnType<DashboardFinanceiroService['buildEnrichment']>>,
  ) {
    const meta = asJsonObject(row.metadata);
    const nested = getNestedObject(meta, 'curso');
    const directName = getString(meta, 'cursoNome') ?? getString(nested, 'nome');

    if (directName) {
      return directName;
    }

    const courseId = getString(meta, 'cursoId') ?? getString(nested, 'id');
    return courseId ? (enrichment.cursos.get(courseId) ?? null) : null;
  }

  private getPlanName(
    row: FinanceiroTransacaoRow,
    enrichment: Awaited<ReturnType<DashboardFinanceiroService['buildEnrichment']>>,
  ) {
    const meta = asJsonObject(row.metadata);
    const nested = getNestedObject(meta, 'plano');
    const directName = getString(meta, 'planoNome') ?? getString(nested, 'nome');

    if (directName) {
      return directName;
    }

    const planId =
      getString(meta, 'planoId', 'planosEmpresariaisId', 'empresasPlanoId') ??
      getString(nested, 'id');
    return planId ? (enrichment.planos.get(planId) ?? null) : null;
  }

  private buildRevenueSeries(rows: FinanceiroTransacaoRow[], grouping: 'day' | 'week' | 'month') {
    const buckets = new Map<string, { label: string; valor: number; quantidade: number }>();

    for (const row of rows) {
      const key = getBucketKey(row.criadoEm, grouping);
      const label = formatBucketLabel(row.criadoEm, grouping);
      const current = buckets.get(key) ?? { label, valor: 0, quantidade: 0 };
      current.valor = roundCurrency(current.valor + Number(row.valor));
      current.quantidade += 1;
      buckets.set(key, current);
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([, bucket]) => ({
        label: bucket.label,
        valor: bucket.valor,
        valorFormatado: formatCurrency(bucket.valor),
        quantidade: bucket.quantidade,
      }));
  }

  private buildTransactionSeries(
    rows: FinanceiroTransacaoRow[],
    grouping: 'day' | 'week' | 'month',
  ) {
    const buckets = new Map<
      string,
      {
        label: string;
        aprovadas: number;
        pendentes: number;
        recusadas: number;
      }
    >();

    for (const row of rows) {
      const key = getBucketKey(row.criadoEm, grouping);
      const label = formatBucketLabel(row.criadoEm, grouping);
      const current = buckets.get(key) ?? {
        label,
        aprovadas: 0,
        pendentes: 0,
        recusadas: 0,
      };

      if (row.status === TransacaoStatus.APROVADA) {
        current.aprovadas += 1;
      } else if (
        row.status === TransacaoStatus.PENDENTE ||
        row.status === TransacaoStatus.PROCESSANDO
      ) {
        current.pendentes += 1;
      } else if (row.status === TransacaoStatus.RECUSADA) {
        current.recusadas += 1;
      }

      buckets.set(key, current);
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
      .map(([, bucket]) => bucket);
  }

  private buildStatusDistribution(rows: FinanceiroTransacaoRow[]) {
    const counts = new Map<TransacaoStatus, number>();

    for (const row of rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }

    const total = rows.length || 1;
    return [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: statusLabels[value],
        count,
        percentual: Number(((count / total) * 100).toFixed(1)),
      }))
      .sort(
        (left, right) => right.count - left.count || left.label.localeCompare(right.label, 'pt-BR'),
      );
  }

  private buildTypeDistribution(rows: FinanceiroTransacaoRow[]) {
    const map = new Map<TransacaoTipo, { count: number; valor: number }>();

    for (const row of rows) {
      const current = map.get(row.tipo) ?? { count: 0, valor: 0 };
      current.count += 1;
      current.valor = roundCurrency(current.valor + Number(row.valor));
      map.set(row.tipo, current);
    }

    return [...map.entries()]
      .map(([value, aggregate]) => ({
        value,
        label: tipoLabels[value],
        count: aggregate.count,
        valor: aggregate.valor,
        valorFormatado: formatCurrency(aggregate.valor),
      }))
      .sort((left, right) => right.valor - left.valor || right.count - left.count);
  }

  private buildGatewayDistribution(rows: FinanceiroTransacaoRow[]) {
    const map = new Map<string, { count: number; valor: number }>();

    for (const row of rows) {
      const meta = asJsonObject(row.metadata);
      const gateway = normalizeGateway(row.gateway ?? getString(meta, 'gateway', 'gatewayName'));

      if (!gateway) {
        continue;
      }

      const current = map.get(gateway) ?? { count: 0, valor: 0 };
      current.count += 1;
      current.valor = roundCurrency(current.valor + Number(row.valor));
      map.set(gateway, current);
    }

    return toValueLabelPairs(new Map([...map.entries()].map(([key, value]) => [key, value.count])))
      .map(([value]) => ({
        value,
        label: getGatewayLabel(value) ?? value,
        count: map.get(value)?.count ?? 0,
        valor: map.get(value)?.valor ?? 0,
        valorFormatado: formatCurrency(map.get(value)?.valor ?? 0),
      }))
      .sort((left, right) => right.valor - left.valor || right.count - left.count);
  }

  private buildRankings(
    rows: FinanceiroTransacaoRow[],
    enrichment: Awaited<ReturnType<DashboardFinanceiroService['buildEnrichment']>>,
  ) {
    const courseMap = new Map<string, number>();
    const planMap = new Map<string, number>();
    const companyMap = new Map<string, number>();
    const studentMap = new Map<string, number>();

    for (const row of rows) {
      const valor = Number(row.valor);
      const courseName = this.getCourseName(row, enrichment);
      const planName = this.getPlanName(row, enrichment);
      const companyName =
        row.Usuarios_AuditoriaTransacoes_empresaIdToUsuarios?.nomeCompleto ?? null;
      const studentName =
        row.Usuarios_AuditoriaTransacoes_usuarioIdToUsuarios?.nomeCompleto ?? null;

      if (courseName) {
        courseMap.set(courseName, roundCurrency((courseMap.get(courseName) ?? 0) + valor));
      }

      if (planName) {
        planMap.set(planName, roundCurrency((planMap.get(planName) ?? 0) + valor));
      }

      if (companyName) {
        companyMap.set(companyName, roundCurrency((companyMap.get(companyName) ?? 0) + valor));
      }

      if (studentName) {
        studentMap.set(studentName, roundCurrency((studentMap.get(studentName) ?? 0) + valor));
      }
    }

    return {
      topCursos: this.toRanking(courseMap),
      topPlanos: this.toRanking(planMap),
      topEmpresas: this.toRanking(companyMap),
      topAlunos: this.toRanking(studentMap),
    };
  }

  private toRanking(map: Map<string, number>): RankingItem[] {
    return [...map.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .slice(0, 5)
      .map(([name, value], index) => ({
        position: index + 1,
        name,
        value,
        valorFormatado: formatCurrency(value),
      }));
  }

  private buildSubscriptionSummary(
    rows: SubscriptionPlanRow[],
    transacoesRows: FinanceiroTransacaoRow[],
    range: DateRange,
  ) {
    const ativas = rows.filter((row) => row.status === 'ATIVO').length;
    const novasNoPeriodo = rows.filter(
      (row) => row.criadoEm >= range.dataInicio && row.criadoEm <= range.dataFim,
    ).length;
    const canceladasNoPeriodo = rows.filter(
      (row) =>
        row.status === 'CANCELADO' &&
        row.atualizadoEm >= range.dataInicio &&
        row.atualizadoEm <= range.dataFim,
    ).length;
    const renovacoesNoPeriodo = rows.filter(
      (row) =>
        row.status === 'ATIVO' &&
        row.proximaCobranca &&
        row.proximaCobranca >= range.dataInicio &&
        row.proximaCobranca <= range.dataFim,
    ).length;
    const receitaAssinaturas = sumMonetaryValues(
      transacoesRows.filter(
        (row) => row.tipo === TransacaoTipo.ASSINATURA && row.status === TransacaoStatus.APROVADA,
      ),
    );
    const taxaRetencao =
      novasNoPeriodo === 0
        ? 0
        : Number((((novasNoPeriodo - canceladasNoPeriodo) / novasNoPeriodo) * 100).toFixed(2));

    return {
      ativas,
      novasNoPeriodo,
      canceladasNoPeriodo,
      renovacoesNoPeriodo,
      receitaAssinaturas,
      receitaAssinaturasFormatada: formatCurrency(receitaAssinaturas),
      taxaRetencao,
    };
  }
}

export const dashboardFinanceiroService = new DashboardFinanceiroService();

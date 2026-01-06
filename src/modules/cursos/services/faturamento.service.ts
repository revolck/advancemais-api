import { Prisma, TransacaoTipo, TransacaoStatus } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { FaturamentoQuery } from '../validators/faturamento.schema';

const faturamentoLogger = logger.child({ module: 'FaturamentoService' });

interface HistoricalDataPoint {
  date: string;
  faturamento: number;
  transacoes: number;
  transacoesAprovadas: number;
  cursos: number;
}

interface TopCursoFaturamento {
  cursoId: string;
  cursoNome: string;
  cursoCodigo: string;
  totalFaturamento: number;
  totalTransacoes: number;
  transacoesAprovadas: number;
  transacoesPendentes: number;
  ultimaTransacao: string | null;
}

interface FaturamentoResponse {
  period: string;
  startDate: string;
  endDate: string;
  faturamentoMesAtual: number;
  faturamentoMesAnterior: number;
  totalTransacoes: number;
  transacoesAprovadas: number;
  cursosAtivos: number;
  historicalData: HistoricalDataPoint[];
  topCursosFaturamento: TopCursoFaturamento[];
  cursoMaiorFaturamento: TopCursoFaturamento | null;
}

/**
 * Calcula as datas de início e fim baseado no período
 */
function calcularPeriodo(params: FaturamentoQuery): { startDate: Date; endDate: Date } {
  const agora = new Date();
  let startDate: Date;
  let endDate: Date = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);

  if (params.period === 'custom' && params.startDate && params.endDate) {
    startDate = new Date(params.startDate);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(params.endDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (params.period === 'day') {
    startDate = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
  } else if (params.period === 'week') {
    const diaSemana = agora.getDay();
    const diff = agora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); // Segunda-feira
    startDate = new Date(agora.getFullYear(), agora.getMonth(), diff, 0, 0, 0);
  } else if (params.period === 'month') {
    startDate = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
  } else if (params.period === 'year') {
    startDate = new Date(agora.getFullYear(), 0, 1, 0, 0, 0);
  } else {
    // Default: mês atual
    startDate = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0);
  }

  return { startDate, endDate };
}

/**
 * Calcula o intervalo de agregação para dados históricos
 */
function calcularIntervaloAgregacao(period: string): string {
  switch (period) {
    case 'day':
      return 'hour'; // Por hora
    case 'week':
    case 'month':
      return 'day'; // Por dia
    case 'year':
      return 'month'; // Por mês
    default:
      return 'day';
  }
}

/**
 * Formata data para string no formato YYYY-MM-DD
 */
function formatarData(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Busca faturamento com filtros de período
 */
export async function buscarFaturamentoComPeriodo(
  params: FaturamentoQuery,
): Promise<FaturamentoResponse> {
  try {
    faturamentoLogger.info({ params }, 'Buscando faturamento com período');

    const { startDate, endDate } = calcularPeriodo(params);
    const intervaloAgregacao = calcularIntervaloAgregacao(params.period);

    // Calcular mês atual e anterior para comparação
    const agora = new Date();
    const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
    const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
    const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);

    // Buscar todas as transações relacionadas a cursos no período
    const transacoes = await retryOperation(
      () =>
        prisma.$queryRaw<
          {
            id: string;
            valor: Prisma.Decimal;
            status: TransacaoStatus;
            metadata: Prisma.JsonValue;
            criadoEm: Date;
          }[]
        >`
        SELECT 
          t.id,
          t.valor,
          t.status,
          t.metadata,
          t."criadoEm"
        FROM "AuditoriaTransacoes" t
        WHERE 
          t.tipo IN ('PAGAMENTO', 'ASSINATURA')
          AND t."criadoEm" >= ${startDate}::timestamp
          AND t."criadoEm" <= ${endDate}::timestamp
          AND (
            t.referencia ILIKE '%curso%' 
            OR t.referencia ILIKE '%turma%'
            OR (t.metadata::text LIKE '%cursoId%')
            OR (t.metadata::text LIKE '%"curso"%')
          )
        ORDER BY t."criadoEm" ASC
      `,
      3,
      1000,
      20000,
    );

    // Processar transações
    let faturamentoMesAtual = 0;
    let faturamentoMesAnterior = 0;
    let totalTransacoes = 0;
    let transacoesAprovadas = 0;
    const faturamentoPorCurso = new Map<string, TopCursoFaturamento>();
    const faturamentoPorData = new Map<string, HistoricalDataPoint>();
    const cursosAtivosSet = new Set<string>();

    for (const transacao of transacoes) {
      const valor = Number(transacao.valor);
      totalTransacoes += 1;

      if (transacao.status === 'APROVADA') {
        transacoesAprovadas += 1;

        // Verificar se é do mês atual
        if (transacao.criadoEm >= inicioMesAtual && transacao.criadoEm <= fimMesAtual) {
          faturamentoMesAtual += valor;
        }

        // Verificar se é do mês anterior
        if (transacao.criadoEm >= inicioMesAnterior && transacao.criadoEm <= fimMesAnterior) {
          faturamentoMesAnterior += valor;
        }

        // Extrair cursoId do metadata
        const metadata = transacao.metadata as any;
        const cursoId = metadata?.cursoId || metadata?.curso?.id || null;

        if (cursoId && typeof cursoId === 'string') {
          cursosAtivosSet.add(cursoId);

          // Atualizar faturamento por curso
          const existente = faturamentoPorCurso.get(cursoId);
          if (existente) {
            existente.totalFaturamento += valor;
            existente.totalTransacoes += 1;
            existente.transacoesAprovadas += 1;
            const ultimaTransacaoDate = existente.ultimaTransacao
              ? new Date(existente.ultimaTransacao)
              : new Date(0);
            if (transacao.criadoEm > ultimaTransacaoDate) {
              existente.ultimaTransacao = transacao.criadoEm.toISOString();
            }
          } else {
            faturamentoPorCurso.set(cursoId, {
              cursoId,
              cursoNome: metadata?.curso?.nome || 'Curso não identificado',
              cursoCodigo: metadata?.curso?.codigo || '',
              totalFaturamento: valor,
              totalTransacoes: 1,
              transacoesAprovadas: 1,
              transacoesPendentes: 0,
              ultimaTransacao: transacao.criadoEm.toISOString(),
            });
          }

          // Agregar por data para histórico
          let dataKey: string;
          if (intervaloAgregacao === 'hour') {
            const date = new Date(transacao.criadoEm);
            dataKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00:00`;
          } else if (intervaloAgregacao === 'day') {
            dataKey = formatarData(transacao.criadoEm);
          } else if (intervaloAgregacao === 'month') {
            const date = new Date(transacao.criadoEm);
            dataKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
          } else {
            dataKey = formatarData(transacao.criadoEm);
          }

          const historicoExistente = faturamentoPorData.get(dataKey);
          if (historicoExistente) {
            historicoExistente.faturamento += valor;
            historicoExistente.transacoes += 1;
            historicoExistente.transacoesAprovadas += 1;
          } else {
            faturamentoPorData.set(dataKey, {
              date: dataKey,
              faturamento: valor,
              transacoes: 1,
              transacoesAprovadas: 1,
              cursos: 0, // Será calculado depois
            });
          }
        }
      } else if (transacao.status === 'PENDENTE') {
        const metadata = transacao.metadata as any;
        const cursoId = metadata?.cursoId || metadata?.curso?.id || null;
        if (cursoId && typeof cursoId === 'string' && faturamentoPorCurso.has(cursoId)) {
          const existente = faturamentoPorCurso.get(cursoId);
          if (existente) {
            existente.transacoesPendentes += 1;
            existente.totalTransacoes += 1;
          }
        }
      }
    }

    // Buscar informações dos cursos
    const cursoIds = Array.from(faturamentoPorCurso.keys());
    if (cursoIds.length > 0) {
      const cursos = await prisma.cursos.findMany({
        where: { id: { in: cursoIds } },
        select: {
          id: true,
          nome: true,
          codigo: true,
        },
      });

      for (const curso of cursos) {
        const faturamento = faturamentoPorCurso.get(curso.id);
        if (faturamento) {
          faturamento.cursoNome = curso.nome;
          faturamento.cursoCodigo = curso.codigo;
        }
      }
    }

    // Contar cursos ativos (cursos com pelo menos uma transação aprovada)
    const cursosAtivos = cursosAtivosSet.size;

    // Atualizar contagem de cursos por data no histórico
    for (const [dataKey, historico] of faturamentoPorData.entries()) {
      // Buscar quantos cursos únicos tiveram transações nesta data
      const cursosNaData = new Set<string>();
      for (const transacao of transacoes) {
        if (transacao.status === 'APROVADA') {
          let transacaoDataKey: string;
          if (intervaloAgregacao === 'hour') {
            const date = new Date(transacao.criadoEm);
            transacaoDataKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00:00`;
          } else if (intervaloAgregacao === 'day') {
            transacaoDataKey = formatarData(transacao.criadoEm);
          } else if (intervaloAgregacao === 'month') {
            const date = new Date(transacao.criadoEm);
            transacaoDataKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
          } else {
            transacaoDataKey = formatarData(transacao.criadoEm);
          }

          if (transacaoDataKey === dataKey) {
            const metadata = transacao.metadata as any;
            const cursoId = metadata?.cursoId || metadata?.curso?.id || null;
            if (cursoId && typeof cursoId === 'string') {
              cursosNaData.add(cursoId);
            }
          }
        }
      }
      historico.cursos = cursosNaData.size;
    }

    // Ordenar histórico por data
    const historicalData = Array.from(faturamentoPorData.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Ordenar cursos por faturamento e pegar top N
    const topCursos = Array.from(faturamentoPorCurso.values())
      .sort((a, b) => b.totalFaturamento - a.totalFaturamento)
      .slice(0, params.top);

    const cursoMaiorFaturamento = topCursos.length > 0 ? topCursos[0] : null;

    return {
      period: params.period,
      startDate: formatarData(startDate),
      endDate: formatarData(endDate),
      faturamentoMesAtual,
      faturamentoMesAnterior,
      totalTransacoes,
      transacoesAprovadas,
      cursosAtivos,
      historicalData,
      topCursosFaturamento: topCursos,
      cursoMaiorFaturamento,
    };
  } catch (error) {
    faturamentoLogger.error({ err: error, params }, 'Erro ao buscar faturamento com período');
    throw error;
  }
}

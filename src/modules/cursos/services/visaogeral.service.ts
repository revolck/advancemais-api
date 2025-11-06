/**
 * Service para visão geral e métricas de cursos
 * Acesso restrito a ADMIN e MODERADOR
 */

import { Prisma, CursoStatus, TransacaoTipo, TransacaoStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const visaogeralLogger = logger.child({ module: 'CursosVisaoGeralService' });

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
    cursosMaisPopulares: Array<{
      cursoId: string;
      cursoNome: string;
      cursoCodigo: string;
      totalInscricoes: number;
      totalTurmas: number;
    }>;
    taxaConclusao: number;
    cursosComMaiorTaxaConclusao: Array<{
      cursoId: string;
      cursoNome: string;
      cursoCodigo: string;
      taxaConclusao: number;
      totalInscricoes: number;
      totalConcluidos: number;
    }>;
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
 */
async function buscarMetricasGerais() {
  const [
    totalCursos,
    cursosPublicados,
    cursosRascunho,
    totalTurmas,
    turmasAtivas,
    turmasInscricoesAbertas,
    totalAlunosInscritos,
    totalAlunosAtivos,
    totalAlunosConcluidos,
  ] = await Promise.all([
    // Total de cursos
    prisma.cursos.count(),
    // Cursos publicados
    prisma.cursos.count({ where: { statusPadrao: 'PUBLICADO' } }),
    // Cursos em rascunho
    prisma.cursos.count({ where: { statusPadrao: 'RASCUNHO' } }),
    // Total de turmas
    prisma.cursosTurmas.count(),
    // Turmas ativas (EM_ANDAMENTO)
    prisma.cursosTurmas.count({ where: { status: 'EM_ANDAMENTO' } }),
    // Turmas com inscrições abertas
    prisma.cursosTurmas.count({ where: { status: 'INSCRICOES_ABERTAS' } }),
    // Total de alunos inscritos
    prisma.cursosTurmasInscricoes.count(),
    // Alunos ativos (INSCRITO ou EM_ANDAMENTO)
    prisma.cursosTurmasInscricoes.count({
      where: { status: { in: ['INSCRITO', 'EM_ANDAMENTO'] } },
    }),
    // Alunos concluídos
    prisma.cursosTurmasInscricoes.count({ where: { status: 'CONCLUIDO' } }),
  ]);

  return {
    totalCursos,
    cursosPublicados,
    cursosRascunho,
    totalTurmas,
    turmasAtivas,
    turmasInscricoesAbertas,
    totalAlunosInscritos,
    totalAlunosAtivos,
    totalAlunosConcluidos,
  };
}

/**
 * Busca cursos próximos a começar
 */
async function buscarCursosProximosInicio(): Promise<{
  proximos7Dias: CursosProximosInicio[];
  proximos15Dias: CursosProximosInicio[];
  proximos30Dias: CursosProximosInicio[];
}> {
  const agora = new Date();
  const data7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const data15Dias = new Date(agora.getTime() + 15 * 24 * 60 * 60 * 1000);
  const data30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Buscar turmas que começam nos próximos 30 dias
  const turmas = await prisma.cursosTurmas.findMany({
    where: {
      dataInicio: {
        gte: agora,
        lte: data30Dias,
      },
      status: {
        in: ['INSCRICOES_ABERTAS', 'INSCRICOES_ENCERRADAS', 'PUBLICADO'],
      },
    },
    include: {
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
  });

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

  const proximos7Dias = turmasFormatadas.filter((t) => t.diasParaInicio !== null && t.diasParaInicio <= 7);
  const proximos15Dias = turmasFormatadas.filter((t) => t.diasParaInicio !== null && t.diasParaInicio <= 15);
  const proximos30Dias = turmasFormatadas;

  return {
    proximos7Dias,
    proximos15Dias,
    proximos30Dias,
  };
}

/**
 * Busca faturamento relacionado a cursos
 */
async function buscarFaturamentoCursos(): Promise<{
  totalFaturamento: number;
  faturamentoMesAtual: number;
  faturamentoMesAnterior: number;
  cursoMaiorFaturamento: CursoFaturamento | null;
  topCursosFaturamento: CursoFaturamento[];
}> {
  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59);

  // Buscar transações relacionadas a cursos
  // As transações de cursos podem ser do tipo PAGAMENTO com metadata indicando cursoId
  // Buscar todas as transações de PAGAMENTO e ASSINATURA e filtrar depois
  const transacoes = await prisma.auditoriaTransacoes.findMany({
    where: {
      tipo: { in: ['PAGAMENTO', 'ASSINATURA'] as TransacaoTipo[] },
      OR: [
        { referencia: { contains: 'curso', mode: 'insensitive' } },
        { referencia: { contains: 'turma', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      valor: true,
      status: true,
      metadata: true,
      referencia: true,
      criadoEm: true,
    },
  });

  // Filtrar transações que têm cursoId no metadata (JSON)
  const transacoesComCurso = transacoes.filter((t) => {
    if (!t.metadata) return false;
    const metadata = t.metadata as any;
    return metadata?.cursoId || metadata?.curso?.id || metadata?.turmaId || metadata?.turma?.cursoId;
  });

  // Mapear faturamento por curso
  const faturamentoPorCurso = new Map<string, CursoFaturamento>();
  let totalFaturamento = 0;
  let faturamentoMesAtual = 0;
  let faturamentoMesAnterior = 0;

  // Filtrar apenas transações aprovadas/concluídas para faturamento
  const transacoesAprovadas = transacoesComCurso.filter(
    (t) => t.status === 'APROVADA' || t.status === 'CONCLUIDA',
  );

  for (const transacao of transacoesAprovadas) {
    const valor = Number(transacao.valor);
    totalFaturamento += valor;

    // Verificar se é do mês atual
    if (transacao.criadoEm >= inicioMesAtual && transacao.criadoEm <= fimMesAtual) {
      faturamentoMesAtual += valor;
    }

    // Verificar se é do mês anterior
    if (transacao.criadoEm >= inicioMesAnterior && transacao.criadoEm <= fimMesAnterior) {
      faturamentoMesAnterior += valor;
    }

    // Extrair cursoId do metadata ou referencia
    const metadata = transacao.metadata as any;
    const cursoId = metadata?.cursoId || metadata?.curso?.id || null;

    if (cursoId && typeof cursoId === 'string') {
      const existente = faturamentoPorCurso.get(cursoId);
      if (existente) {
        existente.totalFaturamento += valor;
        existente.totalTransacoes += 1;
        if (transacao.criadoEm > (existente.ultimaTransacao || new Date(0))) {
          existente.ultimaTransacao = transacao.criadoEm;
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
          ultimaTransacao: transacao.criadoEm,
        });
      }
    }
  }

  // Buscar informações dos cursos para completar os dados
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

  // Atualizar contagem de transações aprovadas e pendentes por curso
  for (const transacao of transacoesComCurso) {
    const metadata = transacao.metadata as any;
    const cursoId = metadata?.cursoId || metadata?.curso?.id || null;

    if (cursoId && typeof cursoId === 'string') {
      const faturamento = faturamentoPorCurso.get(cursoId);
      if (faturamento) {
        if (transacao.status === 'APROVADA' || transacao.status === 'CONCLUIDA') {
          faturamento.transacoesAprovadas += 1;
        } else if (transacao.status === 'PENDENTE') {
          faturamento.transacoesPendentes += 1;
        }
      }
    }
  }

  // Ordenar por faturamento e pegar top 10
  const topCursos = Array.from(faturamentoPorCurso.values())
    .sort((a, b) => b.totalFaturamento - a.totalFaturamento)
    .slice(0, 10);

  const cursoMaiorFaturamento = topCursos.length > 0 ? topCursos[0] : null;

  return {
    totalFaturamento,
    faturamentoMesAtual,
    faturamentoMesAnterior,
    cursoMaiorFaturamento,
    topCursosFaturamento: topCursos,
  };
}

/**
 * Busca métricas de performance
 */
async function buscarPerformanceCursos(): Promise<{
  cursosMaisPopulares: Array<{
    cursoId: string;
    cursoNome: string;
    cursoCodigo: string;
    totalInscricoes: number;
    totalTurmas: number;
  }>;
  taxaConclusao: number;
  cursosComMaiorTaxaConclusao: Array<{
    cursoId: string;
    cursoNome: string;
    cursoCodigo: string;
    taxaConclusao: number;
    totalInscricoes: number;
    totalConcluidos: number;
  }>;
}> {
  // Buscar cursos com mais inscrições
  const cursosComInscricoes = await prisma.cursos.findMany({
    include: {
      CursosTurmas: {
        include: {
          _count: {
            select: {
              CursosTurmasInscricoes: true,
            },
          },
        },
      },
      _count: {
        select: {
          CursosTurmas: true,
        },
      },
    },
  });

  const cursosPopulares = cursosComInscricoes
    .map((curso) => {
      const totalInscricoes = curso.CursosTurmas.reduce(
        (sum, turma) => sum + turma._count.CursosTurmasInscricoes,
        0,
      );
      return {
        cursoId: curso.id,
        cursoNome: curso.nome,
        cursoCodigo: curso.codigo,
        totalInscricoes,
        totalTurmas: curso._count.CursosTurmas,
      };
    })
    .sort((a, b) => b.totalInscricoes - a.totalInscricoes)
    .slice(0, 10);

  // Calcular taxa de conclusão geral
  const [totalInscricoes, totalConcluidos] = await Promise.all([
    prisma.cursosTurmasInscricoes.count(),
    prisma.cursosTurmasInscricoes.count({ where: { status: 'CONCLUIDO' } }),
  ]);

  const taxaConclusao = totalInscricoes > 0 ? (totalConcluidos / totalInscricoes) * 100 : 0;

  // Cursos com maior taxa de conclusão
  const cursosComTaxaConclusao = await Promise.all(
    cursosComInscricoes.map(async (curso) => {
      const [totalInscricoesCurso, totalConcluidosCurso] = await Promise.all([
        prisma.cursosTurmasInscricoes.count({
          where: {
            CursosTurmas: {
              cursoId: curso.id,
            },
          },
        }),
        prisma.cursosTurmasInscricoes.count({
          where: {
            CursosTurmas: {
              cursoId: curso.id,
            },
            status: 'CONCLUIDO',
          },
        }),
      ]);

      const taxaConclusaoCurso =
        totalInscricoesCurso > 0 ? (totalConcluidosCurso / totalInscricoesCurso) * 100 : 0;

      return {
        cursoId: curso.id,
        cursoNome: curso.nome,
        cursoCodigo: curso.codigo,
        taxaConclusao: taxaConclusaoCurso,
        totalInscricoes: totalInscricoesCurso,
        totalConcluidos: totalConcluidosCurso,
      };
    }),
  );

  const cursosComMaiorTaxa = cursosComTaxaConclusao
    .filter((c) => c.totalInscricoes > 0)
    .sort((a, b) => b.taxaConclusao - a.taxaConclusao)
    .slice(0, 10);

  return {
    cursosMaisPopulares: cursosPopulares,
    taxaConclusao: Math.round(taxaConclusao * 100) / 100,
    cursosComMaiorTaxaConclusao: cursosComMaiorTaxa,
  };
}

/**
 * Busca visão geral completa de cursos
 */
export async function buscarVisaoGeralCursos(): Promise<VisaoGeralCursos> {
  try {
    visaogeralLogger.info('Buscando visão geral de cursos');

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


import { StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const vagasLogger = logger.child({ module: 'CursosInscricoesVagasService' });

const STATUS_INSCRICAO_OCUPA_VAGA: StatusInscricao[] = [
  StatusInscricao.INSCRITO,
  StatusInscricao.EM_ANDAMENTO,
  StatusInscricao.EM_ESTAGIO,
  StatusInscricao.CONCLUIDO,
];

const STATUS_PAGAMENTO_RESERVA = ['PENDENTE', 'PROCESSANDO'];

export function buildInscricaoOcupaVagaWhere(now = new Date()) {
  return {
    OR: [
      { status: { in: STATUS_INSCRICAO_OCUPA_VAGA } },
      {
        status: StatusInscricao.AGUARDANDO_PAGAMENTO,
        statusPagamento: { in: STATUS_PAGAMENTO_RESERVA },
        pagamentoExpiraEm: { gt: now },
      },
    ],
  };
}

export async function limparReservasExpiradasDaTurma(turmaId: string, now = new Date()) {
  const result = await prisma.cursosTurmasInscricoes.updateMany({
    where: {
      turmaId,
      status: StatusInscricao.AGUARDANDO_PAGAMENTO,
      statusPagamento: { in: STATUS_PAGAMENTO_RESERVA },
      OR: [{ pagamentoExpiraEm: null }, { pagamentoExpiraEm: { lte: now } }],
    },
    data: {
      status: StatusInscricao.CANCELADO,
      statusPagamento: 'CANCELADO',
      tokenAcesso: null,
      tokenAcessoExpiraEm: null,
    },
  });

  if (result.count > 0) {
    vagasLogger.info(
      { turmaId, reservasCanceladas: result.count },
      '[CURSOS_VAGAS] Reservas expiradas liberadas',
    );
  }

  return result.count;
}

export async function countInscricoesQueOcupamVagaPorTurma(
  turmaIds: string[],
  now = new Date(),
): Promise<Record<string, number>> {
  if (turmaIds.length === 0) return {};

  const result = await prisma.cursosTurmasInscricoes.groupBy({
    by: ['turmaId'],
    where: {
      turmaId: { in: turmaIds },
      ...buildInscricaoOcupaVagaWhere(now),
    },
    _count: { _all: true },
  });

  const countMap: Record<string, number> = {};
  for (const row of result) {
    countMap[row.turmaId] = row._count._all;
  }

  for (const turmaId of turmaIds) {
    if (!(turmaId in countMap)) countMap[turmaId] = 0;
  }

  return countMap;
}

export async function calcularDisponibilidadeTurma(
  turmaId: string,
  options?: { limparExpiradas?: boolean },
) {
  const now = new Date();
  if (options?.limparExpiradas) {
    await limparReservasExpiradasDaTurma(turmaId, now);
  }

  const turma = await prisma.cursosTurmas.findUnique({
    where: { id: turmaId },
    select: {
      id: true,
      nome: true,
      cursoId: true,
      vagasTotais: true,
      vagasIlimitadas: true,
    },
  });

  if (!turma) return null;

  const countMap = await countInscricoesQueOcupamVagaPorTurma([turmaId], now);
  const inscritosAtual = countMap[turmaId] ?? 0;
  const ilimitado = turma.vagasIlimitadas || !turma.vagasTotais || turma.vagasTotais === 0;
  const vagasTotais = ilimitado ? null : turma.vagasTotais;
  const vagasDisponiveis = ilimitado ? null : Math.max(0, (vagasTotais as number) - inscritosAtual);
  const temVaga = ilimitado || (vagasDisponiveis ?? 0) > 0;

  return {
    turma,
    inscritosAtual,
    ilimitado,
    vagasTotais,
    vagasDisponiveis,
    temVaga,
  };
}

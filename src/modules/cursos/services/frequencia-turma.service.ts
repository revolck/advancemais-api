import { prisma } from '@/config/prisma';
import { CursosAulaStatus, CursosFrequenciaStatus } from '@prisma/client';

/**
 * Métrica de frequência específica para o alerta de qualidade da turma.
 * Não substitui os cálculos de progresso já usados em outras telas
 * (admin-service.ts/cursos.controller.ts) — é uma métrica nova e paralela.
 */

const STATUS_ELEGIVEIS: CursosAulaStatus[] = [
  CursosAulaStatus.PUBLICADA,
  CursosAulaStatus.EM_ANDAMENTO,
  CursosAulaStatus.CONCLUIDA,
];

const PRESENCA_VALIDA: CursosFrequenciaStatus[] = [
  CursosFrequenciaStatus.PRESENTE,
  CursosFrequenciaStatus.ATRASADO,
];

type ItemElegivel = { id: string; dataInicio: Date | null; dataFim: Date | null };
type AulaElegivel = ItemElegivel & { modalidade: string };

function itemJaOcorreu(item: ItemElegivel, agora: Date): boolean {
  const referencia = item.dataFim ?? item.dataInicio;
  return Boolean(referencia && referencia.getTime() <= agora.getTime());
}

export const frequenciaTurmaService = {
  /**
   * Itens elegíveis da turma (aulas + provas/atividades visíveis ao aluno) e quantos
   * deles já "ocorreram" (data já passou) — usado tanto para o checkpoint da turma
   * quanto como denominador da frequência de cada aluno.
   */
  async contarItensDaTurma(turmaId: string, agora: Date = new Date()) {
    const [aulas, provas] = await Promise.all([
      prisma.cursosTurmasAulas.findMany({
        where: { turmaId, deletedAt: null, status: { in: STATUS_ELEGIVEIS } },
        select: { id: true, modalidade: true, dataInicio: true, dataFim: true },
      }),
      prisma.cursosTurmasProvas.findMany({
        where: { turmaId, ativo: true, status: { in: STATUS_ELEGIVEIS } },
        select: { id: true, dataInicio: true, dataFim: true },
      }),
    ]);

    const itensOcorridos =
      aulas.filter((a) => itemJaOcorreu(a, agora)).length +
      provas.filter((p) => itemJaOcorreu(p, agora)).length;

    return {
      total: aulas.length + provas.length,
      itensOcorridos,
      aulas: aulas as AulaElegivel[],
      provaIds: provas.map((p) => p.id),
    };
  },

  /** Checkpoint atual da turma: 0, 20, 40, 60, 80 ou 100. */
  calcularCheckpoint(itensOcorridos: number, total: number): number {
    if (total <= 0 || itensOcorridos <= 0) return 0;
    const fracao = Math.min(itensOcorridos / total, 1);
    return Math.min(Math.floor(fracao * 5) * 20, 100);
  },

  /**
   * Frequência do aluno (0-100), usando o mesmo denominador (`total`) do checkpoint
   * da turma — cresce ao longo do curso conforme o aluno conclui itens.
   */
  async calcularFrequenciaAluno(params: {
    turmaId: string;
    inscricaoId: string;
    total: number;
    aulas: AulaElegivel[];
    provaIds: string[];
  }): Promise<number> {
    if (params.total <= 0) return 0;

    const aulaIdsOnline = params.aulas.filter((a) => a.modalidade === 'ONLINE').map((a) => a.id);
    const aulaIdsPresenca = params.aulas.filter((a) => a.modalidade !== 'ONLINE').map((a) => a.id);

    const [aulasOnlineConcluidas, presencasDistintas, enviosProvas] = await Promise.all([
      aulaIdsOnline.length
        ? prisma.cursosAulasProgresso.count({
            where: {
              inscricaoId: params.inscricaoId,
              aulaId: { in: aulaIdsOnline },
              concluida: true,
            },
          })
        : Promise.resolve(0),
      aulaIdsPresenca.length
        ? prisma.cursosFrequenciaAlunos
            .findMany({
              where: {
                inscricaoId: params.inscricaoId,
                aulaId: { in: aulaIdsPresenca },
                status: { in: PRESENCA_VALIDA },
              },
              select: { aulaId: true },
              distinct: ['aulaId'],
            })
            .then((rows) => rows.length)
        : Promise.resolve(0),
      params.provaIds.length
        ? prisma.cursosTurmasProvasEnvios.count({
            where: { inscricaoId: params.inscricaoId, provaId: { in: params.provaIds } },
          })
        : Promise.resolve(0),
    ]);

    const completos = aulasOnlineConcluidas + presencasDistintas + enviosProvas;
    return Math.min((completos / params.total) * 100, 100);
  },
};

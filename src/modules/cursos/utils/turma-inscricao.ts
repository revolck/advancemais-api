import { CursoStatus, StatusInscricao } from '@prisma/client';

/** Turma concluída ou cancelada não recebe inscrição nova, por nenhum caminho */
export const TURMAS_FECHADAS_PARA_INSCRICAO: CursoStatus[] = [
  CursoStatus.CONCLUIDO,
  CursoStatus.CANCELADO,
];

export const turmaAceitaNovasInscricoes = (status: CursoStatus) =>
  !TURMAS_FECHADAS_PARA_INSCRICAO.includes(status);

export const erroTurmaEncerrada = () =>
  Object.assign(new Error('Esta turma já foi concluída e não recebe novas inscrições.'), {
    code: 'TURMA_ENCERRADA',
    statusCode: 409,
  });

/**
 * Mudança automática de status (pelas datas): depois que a turma começou, só anda para
 * frente. Em andamento só vira concluída, nunca volta a "inscrições abertas".
 */
export const transicaoAutomaticaPermitida = (atual: CursoStatus, proximo: CursoStatus) =>
  atual !== CursoStatus.EM_ANDAMENTO || proximo === CursoStatus.CONCLUIDO;

export type DecisaoRecompra =
  | { permitir: true }
  | { permitir: false; code: string; message: string };

/**
 * Compra de uma turma em que o aluno já tem inscrição: só reaproveita a inscrição se ela
 * foi cancelada sem histórico (ex.: pagamento cancelado). Concluída, reprovada, trancada
 * ou cancelada com histórico não são sobrescritas.
 */
export function decidirRecompra(status: StatusInscricao, temHistorico: boolean): DecisaoRecompra {
  switch (status) {
    case StatusInscricao.CANCELADO:
      return temHistorico
        ? {
            permitir: false,
            code: 'INSCRICAO_ENCERRADA',
            message:
              'Sua inscrição nesta turma foi encerrada. Fale com a equipe da Advance+ para voltar.',
          }
        : { permitir: true };
    case StatusInscricao.CONCLUIDO:
      return {
        permitir: false,
        code: 'INSCRICAO_JA_CONCLUIDA',
        message: 'Você já concluiu esta turma.',
      };
    case StatusInscricao.REPROVADO:
    case StatusInscricao.TRANCADO:
      return {
        permitir: false,
        code: 'INSCRICAO_ENCERRADA',
        message:
          'Sua inscrição nesta turma foi encerrada. Fale com a equipe da Advance+ para voltar.',
      };
    default:
      return {
        permitir: false,
        code: 'INSCRICAO_DUPLICADA_TURMA',
        message: 'Você já possui inscrição ativa nesta turma',
      };
  }
}

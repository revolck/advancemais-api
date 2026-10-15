import { StatusInscricao } from '@prisma/client';

/**
 * Matrícula que ainda dá acesso à turma: não removida pela equipe, nem cancelada
 * ("não concluiu" ou removida), nem trancada. Reprovado continua com acesso (prova de
 * recuperação depende disso).
 */
export const STATUS_INSCRICAO_SEM_ACESSO: StatusInscricao[] = [
  StatusInscricao.CANCELADO,
  StatusInscricao.TRANCADO,
];

export const filtroInscricaoAtiva = () => ({
  removidaEm: null,
  status: { notIn: STATUS_INSCRICAO_SEM_ACESSO },
});

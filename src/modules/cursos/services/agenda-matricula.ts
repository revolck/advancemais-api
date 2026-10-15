import { logger } from '@/utils/logger';

const log = logger.child({ module: 'AgendaDaMatricula' });

/**
 * Google Agenda, em segundo plano: quem entra recebe os eventos na própria agenda e o
 * convite das salas do Meet; quem sai perde os dois.
 */
export function atualizarAgenda(alunoIds: string[], turmaId: string, movimento: 'entrou' | 'saiu') {
  if (alunoIds.length === 0) return;
  setImmediate(async () => {
    try {
      const {
        googleCalendarService,
      } = require('@/modules/cursos/aulas/services/google-calendar.service');
      for (const alunoId of alunoIds) {
        try {
          if (movimento === 'entrou') {
            await googleCalendarService.sincronizarAgendaAluno({ alunoId, turmaId });
            await googleCalendarService.ajustarConviteDoAluno({
              alunoId,
              turmaId,
              acao: 'adicionar',
            });
          } else {
            await googleCalendarService.removerAlunoDaAgendaDaTurma({ alunoId, turmaId });
          }
        } catch (error: any) {
          log.error(
            { err: error, alunoId, turmaId, movimento },
            'Falha ao atualizar a agenda do aluno',
          );
        }
      }
    } catch (error: any) {
      log.error({ err: error, turmaId, movimento }, 'Falha ao atualizar a agenda da turma');
    }
  });
}

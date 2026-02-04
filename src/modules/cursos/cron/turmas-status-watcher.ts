import cron from 'node-cron';

import { CursoStatus, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const watcherLogger = logger.child({ module: 'CursosTurmasStatusWatcher' });

const DEFAULT_SCHEDULE = process.env.TURMAS_STATUS_WATCHER_CRON || '*/15 * * * *';

type TurmaDates = {
  status: CursoStatus;
  dataInscricaoInicio: Date | null;
  dataInscricaoFim: Date | null;
  dataInicio: Date | null;
  dataFim: Date | null;
};

/**
 * Regras (datas são tratadas como "viradas" de status, no início do dia):
 * - status do usuário: RASCUNHO ou PUBLICADO
 * - demais status são automáticos e seguem intervalos [inicio, fim):
 *   - PUBLICADO: agora < dataInscricaoInicio
 *   - INSCRICOES_ABERTAS: dataInscricaoInicio <= agora < dataInscricaoFim
 *   - INSCRICOES_ENCERRADAS: dataInscricaoFim <= agora < dataInicio
 *   - EM_ANDAMENTO: dataInicio <= agora < dataFim
 *   - CONCLUIDO: agora >= dataFim
 */
const computeStatusFromDates = (turma: TurmaDates, agora: Date): CursoStatus | null => {
  if (turma.status === CursoStatus.RASCUNHO) {
    return null;
  }

  const { dataInscricaoInicio, dataInscricaoFim, dataInicio, dataFim } = turma;
  if (!dataInscricaoInicio || !dataInscricaoFim || !dataInicio || !dataFim) {
    return null;
  }

  const now = agora.getTime();

  if (now < dataInscricaoInicio.getTime()) return CursoStatus.PUBLICADO;
  if (now < dataInscricaoFim.getTime()) return CursoStatus.INSCRICOES_ABERTAS;
  if (now < dataInicio.getTime()) return CursoStatus.INSCRICOES_ENCERRADAS;
  if (now < dataFim.getTime()) return CursoStatus.EM_ANDAMENTO;
  return CursoStatus.CONCLUIDO;
};

export const startTurmasStatusWatcherJob = () => {
  if (process.env.NODE_ENV === 'test') {
    watcherLogger.debug('Test environment detectado, pulando watcher de status de turmas');
    return null;
  }

  const schedule = DEFAULT_SCHEDULE;

  const task = cron.schedule(
    schedule,
    async () => {
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        watcherLogger.debug('Banco de dados não disponível, pulando watcher de status de turmas');
        return;
      }

      const agora = new Date();

      try {
        const turmas = await prisma.cursosTurmas.findMany({
          where: {
            status: {
              in: [
                CursoStatus.PUBLICADO,
                CursoStatus.INSCRICOES_ABERTAS,
                CursoStatus.INSCRICOES_ENCERRADAS,
                CursoStatus.EM_ANDAMENTO,
              ],
            },
          },
          select: {
            id: true,
            status: true,
            dataInscricaoInicio: true,
            dataInscricaoFim: true,
            dataInicio: true,
            dataFim: true,
          },
          take: 2000,
        });

        if (turmas.length === 0) {
          watcherLogger.debug('[CRON] Nenhuma turma candidata a atualização de status');
          return;
        }

        const updatesByStatus = new Map<CursoStatus, string[]>();

        for (const turma of turmas) {
          const desired = computeStatusFromDates(turma as TurmaDates, agora);
          if (!desired || desired === turma.status) continue;

          const list = updatesByStatus.get(desired) ?? [];
          list.push(turma.id);
          updatesByStatus.set(desired, list);
        }

        if (updatesByStatus.size === 0) {
          watcherLogger.debug('[CRON] Status das turmas já está atualizado');
          return;
        }

        let totalUpdated = 0;

        // Atualizar em batches por status para reduzir roundtrips
        for (const [newStatus, turmaIds] of updatesByStatus.entries()) {
          if (turmaIds.length === 0) continue;

          const where: Prisma.CursosTurmasWhereInput = {
            id: { in: turmaIds },
            status: { not: CursoStatus.RASCUNHO },
          };

          const result = await prisma.cursosTurmas.updateMany({
            where,
            data: {
              status: newStatus,
              atualizadoEm: agora,
            },
          });

          totalUpdated += result.count;
        }

        watcherLogger.info(
          { totalCandidatas: turmas.length, totalUpdated, schedule },
          '[CRON] Atualização automática de status de turmas concluída',
        );
      } catch (error) {
        if (handlePrismaConnectionError(error, watcherLogger, 'turmas-status-watcher')) {
          return;
        }

        watcherLogger.error(
          { err: error },
          '[CRON] Falha ao atualizar status automático de turmas',
        );
      }
    },
    { scheduled: false },
  );

  task.start();
  watcherLogger.info({ schedule }, 'Watcher de status de turmas iniciado');
  return task;
};

import cron from 'node-cron';

import { estagiosService } from '../services/estagios.service';
import { logger } from '@/utils/logger';

const watcherLogger = logger.child({ module: 'CursosEstagiosWatcher' });

const DEFAULT_SCHEDULE = process.env.ESTAGIOS_WATCHER_CRON || '0 * * * *';
const DEFAULT_ANTECEDENCIA = Number(process.env.ESTAGIOS_AVISO_HORAS || 72);

export const startEstagiosWatcherJob = () => {
  const schedule = DEFAULT_SCHEDULE;
  const antecedenciaHoras = Number.isFinite(DEFAULT_ANTECEDENCIA) ? DEFAULT_ANTECEDENCIA : 72;

  const task = cron.schedule(
    schedule,
    async () => {
      try {
        const estagios = await estagiosService.localizarEncerramentosProximos(antecedenciaHoras);

        for (const estagio of estagios) {
          if (!estagio.criadoPor?.email) {
            watcherLogger.debug(
              { estagioId: estagio.id },
              'Estágio sem responsável definido para aviso de encerramento',
            );
            continue;
          }

          await estagiosService.registrarAvisoEncerramento(estagio.id, {
            email: estagio.criadoPor.email,
            nome: estagio.criadoPor.nomeCompleto,
          });

          watcherLogger.info(
            {
              estagioId: estagio.id,
              destinatario: estagio.criadoPor.email,
              diasRestantes: estagio.diasRestantes,
            },
            'Aviso de encerramento de estágio enviado',
          );
        }
      } catch (error) {
        watcherLogger.error({ err: error }, 'Falha ao processar avisos de encerramento de estágios');
      }
    },
    { scheduled: false },
  );

  task.start();
  watcherLogger.info({ schedule, antecedenciaHoras }, 'Watcher de estágios iniciado');
  return task;
};

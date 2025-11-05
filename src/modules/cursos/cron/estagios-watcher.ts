import cron from 'node-cron';

import { estagiosService } from '../services/estagios.service';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const watcherLogger = logger.child({ module: 'CursosEstagiosWatcher' });

const DEFAULT_SCHEDULE = process.env.ESTAGIOS_WATCHER_CRON || '0 * * * *';
const DEFAULT_ANTECEDENCIA = Number(process.env.ESTAGIOS_AVISO_HORAS || 72);

export const startEstagiosWatcherJob = () => {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    watcherLogger.debug('Test environment detectado, pulando watcher de estágios');
    return null;
  }

  const schedule = DEFAULT_SCHEDULE;
  const antecedenciaHoras = Number.isFinite(DEFAULT_ANTECEDENCIA) ? DEFAULT_ANTECEDENCIA : 72;

  const task = cron.schedule(
    schedule,
    async () => {
      // Verificar conexão ANTES de tentar executar qualquer query
      const isConnected = await checkDatabaseConnection();
      if (!isConnected) {
        watcherLogger.debug('Banco de dados não disponível, pulando watcher de estágios');
        return;
      }

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
        // Tratar erros de conexão como warning, outros erros como error
        if (handlePrismaConnectionError(error, watcherLogger, 'estagios-watcher')) {
          return; // Erro de conexão tratado, não precisa logar como error
        }

        watcherLogger.error(
          { err: error },
          'Falha ao processar avisos de encerramento de estágios',
        );
      }
    },
    { scheduled: false },
  );

  task.start();
  watcherLogger.info({ schedule, antecedenciaHoras }, 'Watcher de estágios iniciado');
  return task;
};

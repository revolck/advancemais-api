import type { ConfigCategory } from '../catalog';
import { logger } from '@/utils/logger';

const log = logger.child({ module: 'RuntimeCronRegistry' });

export async function reloadRuntimeCronJobs(category: ConfigCategory): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;

  if (category === 'agenda') {
    const { restartAgendaCronJobs } = require('../../cursos/aulas/cron/agenda-jobs') as {
      restartAgendaCronJobs: () => Promise<unknown>;
    };
    await restartAgendaCronJobs();
    log.info({ category }, 'Crons de agenda recarregados a partir da configuração runtime');
    return;
  }

  if (category === 'mercadopago') {
    const { startBoletoWatcherJob, stopBoletoWatcherJob } =
      require('../../mercadopago/assinaturas/cron/boleto-watcher') as {
        startBoletoWatcherJob: () => Promise<unknown>;
        stopBoletoWatcherJob: () => void;
      };
    const { startAssinaturasReconJob, stopAssinaturasReconJob } =
      require('../../mercadopago/assinaturas/cron/reconcile') as {
        startAssinaturasReconJob: () => Promise<unknown>;
        stopAssinaturasReconJob: () => void;
      };
    const { startCobrancaAutomaticaJob, stopCobrancaAutomaticaJob } =
      require('../../empresas/cartoes/cron/cobranca-automatica') as {
        startCobrancaAutomaticaJob: () => Promise<unknown>;
        stopCobrancaAutomaticaJob: () => void;
      };

    stopBoletoWatcherJob();
    stopAssinaturasReconJob();
    stopCobrancaAutomaticaJob();

    await startBoletoWatcherJob();
    await startAssinaturasReconJob();
    await startCobrancaAutomaticaJob();

    log.info(
      { category },
      'Configurações de Mercado Pago atualizadas; crons recarregados e clients lazy usarão novos valores',
    );
    return;
  }

  if (category === 'logs') {
    log.info(
      { category },
      'Configurações de logs atualizadas; ENABLE_FILE_LOG pode exigir restart para efeito completo',
    );
  }
}

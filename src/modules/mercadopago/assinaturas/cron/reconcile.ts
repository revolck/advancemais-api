import cron from 'node-cron';
import { mercadopagoConfig } from '@/config/env';
import { assinaturasService } from '../services/assinaturas.service';
import { logger } from '@/utils/logger';

const log = logger.child({ module: 'AssinaturasCron' });

export function startAssinaturasReconJob() {
  if (!mercadopagoConfig.settings.cronEnabled) {
    log.info('⏱️ Cron de reconciliação desabilitado via env');
    return;
  }
  const schedule = mercadopagoConfig.settings.cronSchedule || '0 2 * * *';
  cron.schedule(schedule, async () => {
    try {
      const result = await assinaturasService.reconcile();
      log.info({ result }, '🔄 Reconciliação de assinaturas executada');
    } catch (err) {
      log.error({ err }, '❌ Erro na reconciliação de assinaturas');
    }
  });
  log.info({ schedule }, '⏱️ Cron de reconciliação agendado');
}

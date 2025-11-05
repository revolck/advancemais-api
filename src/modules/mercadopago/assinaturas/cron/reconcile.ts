import cron from 'node-cron';
import { mercadopagoConfig } from '@/config/env';
import { assinaturasService } from '../services/assinaturas.service';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';

const log = logger.child({ module: 'AssinaturasCron' });

export function startAssinaturasReconJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    log.debug('Test environment detectado, pulando cron de reconciliação');
    return;
  }

  if (!mercadopagoConfig.settings.cronEnabled) {
    log.info('⏱️ Cron de reconciliação desabilitado via env');
    return;
  }
  const schedule = mercadopagoConfig.settings.cronSchedule || '0 2 * * *';
  cron.schedule(schedule, async () => {
    // Verificar conexão ANTES de tentar executar qualquer query
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      log.debug('Banco de dados não disponível, pulando reconciliação de assinaturas');
      return;
    }

    try {
      const result = await assinaturasService.reconcile();
      log.info({ result }, '🔄 Reconciliação de assinaturas executada');
    } catch (err) {
      // Tratar erros de conexão como warning, outros erros como error
      if (handlePrismaConnectionError(err, log, 'reconcile')) {
        return; // Erro de conexão tratado, não precisa logar como error
      }

      log.error({ err }, '❌ Erro na reconciliação de assinaturas');
    }
  });
  log.info({ schedule }, '⏱️ Cron de reconciliação agendado');
}

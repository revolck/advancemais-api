import cron from 'node-cron';
import { assinaturasService } from '../services/assinaturas.service';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { runtimeConfigService } from '@/modules/configuracoes-gerais/services/runtime-config.service';

const log = logger.child({ module: 'AssinaturasCron' });
let assinaturasReconTask: ReturnType<typeof cron.schedule> | null = null;

export async function startAssinaturasReconJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    log.debug('Test environment detectado, pulando cron de reconciliação');
    return;
  }

  stopAssinaturasReconJob();

  const runtimeConfig = await runtimeConfigService.getMercadoPagoConfig();
  if (!runtimeConfig.settings.cronEnabled) {
    log.info('⏱️ Cron de reconciliação desabilitado');
    return;
  }

  const schedule = runtimeConfig.settings.cronSchedule || '0 2 * * *';
  assinaturasReconTask = cron.schedule(schedule, async () => {
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

export function stopAssinaturasReconJob() {
  if (!assinaturasReconTask) return;
  assinaturasReconTask.stop();
  assinaturasReconTask = null;
}

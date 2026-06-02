import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { parseScheduleConfig } from '@/utils/cron-helpers';
import { notificarAulasProximas } from './notificar-aulas.cron';
import { notificarProvasProximas } from './notificar-provas.cron';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';

const agendaLogger = logger.child({ module: 'AgendaCronJobs' });

// =============================================
// CONFIGURAÇÕES
// =============================================

/**
 * Configurações de cron para notificações de agenda
 * Pode ser sobrescrito via variáveis de ambiente
 *
 * Formato simplificado: use apenas o número de minutos
 * Exemplos:
 * - AGENDA_CRON_AULAS_SCHEDULE=15 (a cada 15 minutos)
 * - AGENDA_CRON_AULAS_SCHEDULE=60 (a cada 1 hora)
 * - AGENDA_CRON_AULAS_SCHEDULE=120 (a cada 2 horas)
 *
 * Ou use expressão cron completa se preferir
 */
type CronTask = ReturnType<typeof cron.schedule>;
type AgendaCronConfig = Awaited<ReturnType<typeof runtimeConfigService.getAgendaCronConfig>>;

let activeAgendaTasks: CronTask[] = [];

async function resolveAgendaConfig(): Promise<AgendaCronConfig> {
  try {
    return await runtimeConfigService.getAgendaCronConfig();
  } catch (error) {
    agendaLogger.warn({ err: error }, '⚠️ Falha ao ler configuração runtime; usando env');
    return {
      aulas: {
        enabled: process.env.AGENDA_CRON_AULAS_ENABLED !== 'false',
        schedule: parseScheduleConfig(process.env.AGENDA_CRON_AULAS_SCHEDULE, 15),
      },
      provas: {
        enabled: process.env.AGENDA_CRON_PROVAS_ENABLED !== 'false',
        schedule: parseScheduleConfig(process.env.AGENDA_CRON_PROVAS_SCHEDULE, 15),
      },
      entrevistas: {
        enabled: process.env.AGENDA_CRON_ENTREVISTAS_ENABLED !== 'false',
        schedule: parseScheduleConfig(process.env.AGENDA_CRON_ENTREVISTAS_SCHEDULE, 15),
      },
    };
  }
}

// =============================================
// HELPER: Executar com tratamento de erros
// =============================================

async function executeWithErrorHandling(
  jobName: string,
  jobFunction: () => Promise<any>,
): Promise<void> {
  // Verificar conexão ANTES de tentar executar qualquer query
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    agendaLogger.debug(`Banco de dados não disponível, pulando ${jobName}`);
    return;
  }

  try {
    await jobFunction();
  } catch (error) {
    // Tratar erros de conexão como warning, outros erros como error
    if (handlePrismaConnectionError(error, agendaLogger, jobName)) {
      return; // Erro de conexão tratado, não precisa logar como error
    }

    agendaLogger.error({ err: error, jobName }, `❌ Erro ao executar cron job: ${jobName}`);
  }
}

// =============================================
// CRON JOBS
// =============================================

/**
 * Iniciar cron job de notificações de aulas
 */
export async function startAulasNotificationJob(config?: AgendaCronConfig) {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de aulas');
    return null;
  }

  const resolvedConfig = config ?? (await resolveAgendaConfig());
  if (!resolvedConfig.aulas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de aulas desabilitado');
    return null;
  }

  const schedule = resolvedConfig.aulas.schedule;

  const task = cron.schedule(
    schedule,
    async () => {
      await executeWithErrorHandling('notificar-aulas', notificarAulasProximas);
    },
    { scheduled: false },
  );

  task.start();
  agendaLogger.info({ schedule }, '⏱️ Cron de notificações de aulas iniciado');

  return task;
}

/**
 * Iniciar cron job de notificações de provas/atividades
 */
export async function startProvasNotificationJob(config?: AgendaCronConfig) {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de provas');
    return null;
  }

  const resolvedConfig = config ?? (await resolveAgendaConfig());
  if (!resolvedConfig.provas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de provas desabilitado');
    return null;
  }

  const schedule = resolvedConfig.provas.schedule;

  const task = cron.schedule(
    schedule,
    async () => {
      await executeWithErrorHandling('notificar-provas', notificarProvasProximas);
    },
    { scheduled: false },
  );

  task.start();
  agendaLogger.info({ schedule }, '⏱️ Cron de notificações de provas/atividades iniciado');

  return task;
}

/**
 * Iniciar cron job de notificações de entrevistas
 */
export async function startEntrevistasNotificationJob(config?: AgendaCronConfig) {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de entrevistas');
    return null;
  }

  const resolvedConfig = config ?? (await resolveAgendaConfig());
  if (!resolvedConfig.entrevistas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de entrevistas desabilitado');
    return null;
  }

  // Importação dinâmica para evitar dependência circular

  const {
    notificarEntrevistasProximas,
  } = require('@/modules/recrutador/cron/notificar-entrevistas.cron');

  const schedule = resolvedConfig.entrevistas.schedule;

  const task = cron.schedule(
    schedule,
    async () => {
      await executeWithErrorHandling('notificar-entrevistas', notificarEntrevistasProximas);
    },
    { scheduled: false },
  );

  task.start();
  agendaLogger.info({ schedule }, '⏱️ Cron de notificações de entrevistas iniciado');

  return task;
}

/**
 * Iniciar todos os cron jobs de agenda
 */
export async function stopAgendaCronJobs() {
  for (const task of activeAgendaTasks) {
    try {
      task.stop();
    } catch (error) {
      agendaLogger.warn({ err: error }, 'Falha ao parar cron de agenda');
    }
  }
  activeAgendaTasks = [];
}

export async function startAgendaCronJobs() {
  agendaLogger.info('🚀 Iniciando cron jobs de agenda...');

  await stopAgendaCronJobs();
  const config = await resolveAgendaConfig();
  const jobs = (
    await Promise.all([
      startAulasNotificationJob(config),
      startProvasNotificationJob(config),
      startEntrevistasNotificationJob(config),
    ])
  ).filter(Boolean) as CronTask[]; // Remove nulls

  activeAgendaTasks = jobs;

  agendaLogger.info(
    {
      total: jobs.length,
      enabled: {
        aulas: config.aulas.enabled,
        provas: config.provas.enabled,
        entrevistas: config.entrevistas.enabled,
      },
    },
    '✅ Cron jobs de agenda iniciados',
  );

  return jobs;
}

export async function restartAgendaCronJobs() {
  await stopAgendaCronJobs();
  return startAgendaCronJobs();
}

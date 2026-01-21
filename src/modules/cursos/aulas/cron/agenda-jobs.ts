import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { parseScheduleConfig } from '@/utils/cron-helpers';
import { notificarAulasProximas } from './notificar-aulas.cron';
import { notificarProvasProximas } from './notificar-provas.cron';

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
const CONFIG = {
  // Notificações de aulas (padrão: a cada 15 minutos)
  aulas: {
    enabled: process.env.AGENDA_CRON_AULAS_ENABLED !== 'false',
    schedule: parseScheduleConfig(process.env.AGENDA_CRON_AULAS_SCHEDULE, 15),
  },
  // Notificações de provas/atividades (padrão: a cada 15 minutos)
  provas: {
    enabled: process.env.AGENDA_CRON_PROVAS_ENABLED !== 'false',
    schedule: parseScheduleConfig(process.env.AGENDA_CRON_PROVAS_SCHEDULE, 15),
  },
  // Notificações de entrevistas (padrão: a cada 15 minutos)
  entrevistas: {
    enabled: process.env.AGENDA_CRON_ENTREVISTAS_ENABLED !== 'false',
    schedule: parseScheduleConfig(process.env.AGENDA_CRON_ENTREVISTAS_SCHEDULE, 15),
  },
};

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
export function startAulasNotificationJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de aulas');
    return null;
  }

  if (!CONFIG.aulas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de aulas desabilitado via env');
    return null;
  }

  const schedule = CONFIG.aulas.schedule;

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
export function startProvasNotificationJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de provas');
    return null;
  }

  if (!CONFIG.provas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de provas desabilitado via env');
    return null;
  }

  const schedule = CONFIG.provas.schedule;

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
export function startEntrevistasNotificationJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    agendaLogger.debug('Test environment detectado, pulando cron de notificações de entrevistas');
    return null;
  }

  if (!CONFIG.entrevistas.enabled) {
    agendaLogger.info('⏱️ Cron de notificações de entrevistas desabilitado via env');
    return null;
  }

  // Importação dinâmica para evitar dependência circular
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    notificarEntrevistasProximas,
  } = require('@/modules/recrutador/cron/notificar-entrevistas.cron');

  const schedule = CONFIG.entrevistas.schedule;

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
export function startAgendaCronJobs() {
  agendaLogger.info('🚀 Iniciando cron jobs de agenda...');

  const jobs = [
    startAulasNotificationJob(),
    startProvasNotificationJob(),
    startEntrevistasNotificationJob(),
  ].filter(Boolean); // Remove nulls

  agendaLogger.info(
    {
      total: jobs.length,
      enabled: {
        aulas: CONFIG.aulas.enabled,
        provas: CONFIG.provas.enabled,
        entrevistas: CONFIG.entrevistas.enabled,
      },
    },
    '✅ Cron jobs de agenda iniciados',
  );

  return jobs;
}

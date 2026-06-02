import cron from 'node-cron';
import { cobrancaAutomaticaService } from '../services/cobranca-automatica.service';
import { logger } from '@/utils/logger';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { checkDatabaseConnection } from '@/utils/db-connection-check';
import { runtimeConfigService } from '@/modules/configuracoes-gerais/services/runtime-config.service';

const log = logger.child({ module: 'CobrancaAutomaticaCron' });
let cobrancaAutomaticaTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Processa cobranças automáticas de cartões
 * Executa diariamente às 6h da manhã
 */
async function processarCobrancasAutomaticas() {
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    log.debug('Banco de dados não disponível, pulando cobranças automáticas');
    return;
  }

  try {
    log.info('🔄 Iniciando processamento de cobranças automáticas...');

    // 1. Buscar planos que vencem hoje
    const planos = await cobrancaAutomaticaService.buscarPlanosParaCobrar();

    if (planos.length === 0) {
      log.info('📅 Nenhum plano para cobrar hoje');
      return;
    }

    log.info({ total: planos.length }, `📅 ${planos.length} plano(s) para cobrar hoje`);

    let sucessos = 0;
    let falhas = 0;

    // 2. Processar cada plano
    for (const plano of planos) {
      try {
        const valor = parseFloat(plano.PlanosEmpresariais.valor);
        const descricao = `Renovação ${plano.PlanosEmpresariais.nome} - ${plano.Usuarios.nomeCompleto}`;

        log.info(
          {
            planoId: plano.id,
            empresa: plano.Usuarios.nomeCompleto,
            valor,
          },
          `💳 Processando cobrança...`,
        );

        await cobrancaAutomaticaService.cobrarComFallback(plano.id, valor, descricao);

        sucessos++;
        log.info(
          {
            planoId: plano.id,
            empresa: plano.Usuarios.nomeCompleto,
          },
          `✅ Cobrança processada com sucesso`,
        );
      } catch (error: any) {
        falhas++;
        log.error(
          {
            err: error,
            planoId: plano.id,
            empresa: plano.Usuarios.nomeCompleto,
          },
          `❌ Falha ao processar cobrança`,
        );
      }
    }

    log.info(
      {
        total: planos.length,
        sucessos,
        falhas,
      },
      `🏁 Processamento concluído: ${sucessos} sucesso(s), ${falhas} falha(s)`,
    );
  } catch (error) {
    if (handlePrismaConnectionError(error, log, 'cobranca-automatica')) {
      return;
    }

    log.error({ err: error }, '❌ Erro crítico no processamento de cobranças automáticas');
  }
}

/**
 * Inicia o cron job de cobrança automática
 */
export async function startCobrancaAutomaticaJob() {
  // Não executar em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    log.debug('Test environment detectado, pulando cron de cobrança automática');
    return;
  }

  stopCobrancaAutomaticaJob();

  const runtimeConfig = await runtimeConfigService.getMercadoPagoConfig();
  if (!runtimeConfig.settings.cobrancaEnabled) {
    log.info('⏱️ Cron de cobrança automática desabilitado');
    return;
  }

  const schedule = runtimeConfig.settings.cobrancaSchedule;

  cobrancaAutomaticaTask = cron.schedule(schedule, async () => {
    await processarCobrancasAutomaticas();
  });

  log.info({ schedule }, '⏱️ Cron de cobrança automática agendado');
}

export function stopCobrancaAutomaticaJob() {
  if (!cobrancaAutomaticaTask) return;
  cobrancaAutomaticaTask.stop();
  cobrancaAutomaticaTask = null;
}

// Exportar para testes manuais
export { processarCobrancasAutomaticas };

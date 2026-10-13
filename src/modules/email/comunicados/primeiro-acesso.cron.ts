import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import { processarLote, type ResultadoLote } from './primeiro-acesso.service';

const log = logger.child({ module: 'ComunicadoPrimeiroAcessoJob' });

let emExecucao = false;
let ultimaExecucao: { em: string; resultado: ResultadoLote } | null = null;

/**
 * Executa um ciclo do comunicado. Retorna null se outro ciclo já estiver rodando.
 */
export async function executarCicloComunicado(limite?: number): Promise<ResultadoLote | null> {
  if (emExecucao) return null;
  emExecucao = true;
  try {
    const config = await runtimeConfigService.getComunicadoPrimeiroAcessoConfig();
    const resultado = await processarLote(limite ?? config.lote);
    ultimaExecucao = { em: new Date().toISOString(), resultado };
    if (resultado.processados > 0 || resultado.interrompidoPor) {
      log.info(resultado, '📨 Ciclo do comunicado de primeiro acesso');
    }
    return resultado;
  } finally {
    emExecucao = false;
  }
}

export function getUltimaExecucaoComunicado() {
  return { emExecucao, ultimaExecucao };
}

export function startComunicadoPrimeiroAcessoJob() {
  if (process.env.NODE_ENV === 'test') return;

  const schedule = process.env.COMUNICADO_PRIMEIRO_ACESSO_SCHEDULE || '*/10 * * * *';
  cron.schedule(schedule, async () => {
    try {
      const config = await runtimeConfigService.getComunicadoPrimeiroAcessoConfig();
      if (!config.ativo) return;
      await executarCicloComunicado(config.lote);
    } catch (err) {
      if (handlePrismaConnectionError(err, log, 'comunicado-primeiro-acesso')) return;
      log.error({ err }, '❌ Erro no ciclo do comunicado de primeiro acesso');
    }
  });
  log.info(
    { schedule },
    '⏱️ Comunicado de primeiro acesso agendado (liga/desliga nas configurações)',
  );
}

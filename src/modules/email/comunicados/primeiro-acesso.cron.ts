import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { runtimeConfigService } from '@/modules/configuracoes-gerais';
import { handlePrismaConnectionError } from '@/utils/prisma-errors';
import {
  avaliarTaxaDevolucao,
  contagemPorStatus,
  inicioJanelaDevolucao,
  processarLote,
  sincronizarDevolucoes,
  type ResultadoLote,
} from './primeiro-acesso.service';

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

    // Antes de enviar mais: registra devoluções e respeita o limite de devolução
    // (calculado sobre os envios das últimas 24h)
    try {
      await sincronizarDevolucoes();
    } catch (err) {
      log.warn({ err }, '⚠️ Não foi possível consultar devoluções na Brevo neste ciclo');
    }
    const devolucao = avaliarTaxaDevolucao(
      await contagemPorStatus(inicioJanelaDevolucao()),
      config.maxDevolucao,
    );
    if (devolucao.pausado) {
      const resultado: ResultadoLote = {
        processados: 0,
        enviados: 0,
        falhas: 0,
        incertos: 0,
        descartados: 0,
        interrompidoPor: 'TAXA_DEVOLUCAO_ALTA',
      };
      ultimaExecucao = { em: new Date().toISOString(), resultado };
      log.warn(
        { taxa: devolucao.taxaPercentual, limite: config.maxDevolucao },
        '⏸️ Comunicado pausado: taxa de devolução acima do limite',
      );
      return resultado;
    }

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

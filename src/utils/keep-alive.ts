import { serverConfig } from '../config/env';
import { logger } from './logger';

/**
 * Inicia um ping periódico para manter a instância ativa.
 */
const keepAliveLogger = logger.child({ module: 'KeepAlive' });

export function startKeepAlive(): void {
  const url =
    process.env.KEEP_ALIVE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${serverConfig.port}/health`;

  const interval = parseInt(process.env.KEEP_ALIVE_INTERVAL || '600000', 10); // 10min

  if (!url || interval <= 0) {
    keepAliveLogger.warn({ url, interval }, '⚠️ Keep-alive desativado: URL ou intervalo inválido');
    return;
  }

  setInterval(async () => {
    try {
      await fetch(url);
      keepAliveLogger.info({ url }, '✅ Keep-alive ping concluído');
    } catch (error) {
      keepAliveLogger.error({ url, err: error }, '❌ Erro no keep-alive');
    }
  }, interval);
}

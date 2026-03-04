import { serverConfig } from '../config/env';
import { logger } from './logger';

/**
 * Inicia um ping periódico para manter a instância ativa.
 */
const keepAliveLogger = logger.child({ module: 'KeepAlive' });

export function startKeepAlive(): void {
  const enabled = (process.env.KEEP_ALIVE_ENABLED ?? 'true').toLowerCase() !== 'false';

  if (!enabled) {
    keepAliveLogger.info('ℹ️ Keep-alive desativado via KEEP_ALIVE_ENABLED=false');
    return;
  }

  const localHealthUrl = `http://localhost:${serverConfig.port}/health`;
  const candidateUrl =
    process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || localHealthUrl;

  let url = candidateUrl;
  const allowExternalOnLocal =
    (process.env.KEEP_ALIVE_ALLOW_EXTERNAL ?? 'false').toLowerCase() === 'true';

  // Em ambiente local, evita ping externo por padrão para não gerar timeout desnecessário.
  if (process.env.NODE_ENV !== 'production' && !allowExternalOnLocal) {
    try {
      const parsed = new URL(candidateUrl);
      const isLocalHost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1';

      if (!isLocalHost) {
        url = localHealthUrl;
        keepAliveLogger.warn(
          { candidateUrl, fallbackUrl: localHealthUrl },
          '⚠️ Keep-alive externo detectado em ambiente não-produção; usando health local',
        );
      }
    } catch {
      url = localHealthUrl;
    }
  }

  const interval = parseInt(process.env.KEEP_ALIVE_INTERVAL || '600000', 10); // 10min
  const timeoutMs = parseInt(process.env.KEEP_ALIVE_TIMEOUT_MS || '8000', 10);

  if (!url || interval <= 0 || timeoutMs <= 0) {
    keepAliveLogger.warn(
      { url, interval, timeoutMs },
      '⚠️ Keep-alive desativado: configuração inválida',
    );
    return;
  }

  let pingInFlight = false;
  let failures = 0;

  const runPing = async () => {
    if (pingInFlight) {
      keepAliveLogger.warn({ url }, '⏭️ Keep-alive ignorado: ping anterior ainda em execução');
      return;
    }

    pingInFlight = true;
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        signal: globalThis.AbortSignal.timeout(timeoutMs),
        headers: {
          'cache-control': 'no-cache',
        },
      });

      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        failures += 1;
        keepAliveLogger.warn(
          { url, status: response.status, durationMs, failures },
          '⚠️ Keep-alive retornou status não-2xx',
        );
        return;
      }

      failures = 0;
      keepAliveLogger.info({ url, durationMs }, '✅ Keep-alive ping concluído');
    } catch (error) {
      failures += 1;
      const err = error as {
        name?: string;
        code?: string;
        cause?: { code?: string; name?: string };
      };
      const code = err?.code ?? err?.cause?.code ?? null;
      const normalizedCode = code == null ? null : String(code);
      const durationMs = Date.now() - startedAt;
      const isTimeout =
        normalizedCode === 'UND_ERR_HEADERS_TIMEOUT' ||
        normalizedCode === '23' ||
        err?.name === 'AbortError' ||
        err?.name === 'TimeoutError' ||
        err?.cause?.name === 'HeadersTimeoutError' ||
        err?.cause?.name === 'TimeoutError';
      const isFetchFailure =
        err?.name === 'TypeError' && String((error as Error).message).includes('fetch failed');

      const logPayload = {
        url,
        code,
        durationMs,
        failures,
      };

      if (isTimeout) {
        keepAliveLogger.warn(logPayload, '⚠️ Keep-alive timeout');
      } else if (isFetchFailure) {
        keepAliveLogger.warn(logPayload, '⚠️ Keep-alive fetch falhou');
      } else {
        keepAliveLogger.error({ ...logPayload, err: error }, '❌ Erro no keep-alive');
      }
    } finally {
      pingInFlight = false;
    }
  };

  const timer = setInterval(() => {
    void runPing();
  }, interval);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  // Executa um ping inicial para validar rapidamente a configuração.
  void runPing();
}

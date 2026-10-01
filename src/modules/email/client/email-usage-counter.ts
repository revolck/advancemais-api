import redis from '@/config/redis';
import { logger } from '@/utils/logger';
import type { EmailProviderName } from './types';

const KEY_TTL_SECONDS = 2 * 24 * 60 * 60;
const log = logger.child({ module: 'EmailUsageCounter' });
const memory = new Map<string, number>();

/** Dia corrente no fuso de São Paulo (YYYY-MM-DD) */
function currentDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

function usageKey(provider: EmailProviderName): string {
  return `email:usage:${provider}:${currentDay()}`;
}

function isRedisAvailable(): boolean {
  try {
    return Boolean(process.env.REDIS_URL) && redis.status === 'ready';
  } catch {
    return false;
  }
}

function pruneMemory(): void {
  const today = currentDay();
  for (const key of memory.keys()) {
    if (!key.endsWith(today)) memory.delete(key);
  }
}

/**
 * Contador de envios por canal e por dia.
 * Reserva antes de enviar (atômico no Redis) para que envios em paralelo
 * não ultrapassem o limite diário do provedor.
 */
export const emailUsageCounter = {
  async reserve(provider: EmailProviderName, limit: number): Promise<boolean> {
    if (limit <= 0) return false;
    const key = usageKey(provider);

    if (isRedisAvailable()) {
      try {
        const value = await redis.incr(key);
        if (value === 1) await redis.expire(key, KEY_TTL_SECONDS);
        if (value > limit) {
          await redis.decr(key);
          return false;
        }
        return true;
      } catch (error) {
        log.warn(
          { err: error, provider },
          '⚠️ Redis indisponível no contador de e-mail; usando memória',
        );
      }
    }

    pruneMemory();
    const current = memory.get(key) ?? 0;
    if (current >= limit) return false;
    memory.set(key, current + 1);
    return true;
  },

  async release(provider: EmailProviderName): Promise<void> {
    const key = usageKey(provider);

    if (isRedisAvailable()) {
      try {
        const value = await redis.decr(key);
        if (value < 0) await redis.set(key, 0, 'EX', KEY_TTL_SECONDS);
        return;
      } catch (error) {
        log.warn({ err: error, provider }, '⚠️ Falha ao liberar reserva no Redis');
      }
    }

    const current = memory.get(key) ?? 0;
    memory.set(key, Math.max(0, current - 1));
  },

  /** O provedor recusou por cota: considera o dia esgotado para esse canal */
  async markExhausted(provider: EmailProviderName, limit: number): Promise<void> {
    const key = usageKey(provider);

    if (isRedisAvailable()) {
      try {
        await redis.set(key, limit, 'EX', KEY_TTL_SECONDS);
        return;
      } catch (error) {
        log.warn({ err: error, provider }, '⚠️ Falha ao marcar cota esgotada no Redis');
      }
    }

    memory.set(key, limit);
  },

  async get(provider: EmailProviderName): Promise<number> {
    const key = usageKey(provider);

    if (isRedisAvailable()) {
      try {
        return Number((await redis.get(key)) ?? 0);
      } catch {
        // cai para memória
      }
    }

    return memory.get(key) ?? 0;
  },

  /** Apenas para testes */
  resetMemory(): void {
    memory.clear();
  },
};

import type { Response } from 'express';
import crypto from 'crypto';
import redis from '@/config/redis';
import { logger } from './logger';

const cacheLogger = logger.child({ module: 'Cache' });

/**
 * TTL padrão para cache (60 segundos)
 */
export const DEFAULT_TTL = 60;

/**
 * Cache simples para operações frequentes
 * Usa Redis quando disponível, fallback para in-memory cache
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data: value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const inMemoryCache = new InMemoryCache();

/**
 * Verifica se Redis está disponível
 */
function isRedisAvailable(): boolean {
  try {
    if (!redis) return false;
    const status = redis.status;
    return status === 'ready' || status === 'connect';
  } catch {
    return false;
  }
}

/**
 * Cache de dados com TTL
 * @param key - Chave do cache
 * @param fetcher - Função que busca os dados se não estiverem em cache
 * @param ttlSeconds - Tempo de vida em segundos (padrão: 60s)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  // Tentar buscar do cache
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Buscar dados e cachear
  const data = await fetcher();
  await setCache(key, data, ttlSeconds);
  return data;
}

/**
 * Busca valor do cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (isRedisAvailable()) {
      const value = await redis.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
    } else {
      return inMemoryCache.get<T>(key);
    }
  } catch (error) {
    // Em ambiente de teste, não logar erros de cache (Redis pode não estar disponível)
    if (process.env.NODE_ENV !== 'test') {
      cacheLogger.warn({ err: error, key }, 'Erro ao buscar do cache');
    }
  }
  return null;
}

/**
 * Define valor no cache
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    // ✅ Validação: TTL deve ser um número inteiro positivo
    // Redis SETEX não aceita valores <= 0 ou não numéricos
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      cacheLogger.warn(
        { key, ttlSeconds, receivedType: typeof ttlSeconds },
        '⚠️ TTL inválido para cache - deve ser número inteiro positivo. Use deleteCache() para remover.',
      );
      return;
    }

    if (isRedisAvailable()) {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } else {
      inMemoryCache.set(key, value, ttlSeconds);
    }
  } catch (error) {
    // Em ambiente de teste, não logar erros de cache (Redis pode não estar disponível)
    if (process.env.NODE_ENV !== 'test') {
      cacheLogger.warn({ err: error, key, ttlSeconds }, 'Erro ao definir cache');
    }
  }
}

/**
 * Remove valor do cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    if (isRedisAvailable()) {
      await redis.del(key);
    } else {
      inMemoryCache.delete(key);
    }
  } catch (error) {
    // Em ambiente de teste, não logar erros de cache (Redis pode não estar disponível)
    if (process.env.NODE_ENV !== 'test') {
      cacheLogger.warn({ err: error, key }, 'Erro ao deletar cache');
    }
  }
}

/**
 * Remove múltiplas chaves do cache (prefixo)
 */
export async function deleteCacheByPattern(pattern: string): Promise<void> {
  try {
    if (isRedisAvailable()) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // Para in-memory, não temos padrão, mas podemos limpar tudo se necessário
      cacheLogger.debug({ pattern }, 'Pattern delete não suportado em in-memory cache');
    }
  } catch (error) {
    // Em ambiente de teste, não logar erros de cache
    if (process.env.NODE_ENV !== 'test') {
      cacheLogger.warn({ err: error, pattern }, 'Erro ao deletar cache por padrão');
    }
  }
}

/**
 * Invalida cache (aceita string ou array de strings)
 */
export async function invalidateCache(key: string | string[]): Promise<void> {
  if (Array.isArray(key)) {
    for (const k of key) {
      await deleteCache(k);
    }
  } else {
    await deleteCache(key);
  }
}

/**
 * Invalida cache por prefixo (alias para deleteCacheByPattern)
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  await deleteCacheByPattern(`${prefix}*`);
}

/**
 * Cache específico para perfis de usuário
 */
export const userCache = {
  get: (userId: string) => getCache(`user:profile:${userId}`),
  set: (userId: string, data: any, ttlSeconds = 300) =>
    setCache(`user:profile:${userId}`, data, ttlSeconds),
  delete: (userId: string) => deleteCache(`user:profile:${userId}`),
};

/**
 * Cache específico para login (tentativas, bloqueios)
 */
export const loginCache = {
  getAttempts: (documento: string) => getCache<number>(`login:attempts:${documento}`),
  setAttempts: (documento: string, attempts: number, ttlSeconds = 900) =>
    setCache(`login:attempts:${documento}`, attempts, ttlSeconds),
  deleteAttempts: (documento: string) => deleteCache(`login:attempts:${documento}`),
  getBlocked: (documento: string) => getCache<boolean>(`login:blocked:${documento}`),
  setBlocked: (documento: string, blocked: boolean, ttlSeconds = 3600) =>
    setCache(`login:blocked:${documento}`, blocked, ttlSeconds),
  deleteBlocked: (documento: string) => deleteCache(`login:blocked:${documento}`),
};

/**
 * Define headers de cache HTTP (ETag, Cache-Control) e retorna o ETag gerado
 * @param res - Response do Express
 * @param data - Dados para gerar o ETag
 * @param ttlSeconds - Tempo de vida em segundos
 * @returns ETag gerado
 */
export function setCacheHeaders<T>(res: Response, data: T, ttlSeconds: number): string {
  // Gerar ETag baseado nos dados
  const dataString = JSON.stringify(data);
  const etag = `"${crypto.createHash('md5').update(dataString).digest('hex')}"`;

  // Configurar headers
  res.set('ETag', etag);
  res.set('Cache-Control', `public, max-age=${ttlSeconds}`);

  return etag;
}

/**
 * Gera chave de cache baseada nos parâmetros da query
 * @param prefix - Prefixo da chave (ex: 'users:list')
 * @param params - Parâmetros da query
 * @param options - Opções (ex: excludeKeys para excluir parâmetros da chave)
 * @returns Chave de cache gerada
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, any>,
  options?: { excludeKeys?: string[] },
): string {
  const excludeKeys = options?.excludeKeys || ['page', 'limit'];
  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([key]) => !excludeKeys.includes(key)),
  );
  const paramsString = JSON.stringify(filteredParams, Object.keys(filteredParams).sort());
  const paramsHash = Buffer.from(paramsString)
    .toString('base64')
    .slice(0, 16)
    .replace(/[^a-zA-Z0-9]/g, '');
  return `${prefix}:${paramsHash}`;
}

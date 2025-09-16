import { createHash } from 'crypto';
import type { Response } from 'express';
import redis from '../config/redis';

export const DEFAULT_TTL = Number(process.env.CACHE_TTL || '60');
const memoryStore = new Map<string, any>();

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (!process.env.REDIS_URL) {
      return memoryStore.has(key) ? (memoryStore.get(key) as T) : null;
    }
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: any, ttl = DEFAULT_TTL): Promise<void> {
  try {
    if (!process.env.REDIS_URL) {
      memoryStore.set(key, value);
      setTimeout(() => memoryStore.delete(key), ttl * 1000);
      return;
    }
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // ignore errors
  }
}

export async function invalidateCache(key: string | string[]): Promise<void> {
  try {
    if (!process.env.REDIS_URL) {
      if (Array.isArray(key)) key.forEach((k) => memoryStore.delete(k));
      else memoryStore.delete(key);
      return;
    }
    if (Array.isArray(key)) {
      if (key.length) await redis.del(...key);
    } else {
      await redis.del(key);
    }
  } catch {
    // ignore errors
  }
}

export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  try {
    if (!process.env.REDIS_URL) {
      for (const key of memoryStore.keys()) {
        if (key.startsWith(prefix)) memoryStore.delete(key);
      }
      return;
    }
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [next, found] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      keys.push(...found);
    } while (cursor !== '0');
    if (keys.length) await redis.del(...keys);
  } catch {
    // ignore errors
  }
}

export function setCacheHeaders(res: Response, data: unknown, ttl = DEFAULT_TTL): string {
  const etag = createHash('md5').update(JSON.stringify(data)).digest('hex');
  res.setHeader('Cache-Control', `public, max-age=${ttl}`);
  res.setHeader('ETag', etag);
  return etag;
}

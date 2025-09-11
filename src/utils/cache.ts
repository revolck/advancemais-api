import redis from '../config/redis';

const DEFAULT_TTL = Number(process.env.CACHE_TTL || '60');
const memoryStore = new Map<string, any>();

async function get<T>(key: string): Promise<T | null> {
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

async function set(key: string, value: any, ttl = DEFAULT_TTL): Promise<void> {
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

async function invalidate(key: string | string[]): Promise<void> {
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

export default { get, set, invalidate };

import type { NextFunction, Request, Response } from 'express';

import { CUPONS_HTTP_CACHE_TTL } from '@/modules/cupons/config';
import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const CUPONS_HTTP_GET_CACHE_PREFIX = 'cupons:http:get';

const buildCuponsGetCacheKey = (req: Request): string =>
  generateCacheKey(
    CUPONS_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
      role: req.user?.role ?? 'ANON',
    },
    { excludeKeys: [] },
  );

export const cuponsGetResponseCache = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = buildCuponsGetCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, CUPONS_HTTP_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const invalidateCuponsGetResponseCache = async () => {
  await invalidateCacheByPrefix(CUPONS_HTTP_GET_CACHE_PREFIX);
};

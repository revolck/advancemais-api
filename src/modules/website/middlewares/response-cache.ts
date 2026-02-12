import type { NextFunction, Request, Response } from 'express';

import { WEBSITE_HTTP_CACHE_TTL } from '@/modules/website/config';
import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const WEBSITE_HTTP_GET_CACHE_PREFIX = 'website:http:get';

const buildWebsiteGetCacheKey = (req: Request): string =>
  generateCacheKey(
    WEBSITE_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
    },
    { excludeKeys: [] },
  );

export const websiteGetResponseCache = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = buildWebsiteGetCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, WEBSITE_HTTP_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const invalidateWebsiteGetResponseCache = async () => {
  await invalidateCacheByPrefix(WEBSITE_HTTP_GET_CACHE_PREFIX);
};

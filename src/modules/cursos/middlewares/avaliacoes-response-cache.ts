import type { NextFunction, Request, Response } from 'express';

import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const AVALIACOES_HTTP_GET_CACHE_PREFIX = 'cursos:avaliacoes:http:get';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const AVALIACOES_HTTP_GET_CACHE_TTL = resolveTtl(
  process.env.CACHE_TTL_CURSOS_AVALIACOES_HTTP_GET,
  30,
);

const buildAvaliacoesGetCacheKey = (req: Request): string =>
  generateCacheKey(
    AVALIACOES_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
      role: req.user?.role ?? 'ANON',
      userId: req.user?.id ?? 'ANON',
    },
    { excludeKeys: [] },
  );

export const invalidateCursosAvaliacoesGetResponseCache = async () => {
  await invalidateCacheByPrefix(AVALIACOES_HTTP_GET_CACHE_PREFIX);
};

export const cursosAvaliacoesGetResponseCache = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = buildAvaliacoesGetCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, AVALIACOES_HTTP_GET_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const cursosAvaliacoesInvalidateCacheOnMutation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void invalidateCursosAvaliacoesGetResponseCache();
    }
  });

  return next();
};

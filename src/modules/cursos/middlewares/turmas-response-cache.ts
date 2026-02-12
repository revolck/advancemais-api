import type { NextFunction, Request, Response } from 'express';

import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const TURMAS_HTTP_GET_CACHE_PREFIX = 'cursos:turmas:http:get';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const TURMAS_HTTP_GET_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_TURMAS_HTTP_GET, 30);

const isCursoIdParamValid = (req: Request): boolean => {
  const cursoId = req.params?.cursoId;
  if (!cursoId || typeof cursoId !== 'string') {
    return false;
  }
  return UUID_REGEX.test(cursoId);
};

const buildTurmasGetCacheKey = (req: Request): string =>
  generateCacheKey(
    TURMAS_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
      role: req.user?.role ?? 'ANON',
      userId: req.user?.id ?? 'ANON',
    },
    { excludeKeys: [] },
  );

export const cursosTurmasGetResponseCache = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'GET' || !isCursoIdParamValid(req)) {
    return next();
  }

  const cacheKey = buildTurmasGetCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, TURMAS_HTTP_GET_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const cursosTurmasInvalidateCacheOnMutation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!MUTATION_METHODS.has(req.method) || !isCursoIdParamValid(req)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void invalidateCacheByPrefix(TURMAS_HTTP_GET_CACHE_PREFIX);
    }
  });

  return next();
};

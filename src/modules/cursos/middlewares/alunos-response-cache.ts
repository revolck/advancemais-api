import type { NextFunction, Request, Response } from 'express';

import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const CURSOS_ALUNOS_HTTP_GET_CACHE_PREFIX = 'cursos:alunos:http:get';

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const CURSOS_ALUNOS_HTTP_GET_CACHE_TTL = resolveTtl(
  process.env.CACHE_TTL_CURSOS_ALUNOS_HTTP_GET,
  30,
);
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const buildCacheKey = (req: Request): string =>
  generateCacheKey(
    CURSOS_ALUNOS_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
      role: req.user?.role ?? 'ANON',
      userId: req.user?.id ?? 'ANON',
    },
    { excludeKeys: [] },
  );

export const cursosAlunosGetResponseCache = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'GET') {
    return next();
  }

  const cacheKey = buildCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, CURSOS_ALUNOS_HTTP_GET_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const invalidateCursosAlunosGetResponseCache = async () => {
  await invalidateCacheByPrefix(CURSOS_ALUNOS_HTTP_GET_CACHE_PREFIX);
};

export const cursosAlunosInvalidateCacheOnMutation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void invalidateCursosAlunosGetResponseCache();
    }
  });

  return next();
};

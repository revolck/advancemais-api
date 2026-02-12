import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

import { generateCacheKey, getCache, invalidateCacheByPrefix, setCache } from '@/utils/cache';

const AULAS_HTTP_GET_CACHE_PREFIX = 'cursos:aulas:http:get';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const resolveTtl = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const AULAS_HTTP_GET_CACHE_TTL = resolveTtl(process.env.CACHE_TTL_CURSOS_AULAS_HTTP_GET, 30);

const hashAuthorizationHeader = (authorization?: string): string => {
  if (!authorization) return 'ANON';
  return crypto.createHash('sha256').update(authorization).digest('hex').slice(0, 16);
};

const shouldBypassGetCache = (req: Request): boolean => {
  const path = req.path.toLowerCase();

  // Histórico é trilha de auditoria e já envia no-store no controller.
  if (path.includes('/historico')) return true;

  // Download por token é resposta de redirecionamento e não agrega valor em cache HTTP JSON.
  if (path.startsWith('/materiais/download/')) return true;

  return false;
};

const buildAulasGetCacheKey = (req: Request): string =>
  generateCacheKey(
    AULAS_HTTP_GET_CACHE_PREFIX,
    {
      method: req.method,
      url: req.originalUrl,
      auth: hashAuthorizationHeader(req.headers.authorization),
      role: req.user?.role ?? 'ANON',
      userId: req.user?.id ?? 'ANON',
    },
    { excludeKeys: [] },
  );

export const cursosAulasGetResponseCache = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'GET' || shouldBypassGetCache(req)) {
    return next();
  }

  const cacheKey = buildAulasGetCacheKey(req);
  const cached = await getCache<unknown>(cacheKey);

  if (cached !== null) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCache(cacheKey, body, AULAS_HTTP_GET_CACHE_TTL);
    }
    return originalJson(body);
  }) as Response['json'];

  return next();
};

export const cursosAulasInvalidateCacheOnMutation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!MUTATION_METHODS.has(req.method)) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      void invalidateCacheByPrefix(AULAS_HTTP_GET_CACHE_PREFIX);
    }
  });

  return next();
};

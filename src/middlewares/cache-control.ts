import { Request, Response, NextFunction } from 'express';
import { DEFAULT_TTL } from '@/utils/cache';

export function publicCache(req: Request, res: Response, next: NextFunction) {
  const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL);
  const hasAuthContext = Boolean(req.headers.authorization || req.cookies?.token);
  const visibility = hasAuthContext ? 'private' : 'public';
  res.set('Cache-Control', `${visibility}, max-age=${ttl}`);
  next();
}

/**
 * Dados que mudam por ação de alguém (ex.: vaga despublicada) e precisam sumir na hora:
 * o navegador pode guardar, mas confere com o servidor a cada uso (ETag → 304 barato).
 * Com login, a resposta é privada (nenhum cache compartilhado guarda).
 */
export function revalidarSempre(req: Request, res: Response, next: NextFunction) {
  const hasAuthContext = Boolean(req.headers.authorization || req.cookies?.token);
  res.set('Cache-Control', `${hasAuthContext ? 'private' : 'public'}, no-cache`);
  next();
}

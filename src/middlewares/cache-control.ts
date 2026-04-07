import { Request, Response, NextFunction } from 'express';
import { DEFAULT_TTL } from '@/utils/cache';

export function publicCache(req: Request, res: Response, next: NextFunction) {
  const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL);
  const hasAuthContext = Boolean(req.headers.authorization || req.cookies?.token);
  const visibility = hasAuthContext ? 'private' : 'public';
  res.set('Cache-Control', `${visibility}, max-age=${ttl}`);
  next();
}

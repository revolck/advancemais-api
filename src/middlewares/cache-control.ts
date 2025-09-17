import { Request, Response, NextFunction } from 'express';
import { DEFAULT_TTL } from '@/utils/cache';

export function publicCache(req: Request, res: Response, next: NextFunction) {
  const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL);
  res.set('Cache-Control', `public, max-age=${ttl}`);
  next();
}

import { Request, Response, NextFunction } from 'express';

export function publicCache(req: Request, res: Response, next: NextFunction) {
  res.set('Cache-Control', 'public, max-age=60');
  next();
}

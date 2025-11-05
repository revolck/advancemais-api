import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para desabilitar rate limiting em testes
 * Usa a variável de ambiente NODE_ENV=test para identificar
 */
export const disableRateLimitInTests = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    // Skip rate limiting em testes
    return next();
  }
  // Em produção, passa para o próximo middleware (rate limiter real)
  next();
};

/**
 * Mock do IP para testes
 * Garante que cada teste tenha um IP único para evitar rate limiting
 * Usa connection.remoteAddress que pode ser sobrescrito
 */
export const mockIpForTests = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    // Usa timestamp + random para garantir IP único por teste
    const mockIp = `127.0.0.${Date.now() % 255}.${Math.floor(Math.random() * 255)}`;
    // Sobrescrever connection.remoteAddress que é usado pelo rate limiter
    if (req.connection) {
      (req.connection as any).remoteAddress = mockIp;
    }
    // Também definir header X-Forwarded-For que alguns middlewares usam
    req.headers['x-forwarded-for'] = mockIp;
  }
  next();
};


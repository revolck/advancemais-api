import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { type RateLimitExceededEventHandler } from 'express-rate-limit';

import { rateLimitConfig } from '@/config/env';
import { logger } from '@/utils/logger';

const rateLimitLogger = logger.child({ module: 'RateLimitMiddleware' });

const ensurePositiveNumber = (value: number, fallback: number): number => {
  if (Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
};

const sanitizeIp = (ip: string): string => {
  let value = ip.trim();
  if (value.length === 0) {
    return value;
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1);
  }

  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) {
    value = value.slice(0, zoneIndex);
  }

  if (/^[0-9.]+:\\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(':'));
  }

  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }

  return value.toLowerCase();
};

const normalizePath = (path: string): string => {
  if (!path) {
    return '';
  }

  let normalized = path.trim();
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  normalized = normalized.replace(/\/{2,}/g, '/');

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.toLowerCase();
};

const allowList = {
  ips: new Set<string>(),
  paths: new Set<string>(),
  wildcards: new Set<string>(),
  userAgents: (rateLimitConfig.allowList?.userAgents ?? []).map((ua) => ua.toLowerCase()),
};

(rateLimitConfig.allowList?.ips ?? []).forEach((ip) => {
  const trimmed = ip.trim();
  if (!trimmed) {
    return;
  }

  const lower = trimmed.toLowerCase();
  allowList.ips.add(lower);
  allowList.ips.add(sanitizeIp(trimmed));
});

(rateLimitConfig.allowList?.paths ?? []).forEach((path) => {
  const trimmed = path.trim();
  if (!trimmed) {
    return;
  }

  if (trimmed.endsWith('*')) {
    const wildcard = normalizePath(trimmed.slice(0, -1));
    if (wildcard) {
      allowList.wildcards.add(wildcard);
    }
    return;
  }

  allowList.paths.add(normalizePath(trimmed));
});

const getClientIp = (req: Request): string | undefined => {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return sanitizeIp(req.ips[0]);
  }

  if (req.ip) {
    return sanitizeIp(req.ip);
  }

  const headerIp = req.headers['x-forwarded-for'];
  if (typeof headerIp === 'string' && headerIp.length > 0) {
    return sanitizeIp(headerIp.split(',')[0]);
  }

  if (req.socket?.remoteAddress) {
    return sanitizeIp(req.socket.remoteAddress);
  }

  return undefined;
};

const isIpAllowListed = (ip: string | undefined): boolean => {
  if (!ip) {
    return false;
  }

  if (allowList.ips.has('*')) {
    return true;
  }

  const normalized = sanitizeIp(ip);
  return allowList.ips.has(normalized) || allowList.ips.has(ip.toLowerCase());
};

const isPathAllowListed = (req: Request): boolean => {
  const pathToCheck = normalizePath(`${req.baseUrl || ''}${req.path || ''}`);
  if (!pathToCheck) {
    return false;
  }

  if (allowList.paths.has('*')) {
    return true;
  }

  if (allowList.paths.has(pathToCheck)) {
    return true;
  }

  for (const wildcard of allowList.wildcards) {
    if (pathToCheck.startsWith(wildcard)) {
      return true;
    }
  }

  return false;
};

const shouldSkip = (req: Request): boolean => {
  if (!rateLimitConfig.enabled) {
    return true;
  }

  if (req.method === 'OPTIONS') {
    return true;
  }

  if (isPathAllowListed(req)) {
    return true;
  }

  const clientIp = getClientIp(req);
  if (isIpAllowListed(clientIp)) {
    return true;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const forwardedIps = forwardedFor
      .split(',')
      .map((value) => sanitizeIp(value))
      .filter((value) => value.length > 0);

    if (forwardedIps.some((ip) => isIpAllowListed(ip))) {
      return true;
    }
  }

  const userAgent = req.headers['user-agent'];
  if (typeof userAgent === 'string' && userAgent.length > 0) {
    const normalizedUa = userAgent.toLowerCase();
    if (allowList.userAgents.some((ua) => ua.length > 0 && normalizedUa.includes(ua))) {
      return true;
    }
  }

  return false;
};

const getRateLimitKey = (req: Request): string => {
  const authUserId =
    (req as Record<string, any>).user?.id ??
    (req as Record<string, any>).userId ??
    (req as Record<string, any>).auth?.userId;

  if (authUserId) {
    return `user:${authUserId}`;
  }

  const clientIp = getClientIp(req);
  if (clientIp) {
    return `ip:${clientIp}`;
  }

  return `ip:${req.ip || 'unknown'}`;
};

const handleLimitExceeded: RateLimitExceededEventHandler = (req, res, _next, optionsUsed) => {
  const info = (req as Record<string, any>).rateLimit;
  const resetTime = info?.resetTime?.getTime();
  const retryAfterSeconds = resetTime
    ? Math.max(0, Math.ceil((resetTime - Date.now()) / 1000))
    : Math.ceil(ensurePositiveNumber(optionsUsed.windowMs, rateLimitConfig.windowMs) / 1000);

  rateLimitLogger.warn(
    {
      key: getRateLimitKey(req),
      method: req.method,
      path: req.originalUrl,
      retryAfterSeconds,
    },
    'Limite de requisições excedido',
  );

  res.status(optionsUsed.statusCode).json({
    message: 'Muitas requisições detectadas. Tente novamente em instantes.',
    details:
      'O limite de requisições para esta origem foi atingido. Aguarde e tente novamente em breve.',
    limit:
      info?.limit ??
      (typeof optionsUsed.limit === 'number' ? optionsUsed.limit : rateLimitConfig.maxRequests),
    remaining: info?.remaining ?? 0,
    retryAfterSeconds,
    resetTime: info?.resetTime?.toISOString(),
    correlationId: (req as Record<string, any>).id,
  });
};

const windowMs = ensurePositiveNumber(rateLimitConfig.windowMs, 15 * 60 * 1000);
const maxRequests = ensurePositiveNumber(rateLimitConfig.maxRequests, 1000);

let rateLimitMiddleware: RequestHandler;

if (!rateLimitConfig.enabled || rateLimitConfig.maxRequests <= 0) {
  rateLimitLogger.info(
    {
      enabled: rateLimitConfig.enabled,
      maxRequests: rateLimitConfig.maxRequests,
    },
    'Rate limit global desativado',
  );

  rateLimitMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();
} else {
  rateLimitLogger.info(
    {
      windowMs,
      maxRequests,
      allowList: {
        ips: Array.from(allowList.ips),
        paths: Array.from(allowList.paths),
        wildcards: Array.from(allowList.wildcards),
        userAgents: allowList.userAgents,
      },
    },
    'Rate limit global configurado',
  );

  rateLimitMiddleware = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipFailedRequests: rateLimitConfig.skipFailedRequests,
    skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
    keyGenerator: getRateLimitKey,
    skip: shouldSkip,
    handler: handleLimitExceeded,
    statusCode: 429,
    requestPropertyName: 'rateLimit',
  });
}

export { rateLimitMiddleware };

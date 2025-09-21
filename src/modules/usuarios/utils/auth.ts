import type { CookieOptions, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { authSessionConfig, jwtConfig } from '../../../config/env';
import { logger } from '@/utils/logger';

const authLogger = logger.child({ module: 'AuthUtils' });

/**
 * Interface para payload do token de acesso
 */
interface AccessTokenPayload {
  id: string;
  role: string;
  type: 'access';
}

/**
 * Interface para payload do refresh token
 */
interface RefreshTokenPayload {
  id: string;
  type: 'refresh';
}

interface TokenPairOptions {
  rememberMe?: boolean;
  refreshExpiresIn?: string;
}

/**
 * Gera token JWT de acesso para autenticação
 * @param id - ID único do usuário
 * @param role - Função/papel do usuário no sistema
 * @returns Token JWT válido conforme configuração
 */
export const generateToken = (id: string, role: string): string => {
  const payload: AccessTokenPayload = {
    id,
    role,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.expiresIn as any,
    issuer: 'advancemais-api',
    audience: 'advancemais-users',
    subject: id,
    jwtid: `access_${id}_${Date.now()}`,
  };
  return jwt.sign(payload, jwtConfig.secret, options);
};

/**
 * Gera refresh token para renovação de sessão
 * @param id - ID único do usuário
 * @returns Refresh token válido conforme configuração
 */
export const generateRefreshToken = (id: string, expiresIn?: string): string => {
  const payload: RefreshTokenPayload = {
    id,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: (expiresIn || jwtConfig.refreshExpiresIn) as any,
    issuer: 'advancemais-api',
    audience: 'advancemais-refresh',
    subject: id,
    jwtid: `refresh_${id}_${Date.now()}`,
  };
  return jwt.sign(payload, jwtConfig.refreshSecret, options);
};

/**
 * Verifica se um token JWT de acesso é válido
 * @param token - Token para verificar
 * @returns Dados decodificados do token ou null se inválido
 */
export const verifyToken = (token: string): AccessTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: 'advancemais-api',
      audience: 'advancemais-users',
    }) as AccessTokenPayload;

    // Validação adicional do tipo
    if (decoded.type !== 'access') {
      authLogger.error({ tokenType: decoded.type }, 'Token inválido: não é um token de acesso');
      return null;
    }

    return decoded;
  } catch (error) {
    authLogger.error({ err: error }, 'Erro ao verificar token de acesso');
    return null;
  }
};

/**
 * Verifica se um refresh token é válido
 * @param refreshToken - Refresh token para verificar
 * @returns Dados decodificados do token ou null se inválido
 */
export const verifyRefreshToken = (refreshToken: string): RefreshTokenPayload | null => {
  try {
    const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret, {
      issuer: 'advancemais-api',
      audience: 'advancemais-refresh',
    }) as RefreshTokenPayload;

    // Validação adicional do tipo
    if (decoded.type !== 'refresh') {
      authLogger.error({ tokenType: decoded.type }, 'Token inválido: não é um refresh token');
      return null;
    }

    return decoded;
  } catch (error) {
    authLogger.error({ err: error }, 'Erro ao verificar refresh token');
    return null;
  }
};

/**
 * Decodifica um token sem verificar a assinatura (apenas para debug)
 * @param token - Token para decodificar
 * @returns Dados decodificados ou null
 */
export const decodeToken = (token: string): any | null => {
  try {
    return jwt.decode(token);
  } catch (error) {
    authLogger.error({ err: error }, 'Erro ao decodificar token');
    return null;
  }
};

/**
 * Extrai o ID do usuário de um token sem verificar (útil para logs)
 * @param token - Token para extrair ID
 * @returns ID do usuário ou null
 */
export const extractUserIdFromToken = (token: string): string | null => {
  try {
    const decoded = jwt.decode(token) as any;
    return decoded?.id || decoded?.sub || null;
  } catch {
    return null;
  }
};

/**
 * Verifica se um token está próximo do vencimento
 * @param token - Token para verificar
 * @param thresholdMinutes - Limite em minutos (padrão: 5)
 * @returns true se o token vence em menos que o threshold
 */
export const isTokenNearExpiry = (token: string, thresholdMinutes: number = 5): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded?.exp) return false;

    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeToExpiry = expirationTime - currentTime;
    const thresholdMs = thresholdMinutes * 60 * 1000;

    return timeToExpiry <= thresholdMs;
  } catch {
    return true; // Se não conseguir decodificar, considera como próximo do vencimento
  }
};

/**
 * Gera um par de tokens (access + refresh)
 * @param id - ID do usuário
 * @param role - Role do usuário
 * @returns Objeto com ambos os tokens
 */
const REFRESH_DURATION_FALLBACK_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

const durationRegex = /^(\d+)(ms|s|m|h|d|w)$/i;
const durationMultipliers: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export const durationStringToMs = (duration: string | undefined): number => {
  if (!duration) return REFRESH_DURATION_FALLBACK_MS;

  const trimmed = duration.trim();
  const match = durationRegex.exec(trimmed);

  if (!match) {
    authLogger.warn(
      { duration },
      '⚠️ Valor de expiração inválido. Usando fallback padrão de 30 dias.',
    );
    return REFRESH_DURATION_FALLBACK_MS;
  }

  const value = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = durationMultipliers[unit];

  if (!Number.isFinite(value) || value <= 0 || !multiplier) {
    authLogger.warn(
      { duration },
      '⚠️ Valor de expiração inválido. Usando fallback padrão de 30 dias.',
    );
    return REFRESH_DURATION_FALLBACK_MS;
  }

  return value * multiplier;
};

export const getRefreshTokenExpiration = (rememberMe: boolean) => {
  const expiresIn = rememberMe ? jwtConfig.refreshPersistentExpiresIn : jwtConfig.refreshExpiresIn;
  const maxAgeMs = durationStringToMs(expiresIn);
  const expiresAt = new Date(Date.now() + maxAgeMs);

  return { expiresIn, maxAgeMs, expiresAt };
};

const buildBaseCookieOptions = (): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    secure: authSessionConfig.secure,
    sameSite: authSessionConfig.sameSite as CookieOptions['sameSite'],
    path: authSessionConfig.cookiePath || '/',
  };

  if (authSessionConfig.cookieDomain) {
    options.domain = authSessionConfig.cookieDomain;
  }

  return options;
};

export const setRefreshTokenCookie = (res: Response, token: string, rememberMe: boolean) => {
  const { maxAgeMs } = getRefreshTokenExpiration(rememberMe);
  const options = buildBaseCookieOptions();
  options.maxAge = maxAgeMs;
  res.cookie(authSessionConfig.refreshTokenCookieName, token, options);
};

export const clearRefreshTokenCookie = (res: Response) => {
  const options = buildBaseCookieOptions();
  options.maxAge = 0;
  options.expires = new Date(0);
  res.clearCookie(authSessionConfig.refreshTokenCookieName, options);
};

export const extractRefreshTokenFromRequest = (req: Request): string | undefined => {
  const bodyToken =
    typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : undefined;
  if (bodyToken) {
    return bodyToken;
  }

  const cookies = ((req as unknown as { cookies?: Record<string, unknown> }).cookies ??
    {}) as Record<string, unknown>;

  const cookieToken = cookies[authSessionConfig.refreshTokenCookieName];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  const headerToken = req.get('x-refresh-token');
  if (headerToken && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  return undefined;
};

export const generateTokenPair = (id: string, role: string, options: TokenPairOptions = {}) => {
  const refreshExpiresIn =
    options.refreshExpiresIn ||
    (options.rememberMe ? jwtConfig.refreshPersistentExpiresIn : jwtConfig.refreshExpiresIn);

  return {
    accessToken: generateToken(id, role),
    refreshToken: generateRefreshToken(id, refreshExpiresIn),
    tokenType: 'Bearer',
    expiresIn: jwtConfig.expiresIn,
    refreshExpiresIn,
  };
};

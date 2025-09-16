import jwt, { SignOptions } from 'jsonwebtoken';
import { jwtConfig } from '../../../config/env';
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
export const generateRefreshToken = (id: string): string => {
  const payload: RefreshTokenPayload = {
    id,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.refreshExpiresIn as any,
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
export const generateTokenPair = (id: string, role: string) => {
  return {
    accessToken: generateToken(id, role),
    refreshToken: generateRefreshToken(id),
    tokenType: 'Bearer',
    expiresIn: jwtConfig.expiresIn,
  };
};

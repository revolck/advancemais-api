import { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

import { supabaseConfig } from '@/config/env';
import { prisma } from '@/config/prisma';

/**
 * Cliente JWKS para validação de tokens
 */
const jwksClient = jwksRsa({
  jwksUri: supabaseConfig.jwksUri,
  cache: true,
  rateLimit: true,
});

/**
 * Função auxiliar para obter chave de assinatura
 * @param header - Header do token JWT
 * @param callback - Callback para retorno da chave
 */
function getKey(header: any, callback: any) {
  jwksClient.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

async function verifyToken(token: string): Promise<JwtPayload> {
  return new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(token, getKey, { algorithms: ['RS256', 'ES256', 'HS256'] }, (err, decoded) => {
      if (err) {
        return reject(err);
      }

      if (!decoded || typeof decoded === 'string') {
        return reject(new Error('Token inválido'));
      }

      resolve(decoded as JwtPayload);
    });
  });
}

/**
 * Middleware de autenticação simples (sem verificação de banco)
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const authMiddleware = (roles?: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token de autorização necessário' });
    }

    try {
      const decoded = await verifyToken(token);
      const payload = decoded as JwtPayload & {
        id?: string;
        email?: string;
        role?: string;
        sub?: string;
      };

      const derivedId = payload.id ?? (typeof payload.sub === 'string' ? payload.sub : undefined);
      if (!derivedId || !payload.email || !payload.role) {
        return res.status(401).json({
          message: 'Token inválido ou expirado',
          error: 'Token não contém dados essenciais',
        });
      }

      req.user = {
        ...payload,
        id: derivedId,
        email: payload.email,
        role: payload.role,
      };

      const userRole = payload.role;
      if (roles && userRole && !roles.includes(userRole)) {
        return res.status(403).json({
          message: 'Acesso negado: permissões insuficientes',
        });
      }

      next();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return res.status(401).json({
        message: 'Token inválido ou expirado',
        error: errorMessage,
      });
    }
  };
};

/**
 * Middleware de autenticação completo (com verificação de banco)
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const authMiddlewareWithDB = (roles?: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token de autorização necessário' });
    }

    try {
      const decoded = await verifyToken(token);

      try {
        // Busca usuário no banco usando supabaseId
        const usuario = await prisma.usuario.findUnique({
          where: { supabaseId: decoded.sub },
          select: {
            id: true,
            email: true,
            nomeCompleto: true,
            role: true,
            status: true,
            supabaseId: true,
          },
        });

        if (!usuario) {
          return res.status(401).json({ message: 'Usuário não encontrado no sistema' });
        }

        if (usuario.status !== 'ATIVO') {
          return res.status(403).json({
            message: `Acesso negado: usuário está ${usuario.status.toLowerCase()}`,
          });
        }

        if (roles && !roles.includes(usuario.role)) {
          return res.status(403).json({
            message: 'Acesso negado: permissões insuficientes',
            requiredRoles: roles,
            userRole: usuario.role,
          });
        }

        req.user = {
          ...decoded,
          ...usuario,
        };

        next();
      } catch (error) {
        console.error('Erro no middleware de autenticação:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        return res.status(500).json({
          message: 'Erro interno do servidor',
          error: errorMessage,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return res.status(401).json({
        message: 'Token inválido ou expirado',
        error: errorMessage,
      });
    }
  };
};

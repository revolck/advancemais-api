import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { supabaseConfig, jwtConfig } from '@/config/env';
import { getCache, setCache } from '@/utils/cache';
import { logger } from '@/utils/logger';
import { mergeUsuarioInformacoes } from '@/modules/usuarios/utils/information';

// JWKS client para validação de tokens Supabase
const jwksClient = jwksRsa({
  jwksUri: supabaseConfig.jwksUri,
  cache: true,
  rateLimit: true,
});

const optionalAuthLogger = logger.child({ module: 'OptionalSupabaseAuth' });

function getKey(header: any, callback: any) {
  if (header.alg === 'HS256') {
    return callback(null, jwtConfig.secret);
  }

  jwksClient.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    }
  });
}

/**
 * Middleware de autenticação opcional.
 * - Se não houver token: segue sem autenticar (req.user permanece indefinido)
 * - Se houver token e for válido: popula req.user com dados do banco
 * - Se houver token e for inválido: responde 401
 */
export const optionalSupabaseAuth =
  () => async (req: Request, res: Response, next: NextFunction) => {
    const log = optionalAuthLogger.child({
      path: req.originalUrl,
      method: req.method,
      correlationId: req.id,
    });
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (!token) {
      return next();
    }

    jwt.verify(
      token,
      getKey,
      { algorithms: ['RS256', 'ES256', 'HS256'] },
      async (err: any, decoded: any) => {
        if (err) {
          return res.status(401).json({
            message: 'Token inválido ou expirado',
            error: err.message,
          });
        }

        try {
          const cacheKey = `user:${decoded.sub}`;

          const usuarioSelect = {
            id: true,
            email: true,
            nomeCompleto: true,
            cpf: true,
            cnpj: true,
            role: true,
            status: true,
            tipoUsuario: true,
            supabaseId: true,
            ultimoLogin: true,
            UsuariosInformation: {
              select: { telefone: true },
            },
          } as const;

          type UsuarioSelect = Prisma.UsuariosGetPayload<{
            select: typeof usuarioSelect;
          }>;

          type UsuarioCache = Omit<UsuarioSelect, 'informacoes'> & {
            telefone: string | null;
          };

          let usuario: UsuarioCache | null = await getCache<UsuarioCache>(cacheKey);

          if (!usuario) {
            const usuarioDb = await prisma.usuarios.findFirst({
              where: {
                OR: [{ supabaseId: decoded.sub as string }, { id: decoded.sub as string }],
              },
              select: usuarioSelect,
            });

            if (usuarioDb) {
              const merged = mergeUsuarioInformacoes(usuarioDb);
              const { informacoes, ...rest } = merged;
              usuario = {
                ...rest,
                telefone: informacoes?.telefone ?? null,
              };
              await setCache(cacheKey, usuario, 300);
            }
          }

          if (!usuario) {
            return res.status(401).json({ message: 'Usuário não encontrado no sistema' });
          }

          if (usuario.status !== 'ATIVO') {
            return res.status(403).json({
              message: `Acesso negado: usuário está ${usuario.status.toLowerCase()}`,
            });
          }

          req.user = {
            ...decoded,
            ...usuario,
          };

          next();
        } catch (error) {
          log.error({ err: error }, 'Erro na autenticação opcional');
          return res.status(500).json({
            message: 'Erro interno do servidor',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
        }
      },
    );
  };

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { supabaseConfig, jwtConfig } from '../../../config/env';
import { getCache, setCache } from '../../../utils/cache';
import { logger } from '../../../utils/logger';

/**
 * Cliente JWKS para validação de tokens Supabase
 * Cache habilitado para melhor performance
 */
const jwksClient = jwksRsa({
  jwksUri: supabaseConfig.jwksUri,
  cache: true,
  rateLimit: true,
});

const supabaseAuthLogger = logger.child({ module: 'SupabaseAuthMiddleware' });

/**
 * Função para obter chave pública do JWKS
 * @param header - Header do JWT
 * @param callback - Callback para retornar a chave
 */
function getKey(header: any, callback: any) {
  // Tokens assinados com HS256 usam segredo local em vez de JWKS
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
 * Middleware de autenticação Supabase
 * Valida tokens JWT e verifica permissões baseadas em roles
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const supabaseAuthMiddleware =
  (roles?: string[]) => async (req: Request, res: Response, next: NextFunction) => {
    const log = supabaseAuthLogger.child({
      correlationId: req.id,
      path: req.originalUrl,
      method: req.method,
    });

    // Timeout para evitar loops infinitos (aumentado para 15s devido ao pool de conexões)
    const authTimeout = setTimeout(() => {
      if (!res.headersSent) {
        log.warn('Timeout na autenticação - requisição demorou mais de 15 segundos');
        return res.status(408).json({
          success: false,
          message: 'Timeout na autenticação. Tente novamente.',
          code: 'AUTH_TIMEOUT',
        });
      }
    }, 15000);

    try {
      if (req.originalUrl.startsWith('/docs/login')) {
        clearTimeout(authTimeout);
        return next();
      }

      const isDocsRoute = (url: string) =>
        (url.startsWith('/docs') && !url.startsWith('/docs/login')) || url.startsWith('/redoc');

      const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

      if (!token) {
        clearTimeout(authTimeout);
        if (isDocsRoute(req.originalUrl)) {
          return res.redirect(`/docs/login?redirect=${encodeURIComponent(req.originalUrl)}`);
        }
        return res.status(401).json({
          success: false,
          message: 'Token de autorização necessário',
          code: 'MISSING_TOKEN',
        });
      }

      jwt.verify(
        token,
        getKey,
        { algorithms: ['RS256', 'ES256', 'HS256'] },
        async (err: any, decoded: any) => {
          if (err) {
            clearTimeout(authTimeout);
            if (isDocsRoute(req.originalUrl)) {
              res.clearCookie('token');
              return res.redirect(`/docs/login?redirect=${encodeURIComponent(req.originalUrl)}`);
            }

            return res.status(401).json({
              success: false,
              message: 'Token inválido ou expirado',
              error: err.message,
              code: 'INVALID_TOKEN',
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
              // Não inclui senha por segurança
            } as const;

            type UsuarioSelect = Prisma.UsuariosGetPayload<{
              select: typeof usuarioSelect;
            }>;

            type UsuarioCache = Omit<UsuarioSelect, 'UsuariosInformation'> & {
              telefone: string | null;
            };

            let usuario: UsuarioCache | null = await getCache<UsuarioCache>(cacheKey);

            if (!usuario) {
              try {
                const usuarioDb = await prisma.usuarios.findFirst({
                  where: {
                    OR: [{ supabaseId: decoded.sub as string }, { id: decoded.sub as string }],
                  },
                  select: usuarioSelect,
                });

                if (usuarioDb) {
                  const { UsuariosInformation, ...rest } = usuarioDb;
                  usuario = {
                    ...rest,
                    telefone: UsuariosInformation?.telefone ?? null,
                  };
                  await setCache(cacheKey, usuario, 300);
                }
              } catch (dbError: any) {
                // 🔄 Se for erro de conexão, retornar erro temporário (não crashar)
                if (
                  dbError?.code === 'P1001' ||
                  dbError?.code === 'P2024' ||
                  dbError?.message?.includes('database server') ||
                  dbError?.message?.includes('connection')
                ) {
                  logger.warn(
                    {
                      error: dbError?.message,
                      code: dbError?.code,
                      userId: decoded.sub,
                    },
                    '⚠️ Erro de conexão ao buscar usuário (será retentado)',
                  );

                  return res.status(503).json({
                    success: false,
                    message:
                      'Serviço temporariamente indisponível. Tente novamente em alguns segundos.',
                    code: 'DATABASE_UNAVAILABLE',
                  });
                }

                // Se não for erro de conexão, re-lançar
                throw dbError;
              }
            }

            if (!usuario) {
              clearTimeout(authTimeout);
              return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado no sistema',
                code: 'USER_NOT_FOUND',
              });
            }

            // Verifica se o usuário está ativo
            if (usuario.status !== 'ATIVO') {
              clearTimeout(authTimeout);
              return res.status(403).json({
                success: false,
                message: `Acesso negado: usuário está ${usuario.status.toLowerCase()}`,
                code: 'USER_INACTIVE',
              });
            }

            // Verifica permissões de role se especificadas
            if (roles && !roles.includes(usuario.role)) {
              clearTimeout(authTimeout);
              return res.status(403).json({
                success: false,
                message: 'Acesso negado: permissões insuficientes',
                requiredRoles: roles,
                userRole: usuario.role,
                code: 'INSUFFICIENT_PERMISSIONS',
              });
            }

            // Adiciona informações do usuário à requisição
            req.user = {
              ...decoded,
              ...usuario,
            };

            clearTimeout(authTimeout);
            next();
          } catch (error) {
            clearTimeout(authTimeout);
            log.error({ err: error }, 'Erro no middleware de autenticação');
            // Verifica se headers já foram enviados (ex: por timeout)
            if (!res.headersSent) {
              return res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                code: 'INTERNAL_ERROR',
              });
            }
          }
        },
      );
    } catch (error) {
      clearTimeout(authTimeout);
      log.error({ err: error }, 'Erro no middleware de autenticação (try/catch externo)');
      // Verifica se headers já foram enviados (ex: por timeout)
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Erro interno do servidor',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  };

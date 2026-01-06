import { Request, Response, NextFunction } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { jwtConfig } from '@/config/env';
import { getCache, setCache } from '@/utils/cache';
import { logger } from '@/utils/logger';

const authLogger = logger.child({ module: 'JWTAuthMiddleware' });

/**
 * Middleware de autenticação genérico usando JWT
 * Não depende de Supabase - usa JWT_SECRET diretamente
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const jwtAuthMiddleware =
  (roles?: string[]) => async (req: Request, res: Response, next: NextFunction) => {
    const log = authLogger.child({
      correlationId: req.id,
      path: req.originalUrl,
      method: req.method,
    });

    // Timeout para evitar loops infinitos
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

      // Verificar token usando JWT_SECRET (HS256)
      let decoded: JwtPayload & { sub?: string; id?: string; userId?: string };

      try {
        decoded = jwt.verify(token, jwtConfig.secret, {
          algorithms: ['HS256'],
        }) as JwtPayload & { sub?: string; id?: string; userId?: string };
      } catch (err: any) {
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
        // Obter ID do usuário (pode vir de sub, id ou userId)
        const userId = decoded.sub || decoded.id || decoded.userId;
        if (!userId) {
          clearTimeout(authTimeout);
          return res.status(401).json({
            success: false,
            message: 'Token inválido: ID de usuário não encontrado',
            code: 'INVALID_TOKEN',
          });
        }

        const cacheKey = `user:${userId}`;

        const usuarioSelect = {
          id: true,
          email: true,
          nomeCompleto: true,
          cpf: true,
          cnpj: true,
          role: true,
          status: true,
          tipoUsuario: true,
          authId: true,
          ultimoLogin: true,
          UsuariosInformation: {
            select: { telefone: true },
          },
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
            // Buscar usuário por ID (tokens JWT sempre usam id como subject)
            const usuarioDb = await retryOperation(
              async () => {
                return await prisma.usuarios.findUnique({
                  where: { id: userId },
                  select: usuarioSelect,
                });
              },
              2, // 2 tentativas apenas (fail-fast)
              500, // 500ms delay entre tentativas
              3000, // 3s timeout por tentativa
            );

            if (usuarioDb) {
              const { UsuariosInformation, ...rest } = usuarioDb;
              usuario = {
                ...rest,
                telefone: UsuariosInformation?.telefone ?? null,
              };
              await setCache(cacheKey, usuario, 300);
            }
          } catch (dbError: any) {
            // Se for erro de conexão, retornar erro temporário
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
                  userId,
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
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            code: 'INTERNAL_ERROR',
          });
        }
      }
    } catch (error) {
      clearTimeout(authTimeout);
      log.error({ err: error }, 'Erro no middleware de autenticação (try/catch externo)');
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

/**
 * Middleware de autenticação opcional (JWT genérico)
 * Se não houver token: segue sem autenticar
 * Se houver token e for válido: popula req.user
 */
export const optionalJWTAuth = () => async (req: Request, res: Response, next: NextFunction) => {
  const log = authLogger.child({
    path: req.originalUrl,
    method: req.method,
    correlationId: req.id,
  });

  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      algorithms: ['HS256'],
    }) as JwtPayload & { sub?: string; id?: string; userId?: string };

    const userId = decoded.sub || decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido: ID de usuário não encontrado',
        code: 'INVALID_TOKEN',
      });
    }

    const cacheKey = `user:${userId}`;

    const usuarioSelect = {
      id: true,
      email: true,
      nomeCompleto: true,
      cpf: true,
      cnpj: true,
      role: true,
      status: true,
      tipoUsuario: true,
      authId: true,
      ultimoLogin: true,
      UsuariosInformation: {
        select: { telefone: true },
      },
    } as const;

    type UsuarioSelect = Prisma.UsuariosGetPayload<{
      select: typeof usuarioSelect;
    }>;

    type UsuarioCache = Omit<UsuarioSelect, 'UsuariosInformation'> & {
      telefone: string | null;
    };

    let usuario: UsuarioCache | null = await getCache<UsuarioCache>(cacheKey);

    if (!usuario) {
      const usuarioDb = await prisma.usuarios.findUnique({
        where: { id: userId },
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
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      code: 'INVALID_TOKEN',
    });
  }
};

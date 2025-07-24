import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { prisma } from "../../../config/prisma";

/**
 * Cliente JWKS para validação de tokens Supabase
 * Cache habilitado para melhor performance
 */
const jwksClient = jwksRsa({
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
    "https://mldktbtctxeiufhsspsa.supabase.co/auth/v1/.well-known/jwks.json",
  cache: true,
  rateLimit: true,
});

/**
 * Função para obter chave pública do JWKS
 * @param header - Header do JWT
 * @param callback - Callback para retornar a chave
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

/**
 * Middleware de autenticação Supabase
 * Valida tokens JWT e verifica permissões baseadas em roles
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const supabaseAuthMiddleware =
  (roles?: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Token de autorização necessário" });
    }

    jwt.verify(
      token,
      getKey,
      { algorithms: ["RS256", "ES256", "HS256"] },
      async (err: any, decoded: any) => {
        if (err) {
          return res.status(401).json({
            message: "Token inválido ou expirado",
            error: err.message,
          });
        }

        try {
          // Busca usuário no banco usando supabaseId (agora campo válido)
          const usuario = await prisma.usuario.findUnique({
            where: { supabaseId: decoded.sub },
            select: {
              id: true,
              email: true,
              nomeCompleto: true,
              cpf: true,
              cnpj: true,
              telefone: true,
              role: true,
              status: true,
              tipoUsuario: true,
              supabaseId: true,
              ultimoLogin: true,
              // Não inclui senha por segurança
            },
          });

          if (!usuario) {
            return res
              .status(401)
              .json({ message: "Usuário não encontrado no sistema" });
          }

          // Verifica se o usuário está ativo
          if (usuario.status !== "ATIVO") {
            return res.status(403).json({
              message: `Acesso negado: usuário está ${usuario.status.toLowerCase()}`,
            });
          }

          // Verifica permissões de role se especificadas
          if (roles && !roles.includes(usuario.role)) {
            return res.status(403).json({
              message: "Acesso negado: permissões insuficientes",
              requiredRoles: roles,
              userRole: usuario.role,
            });
          }

          // Adiciona informações do usuário à requisição
          req.user = {
            ...decoded,
            ...usuario,
          };

          next();
        } catch (error) {
          console.error("Erro no middleware de autenticação:", error);
          return res.status(500).json({
            message: "Erro interno do servidor",
            error: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }
    );
  };

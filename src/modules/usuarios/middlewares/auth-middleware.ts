import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { supabaseConfig } from "../../../config/env";

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

/**
 * Middleware de autenticação geral
 * Valida tokens JWT e opcionalmente verifica roles
 * @param roles - Array de roles permitidas (opcional)
 * @returns Middleware function
 */
export const authMiddleware = (roles?: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
      (err: any, decoded: any) => {
        if (err) {
          return res.status(401).json({
            message: "Token inválido ou expirado",
            error: err.message,
          });
        }

        // Adiciona informações decodificadas do token à requisição
        req.user = decoded;

        // Verifica roles se especificadas
        if (roles && decoded.role && !roles.includes(decoded.role)) {
          return res.status(403).json({
            message: "Acesso negado: permissões insuficientes",
          });
        }

        next();
      }
    );
  };
};

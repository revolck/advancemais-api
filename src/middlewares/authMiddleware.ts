import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

const jwksClient = jwksRsa({
  jwksUri:
    "https://mldktbtctxeiufhsspsa.supabase.co/auth/v1/.well-known/jwks.json",
  cache: true,
  rateLimit: true,
});

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

export const authMiddleware =
  (roles?: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token necessário" });

    jwt.verify(
      token,
      getKey,
      { algorithms: ["RS256", "ES256", "HS256"] },
      (err: any, decoded: any) => {
        if (err)
          return res
            .status(401)
            .json({
              message: "Token inválido ou expirado",
              error: err.message,
            });

        // roles: você pode mapear roles usando custom claims no Supabase ou usar o campo 'role' da tabela de usuários
        // req.body.userId = decoded.sub || decoded.user_id; // sub ou user_id, depende do JWT
        req.user = decoded; // para acessar o payload do JWT nas próximas rotas

        next();
      }
    );
  };

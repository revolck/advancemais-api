import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { prisma } from "../../config/prisma"; // ou modules/prisma, depende de onde está seu prisma client

const jwksClient = jwksRsa({
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
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

export const supabaseAuthMiddleware =
  (roles?: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token necessário" });

    jwt.verify(
      token,
      getKey,
      { algorithms: ["RS256", "ES256", "HS256"] },
      async (err: any, decoded: any) => {
        if (err)
          return res.status(401).json({
            message: "Token inválido ou expirado",
            error: err.message,
          });

        // Decoded.sub = user_id do Supabase
        // Busque usuário no banco para pegar CPF/CNPJ/role/etc
        const usuario = await prisma.usuario.findUnique({
          where: { supabaseId: decoded.sub }, // Crie o campo supabaseId na tabela usuario!
        });

        if (!usuario) {
          return res.status(401).json({ message: "Usuário não encontrado" });
        }

        // Verifica role, se necessário
        if (roles && !roles.includes(usuario.role)) {
          return res
            .status(403)
            .json({ message: "Acesso negado: role inválida" });
        }

        req.user = {
          ...decoded,
          ...usuario, // agora você tem tudo: email, cpf, cnpj, roles, etc
        };

        next();
      }
    );
  };

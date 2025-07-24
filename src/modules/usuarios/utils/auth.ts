import jwt from "jsonwebtoken";

/**
 * Gera token JWT de acesso para autenticação
 * @param id - ID único do usuário
 * @param role - Função/papel do usuário no sistema
 * @returns Token JWT válido por 1 hora
 */
export const generateToken = (id: string, role: string): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado nas variáveis de ambiente");
  }

  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

/**
 * Gera refresh token para renovação de sessão
 * @param id - ID único do usuário
 * @returns Refresh token válido por 7 dias
 */
export const generateRefreshToken = (id: string): string => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_REFRESH_SECRET não configurado nas variáveis de ambiente"
    );
  }

  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

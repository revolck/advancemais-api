import dotenv from "dotenv";

// Carrega .env silenciosamente
dotenv.config({ debug: false });

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(
    `Variáveis obrigatórias não encontradas: ${missingVars.join(", ")}`
  );
}

export const supabaseConfig = {
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!,
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
    `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
} as const;

export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  expiresIn: (process.env.JWT_EXPIRATION || "1h") as
    | "1h"
    | "15m"
    | "30m"
    | "2h",
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRATION || "30d") as
    | "1d"
    | "7d"
    | "30d",
} as const;

export const serverConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
} as const;

export const databaseConfig = {
  url: process.env.DATABASE_URL!,
  directUrl: process.env.DIRECT_URL!,
} as const;

export const isDevelopment = serverConfig.nodeEnv === "development";
export const isProduction = serverConfig.nodeEnv === "production";

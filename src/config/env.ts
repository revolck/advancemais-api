import dotenv from "dotenv";

// Carrega as variáveis de ambiente o mais cedo possível
dotenv.config();

/**
 * Configurações de ambiente centralizadas
 * Valida e exporta todas as variáveis necessárias
 */

// Validação de variáveis obrigatórias
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "BREVO_API_KEY",
];

// Adicionar variáveis do MercadoPago
const mercadoPagoRequiredVars = [
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_PUBLIC_KEY",
];

// Combinar todas as variáveis obrigatórias
const allRequiredVars = [...requiredEnvVars, ...mercadoPagoRequiredVars];

// Verifica se todas as variáveis obrigatórias estão definidas
const missingVars = allRequiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(
    `⚠️  Variáveis de ambiente não encontradas: ${missingVars.join(", ")}`
  );
  console.warn("⚠️  Alguns módulos podem não funcionar corretamente");
}

/**
 * Configurações do Supabase
 */
export const supabaseConfig = {
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!,
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
    `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
} as const;

/**
 * Configurações JWT
 * Tipos compatíveis com a biblioteca jsonwebtoken
 */
export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  expiresIn: (process.env.JWT_EXPIRATION || "1h") as
    | "1h"
    | "15m"
    | "30m"
    | "2h"
    | "12h"
    | "24h"
    | "7d"
    | "30d",
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRATION || "30d") as
    | "1d"
    | "7d"
    | "30d"
    | "90d",
} as const;

/**
 * Configurações do servidor
 */
export const serverConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
} as const;

/**
 * Configurações do banco de dados
 */
export const databaseConfig = {
  url: process.env.DATABASE_URL!,
  directUrl: process.env.DIRECT_URL!,
} as const;

/**
 * Configurações do Brevo
 */
export const brevoConfig = {
  apiKey: process.env.BREVO_API_KEY!,
  smtpHost: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
  smtpPort: parseInt(process.env.BREVO_SMTP_PORT || "587", 10),
  smtpUser: process.env.BREVO_SMTP_USER || "",
  smtpPassword: process.env.BREVO_SMTP_PASSWORD || "",
  fromEmail: process.env.BREVO_FROM_EMAIL || "noreply@advancemais.com",
  fromName: process.env.BREVO_FROM_NAME || "AdvanceMais",
  // Configurações específicas para recuperação de senha
  passwordRecovery: {
    tokenExpirationMinutes: parseInt(
      process.env.PASSWORD_RECOVERY_EXPIRATION_MINUTES || "30",
      10
    ),
    maxAttempts: parseInt(
      process.env.PASSWORD_RECOVERY_MAX_ATTEMPTS || "3",
      10
    ),
    cooldownMinutes: parseInt(
      process.env.PASSWORD_RECOVERY_COOLDOWN_MINUTES || "15",
      10
    ),
  },
} as const;

/**
 * Configurações do MercadoPago
 */
export const mercadoPagoConfig = {
  // Chaves de API do MercadoPago
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || "",

  // Ambiente (sandbox ou production)
  environment: process.env.MERCADOPAGO_ENVIRONMENT || "sandbox",

  // Secret para validação de webhooks (opcional mas recomendado)
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || "",

  // Configurações de timeout e retry
  timeout: parseInt(process.env.MERCLADOPAGO_TIMEOUT || "5000", 10),
  retryAttempts: parseInt(process.env.MERCADOPAGO_RETRY_ATTEMPTS || "3", 10),

  // IDs opcionais para integração avançada
  integratorId: process.env.MERCADOPAGO_INTEGRATOR_ID || "",
  platformId: process.env.MERCADOPAGO_PLATFORM_ID || "",
  corporationId: process.env.MERCADOPAGO_CORPORATION_ID || "",

  // Configurações de notificação
  notificationUrl: process.env.MERCADOPAGO_NOTIFICATION_URL || "",

  // Configurações de experiência do usuário
  locale: process.env.MERCADOPAGO_LOCALE || "pt-BR",

  // Configurações de processamento
  defaultProcessingMode:
    process.env.MERCADOPAGO_DEFAULT_PROCESSING_MODE || "automatic",
  defaultCurrency: process.env.MERCADOPAGO_DEFAULT_CURRENCY || "BRL",

  // Configurações de reembolso
  refundConfig: {
    allowPartialRefunds:
      process.env.MERCADOPAGO_ALLOW_PARTIAL_REFUNDS === "true",
    maxRefundDays: parseInt(
      process.env.MERCADOPAGO_MAX_REFUND_DAYS || "180",
      10
    ),
    autoRefundOnCancel:
      process.env.MERCADOPAGO_AUTO_REFUND_ON_CANCEL === "true",
  },

  // Configurações de assinatura
  subscriptionConfig: {
    maxFrequencyDays: parseInt(
      process.env.MERCADOPAGO_MAX_FREQUENCY_DAYS || "365",
      10
    ),
    allowFreeTrials: process.env.MERCADOPAGO_ALLOW_FREE_TRIALS === "true",
    defaultFrequencyType:
      process.env.MERCADOPAGO_DEFAULT_FREQUENCY_TYPE || "months",
  },
} as const;

/**
 * Configurações de rate limiting
 */
export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutos
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10), // 100 requests por janela
} as const;

/**
 * Configurações de upload
 */
export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB
  allowedMimeTypes: (
    process.env.ALLOWED_MIME_TYPES ||
    "image/jpeg,image/png,image/gif,application/pdf"
  ).split(","),
} as const;

/**
 * Verifica se está em ambiente de desenvolvimento
 */
export const isDevelopment = serverConfig.nodeEnv === "development";

/**
 * Verifica se está em ambiente de produção
 */
export const isProduction = serverConfig.nodeEnv === "production";

/**
 * Verifica se está em ambiente de teste
 */
export const isTest = serverConfig.nodeEnv === "test";

/**
 * Configurações de logging
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  enableConsole: process.env.ENABLE_CONSOLE_LOG !== "false",
  enableFile: process.env.ENABLE_FILE_LOG === "true",
} as const;

/**
 * Configurações de segurança
 */
export const securityConfig = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  sessionSecret:
    process.env.SESSION_SECRET || "default-session-secret-change-in-production",
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || "86400000", 10), // 24 horas
} as const;

/**
 * Validação específica para produção do MercadoPago
 */
export const validateMercadoPagoProductionConfig = (): void => {
  if (isProduction) {
    // Verifica se não está usando chaves de teste em produção
    if (mercadoPagoConfig.accessToken.includes("TEST")) {
      throw new Error('ACCESS_TOKEN de produção não deve conter "TEST"');
    }

    if (mercadoPagoConfig.publicKey.includes("TEST")) {
      throw new Error('PUBLIC_KEY de produção não deve conter "TEST"');
    }

    // Verifica se o ambiente está correto
    if (mercadoPagoConfig.environment !== "production") {
      throw new Error(
        'MERCADOPAGO_ENVIRONMENT deve ser "production" em ambiente de produção'
      );
    }

    // Verifica se o webhook secret está configurado
    if (!mercadoPagoConfig.webhookSecret) {
      console.warn(
        "⚠️  MERCADOPAGO_WEBHOOK_SECRET não configurado - webhooks não serão validados"
      );
    }

    // Verifica se a URL de notificação está configurada
    if (!mercadoPagoConfig.notificationUrl) {
      console.warn(
        "⚠️  MERCADOPAGO_NOTIFICATION_URL não configurado - webhooks podem não funcionar"
      );
    }
  }
};

/**
 * Helper para validar configurações críticas em produção
 */
export const validateProductionConfig = (): void => {
  if (isProduction) {
    const productionRequiredVars = [
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "SESSION_SECRET",
      "BREVO_API_KEY",
    ];

    const missingProductionVars = productionRequiredVars.filter(
      (varName) =>
        !process.env[varName] ||
        process.env[varName] === "default-session-secret-change-in-production"
    );

    if (missingProductionVars.length > 0) {
      throw new Error(
        `Configurações críticas para produção não encontradas ou usando valores padrão: ${missingProductionVars.join(
          ", "
        )}`
      );
    }

    // Verifica se as chaves têm tamanho mínimo
    if (jwtConfig.secret.length < 32) {
      throw new Error(
        "JWT_SECRET deve ter pelo menos 32 caracteres em produção"
      );
    }

    if (jwtConfig.refreshSecret.length < 32) {
      throw new Error(
        "JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres em produção"
      );
    }

    // Executa validação do MercadoPago
    validateMercadoPagoProductionConfig();
  }
};

/**
 * Executa validação de produção se necessário
 */
if (isProduction) {
  try {
    validateProductionConfig();
  } catch (error) {
    console.error("❌ Erro na configuração:", error);
    process.exit(1);
  }
}

/**
 * Log das configurações carregadas (sem dados sensíveis)
 */
if (isDevelopment) {
  console.log("🔧 Configurações carregadas:", {
    nodeEnv: serverConfig.nodeEnv,
    port: serverConfig.port,
    supabaseUrl: supabaseConfig.url ? "✅ Configurado" : "❌ Não configurado",
    databaseUrl: databaseConfig.url ? "✅ Configurado" : "❌ Não configurado",
    jwtConfigured: jwtConfig.secret ? "✅ Configurado" : "❌ Não configurado",
    brevoConfigured: brevoConfig.apiKey
      ? "✅ Configurado"
      : "❌ Não configurado",
    mercadoPagoConfigured: mercadoPagoConfig.accessToken
      ? "✅ Configurado"
      : "❌ Não configurado",
  });

  console.log("🏦 Configurações do MercadoPago:", {
    environment: mercadoPagoConfig.environment,
    locale: mercadoPagoConfig.locale,
    accessTokenConfigured: mercadoPagoConfig.accessToken
      ? "✅ Configurado"
      : "❌ Não configurado",
    publicKeyConfigured: mercadoPagoConfig.publicKey
      ? "✅ Configurado"
      : "❌ Não configurado",
    webhookSecretConfigured: mercadoPagoConfig.webhookSecret
      ? "✅ Configurado"
      : "❌ Não configurado",
    notificationUrlConfigured: mercadoPagoConfig.notificationUrl
      ? "✅ Configurado"
      : "❌ Não configurado",
    timeout: mercadoPagoConfig.timeout,
    defaultCurrency: mercadoPagoConfig.defaultCurrency,
    defaultProcessingMode: mercadoPagoConfig.defaultProcessingMode,
  });
}

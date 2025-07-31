import dotenv from "dotenv";

// Carrega as variáveis de ambiente o mais cedo possível
dotenv.config();

/**
 * Configurações de ambiente centralizadas e validadas
 * Inclui todas as configurações necessárias para o sistema AdvanceMais
 *
 * Módulos configurados:
 * - Supabase (Autenticação e Banco)
 * - JWT (Tokens de acesso)
 * - Brevo (Email e SMS) - ATUALIZADO
 * - MercadoPago (Pagamentos)
 * - Servidor e Segurança
 *
 * @author Sistema AdvanceMais
 * @version 2.1.0
 */

// =============================================
// VALIDAÇÃO DE VARIÁVEIS OBRIGATÓRIAS
// =============================================

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

// Variáveis específicas do Brevo (atualizadas)
const brevoRequiredVars = ["BREVO_API_KEY"];

// Variáveis do MercadoPago
const mercadoPagoRequiredVars = [
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_PUBLIC_KEY",
];

// Combinar todas as variáveis obrigatórias
const allRequiredVars = [
  ...requiredEnvVars,
  ...brevoRequiredVars,
  ...mercadoPagoRequiredVars,
];

// Verifica variáveis obrigatórias
const missingVars = allRequiredVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  console.warn(
    `⚠️  Variáveis de ambiente não encontradas: ${missingVars.join(", ")}`
  );
  console.warn("⚠️  Alguns módulos podem não funcionar corretamente");
}

// =============================================
// CONFIGURAÇÕES DO SUPABASE
// =============================================

/**
 * Configurações do Supabase para autenticação e banco de dados
 */
export const supabaseConfig = {
  url: process.env.SUPABASE_URL!,
  key: process.env.SUPABASE_KEY!,
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
    `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
} as const;

// =============================================
// CONFIGURAÇÕES JWT
// =============================================

/**
 * Configurações JWT para tokens de acesso e refresh
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

// =============================================
// CONFIGURAÇÕES DO SERVIDOR
// =============================================

/**
 * Configurações gerais do servidor Express
 */
export const serverConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "*",
} as const;

// =============================================
// CONFIGURAÇÕES DO BANCO DE DADOS
// =============================================

/**
 * Configurações de conexão com PostgreSQL via Prisma
 */
export const databaseConfig = {
  url: process.env.DATABASE_URL!,
  directUrl: process.env.DIRECT_URL!,
} as const;

// =============================================
// CONFIGURAÇÕES DO BREVO (ATUALIZADO)
// =============================================

/**
 * Configurações do Brevo (ex-Sendinblue) para email e SMS
 *
 * Credenciais atualizadas:
 * - API Key: 851JKC36h92VRfbk
 * - SMTP Server: smtp-relay.brevo.com:587
 * - SMTP User: 93713f002@smtp-brevo.com
 * - SMTP Pass: 8G2CrnFRt4EpNUbs
 */
export const brevoConfig = {
  // API Key principal para todas as operações
  apiKey: process.env.BREVO_API_KEY || "851JKC36h92VRfbk",

  // Configurações de remetente para emails
  fromEmail: process.env.BREVO_FROM_EMAIL || "noreply@advancemais.com",
  fromName: process.env.BREVO_FROM_NAME || "AdvanceMais",

  // Configurações SMTP (backup/alternativa)
  smtp: {
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.BREVO_SMTP_PORT || "587", 10),
    secure: false, // true para 465, false para 587
    auth: {
      user: process.env.BREVO_SMTP_USER || "93713f002@smtp-brevo.com",
      pass: process.env.BREVO_SMTP_PASSWORD || "8G2CrnFRt4EpNUbs",
    },
    // Configurações adicionais do Postfix
    connectionTimeout: 60000, // 60 segundos
    greetingTimeout: 30000, // 30 segundos
    socketTimeout: 60000, // 60 segundos
  },

  // URLs da API Brevo
  apiUrls: {
    base: "https://api.brevo.com/v3",
    email: "https://api.brevo.com/v3/smtp/email",
    sms: "https://api.brevo.com/v3/transactionalSMS",
    account: "https://api.brevo.com/v3/account",
  },

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

  // Configurações de envio
  sending: {
    maxRetries: parseInt(process.env.BREVO_MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.BREVO_RETRY_DELAY || "1000", 10),
    timeout: parseInt(process.env.BREVO_TIMEOUT || "30000", 10), // 30 segundos

    // Limites diários (ajuste conforme seu plano Brevo)
    dailyEmailLimit: parseInt(
      process.env.BREVO_DAILY_EMAIL_LIMIT || "10000",
      10
    ),
    dailySMSLimit: parseInt(process.env.BREVO_DAILY_SMS_LIMIT || "1000", 10),

    // Configurações de SMS
    defaultSMSSender: process.env.BREVO_SMS_SENDER || "AdvanceMais",
    smsUnicodeEnabled: process.env.BREVO_SMS_UNICODE === "true",
  },

  // Configurações de template
  templates: {
    cacheEnabled: process.env.BREVO_TEMPLATE_CACHE !== "false",
    preloadOnStart: process.env.BREVO_PRELOAD_TEMPLATES !== "false",
    customTemplateDir: process.env.BREVO_CUSTOM_TEMPLATE_DIR || "",
  },
} as const;

// =============================================
// CONFIGURAÇÕES DO MERCADOPAGO
// =============================================

/**
 * Configurações do MercadoPago para pagamentos
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
  timeout: parseInt(process.env.MERCADOPAGO_TIMEOUT || "5000", 10),
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

// =============================================
// CONFIGURAÇÕES DE RATE LIMITING
// =============================================

/**
 * Configurações para controle de taxa de requisições
 */
export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutos
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10), // 100 requests por janela
} as const;

// =============================================
// CONFIGURAÇÕES DE UPLOAD
// =============================================

/**
 * Configurações para upload de arquivos
 */
export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB
  allowedMimeTypes: (
    process.env.ALLOWED_MIME_TYPES ||
    "image/jpeg,image/png,image/gif,application/pdf"
  ).split(","),
} as const;

// =============================================
// CONFIGURAÇÕES DE AMBIENTE
// =============================================

/**
 * Helpers para verificar ambiente atual
 */
export const isDevelopment = serverConfig.nodeEnv === "development";
export const isProduction = serverConfig.nodeEnv === "production";
export const isTest = serverConfig.nodeEnv === "test";

// =============================================
// CONFIGURAÇÕES DE LOGGING
// =============================================

/**
 * Configurações de sistema de logs
 */
export const logConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  enableConsole: process.env.ENABLE_CONSOLE_LOG !== "false",
  enableFile: process.env.ENABLE_FILE_LOG === "true",
} as const;

// =============================================
// CONFIGURAÇÕES DE SEGURANÇA
// =============================================

/**
 * Configurações de segurança da aplicação
 */
export const securityConfig = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  sessionSecret:
    process.env.SESSION_SECRET || "default-session-secret-change-in-production",
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || "86400000", 10), // 24 horas
} as const;

// =============================================
// VALIDAÇÕES ESPECÍFICAS PARA PRODUÇÃO
// =============================================

/**
 * Validação específica para produção do Brevo
 */
export const validateBrevoProductionConfig = (): void => {
  if (isProduction) {
    // Verifica se a API key não está usando valor padrão em produção
    if (!process.env.BREVO_API_KEY) {
      console.warn("⚠️  BREVO_API_KEY não configurada - usando valor padrão");
    }

    // Verifica configurações de email
    if (!brevoConfig.fromEmail.includes("@")) {
      throw new Error("BREVO_FROM_EMAIL deve ser um email válido em produção");
    }

    // Verifica se não está usando credenciais de desenvolvimento
    if (
      brevoConfig.fromEmail.includes("test") ||
      brevoConfig.fromEmail.includes("dev")
    ) {
      console.warn(
        "⚠️  Email remetente parece ser de desenvolvimento em produção"
      );
    }

    console.log("✅ Configuração do Brevo validada para produção");
  }
};

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

    // Executa validações específicas dos módulos
    validateBrevoProductionConfig();
    validateMercadoPagoProductionConfig();
  }
};

// =============================================
// EXECUÇÃO DE VALIDAÇÕES
// =============================================

/**
 * Executa validação de produção se necessário
 */
if (isProduction) {
  try {
    validateProductionConfig();
    console.log("✅ Todas as configurações de produção validadas com sucesso");
  } catch (error) {
    console.error("❌ Erro na configuração:", error);
    process.exit(1);
  }
}

// =============================================
// LOGS DE CONFIGURAÇÃO (DESENVOLVIMENTO)
// =============================================

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

  console.log("📧 Configurações do Brevo:", {
    apiKey: brevoConfig.apiKey
      ? `${brevoConfig.apiKey.substring(0, 8)}...`
      : "❌ Não configurado",
    fromEmail: brevoConfig.fromEmail,
    fromName: brevoConfig.fromName,
    smtpHost: brevoConfig.smtp.host,
    smtpPort: brevoConfig.smtp.port,
    smtpUser: brevoConfig.smtp.auth.user,
    dailyEmailLimit: brevoConfig.sending.dailyEmailLimit,
    dailySMSLimit: brevoConfig.sending.dailySMSLimit,
    maxRetries: brevoConfig.sending.maxRetries,
    templatesEnabled: brevoConfig.templates.cacheEnabled,
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

// =============================================
// EXPORTAÇÕES FINAIS
// =============================================

/**
 * Configuração consolidada para fácil acesso
 */
export const appConfig = {
  server: serverConfig,
  database: databaseConfig,
  supabase: supabaseConfig,
  jwt: jwtConfig,
  brevo: brevoConfig,
  mercadoPago: mercadoPagoConfig,
  security: securityConfig,
  rateLimit: rateLimitConfig,
  upload: uploadConfig,
  log: logConfig,
  environment: {
    isDevelopment,
    isProduction,
    isTest,
    nodeEnv: serverConfig.nodeEnv,
  },
} as const;

export default appConfig;

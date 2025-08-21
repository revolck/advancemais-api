import dotenv from "dotenv";

// Carrega as variáveis de ambiente o mais cedo possível
dotenv.config();

/**
 * Configurações de ambiente centralizadas e validadas
 * Implementa padrões de microserviços para configuração segura
 *
 * Características:
 * - Validação rigorosa de variáveis obrigatórias
 * - Configuração específica por ambiente
 * - Validações de segurança para produção
 * - Logs estruturados de configuração
 * - Fallbacks seguros para desenvolvimento
 *
 * @author Sistema AdvanceMais
 * @version 4.0.0 - Refatoração para microserviços
 */

// =============================================
// CLASSES DE VALIDAÇÃO
// =============================================

class ConfigurationError extends Error {
  constructor(message: string, public missingVars?: string[]) {
    super(message);
    this.name = "ConfigurationError";
  }
}

class EnvironmentValidator {
  /**
   * Valida variáveis obrigatórias com feedback detalhado
   */
  static validateRequired(vars: string[]): {
    isValid: boolean;
    missing: string[];
  } {
    const missing = vars.filter((varName) => !process.env[varName]);
    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Valida formato de URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida formato de email
   */
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Valida se é número válido
   */
  static isValidNumber(value: string, min?: number, max?: number): boolean {
    const num = parseInt(value, 10);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  }
}

// =============================================
// CONFIGURAÇÃO DO AMBIENTE
// =============================================

const NODE_ENV = process.env.NODE_ENV || "development";
const isDevelopment = NODE_ENV === "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

console.log(`🌍 Ambiente: ${NODE_ENV}`);

// =============================================
// VALIDAÇÃO DE VARIÁVEIS CRÍTICAS
// =============================================

// Variáveis obrigatórias para todos os ambientes
const coreRequiredVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

// Validação específica por ambiente
const environmentSpecificVars = {
  production: [
    ...coreRequiredVars,
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "BREVO_API_KEY",
    "MERCADOPAGO_ACCESS_TOKEN",
    "MERCADOPAGO_PUBLIC_KEY",
    "FRONTEND_URL",
  ],
  development: coreRequiredVars,
  test: coreRequiredVars,
};

// Valida variáveis obrigatórias
const requiredVars =
  environmentSpecificVars[NODE_ENV as keyof typeof environmentSpecificVars] ||
  coreRequiredVars;
const validation = EnvironmentValidator.validateRequired(requiredVars);

if (!validation.isValid) {
  const errorMessage = `Variáveis de ambiente obrigatórias não encontradas para ${NODE_ENV}: ${validation.missing.join(
    ", "
  )}`;

  if (isProduction) {
    console.error(`❌ ${errorMessage}`);
    process.exit(1); // Falha crítica em produção
  } else {
    console.warn(`⚠️ ${errorMessage}`);
    console.warn("⚠️ Alguns módulos podem não funcionar corretamente");
  }
}

// =============================================
// CONFIGURAÇÕES DO SUPABASE
// =============================================

export const supabaseConfig = {
  url: process.env.SUPABASE_URL || "",
  key: process.env.SUPABASE_KEY || "",
  jwksUri:
    process.env.SUPABASE_JWKS_URI ||
    `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,

  // Validação da configuração
  isValid(): boolean {
    return !!(
      this.url &&
      this.key &&
      EnvironmentValidator.isValidUrl(this.url)
    );
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.url) issues.push("SUPABASE_URL não configurada");
    if (!this.key) issues.push("SUPABASE_KEY não configurada");
    if (this.url && !EnvironmentValidator.isValidUrl(this.url)) {
      issues.push("SUPABASE_URL tem formato inválido");
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES JWT
// =============================================

export const jwtConfig = {
  secret: process.env.JWT_SECRET || "",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "",
  expiresIn: (process.env.JWT_EXPIRATION || "1h") as string,
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRATION || "30d") as string,

  // Validação da configuração
  isValid(): boolean {
    return (
      !!(this.secret && this.refreshSecret) &&
      this.secret.length >= 32 &&
      this.refreshSecret.length >= 32
    );
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.secret) issues.push("JWT_SECRET não configurado");
    if (!this.refreshSecret) issues.push("JWT_REFRESH_SECRET não configurado");
    if (this.secret && this.secret.length < 32) {
      issues.push("JWT_SECRET deve ter pelo menos 32 caracteres");
    }
    if (this.refreshSecret && this.refreshSecret.length < 32) {
      issues.push("JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres");
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES DO BREVO
// =============================================

export const brevoConfig = {
  // Configurações básicas
  apiKey: process.env.BREVO_API_KEY || "",
  fromEmail: process.env.BREVO_FROM_EMAIL || "noreply@advancemais.com",
  fromName: process.env.BREVO_FROM_NAME || "AdvanceMais",

  // Configurações SMTP (backup)
  smtp: {
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.BREVO_SMTP_PORT || "587", 10),
    secure: false, // true para 465, false para 587
    auth: {
      user: process.env.BREVO_SMTP_USER || "",
      pass: process.env.BREVO_SMTP_PASSWORD || "",
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  },

  // URLs da API
  apiUrls: {
    base: "https://api.brevo.com/v3",
    email: "https://api.brevo.com/v3/smtp/email",
    sms: "https://api.brevo.com/v3/transactionalSMS",
    account: "https://api.brevo.com/v3/account",
  },

  // Configurações de recuperação de senha
  passwordRecovery: {
    tokenExpirationMinutes:
      parseInt(
        process.env.BREVO_PASSWORD_RECOVERY_EXPIRATION_HOURS || "72",
        10
      ) * 60,
    maxAttempts: parseInt(
      process.env.BREVO_PASSWORD_RECOVERY_MAX_ATTEMPTS || "3",
      10
    ),
    cooldownMinutes: parseInt(
      process.env.BREVO_PASSWORD_RECOVERY_COOLDOWN_MINUTES || "15",
      10
    ),
  },

  // Configurações de envio
  sending: {
    maxRetries: parseInt(process.env.BREVO_MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.BREVO_RETRY_DELAY || "1000", 10),
    timeout: parseInt(process.env.BREVO_TIMEOUT || "30000", 10),

    // Limites diários (ajuste conforme seu plano)
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

  // Validação da configuração
  isValid(): boolean {
    return !!(this.apiKey && EnvironmentValidator.isValidEmail(this.fromEmail));
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.apiKey) issues.push("BREVO_API_KEY não configurado");
    if (!EnvironmentValidator.isValidEmail(this.fromEmail)) {
      issues.push("BREVO_FROM_EMAIL deve ser um email válido");
    }

    // Verifica se não está usando credenciais de desenvolvimento em produção
    if (isProduction) {
      if (this.fromEmail.includes("test") || this.fromEmail.includes("dev")) {
        issues.push("Email de produção parece ser de desenvolvimento");
      }
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES DO MERCADOPAGO
// =============================================

export const mercadoPagoConfig = {
  // Chaves de API
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
  publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || "",

  // Ambiente
  environment: process.env.MERCADOPAGO_ENVIRONMENT || "sandbox",

  // Secret para webhooks
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

  // Validação da configuração
  isValid(): boolean {
    return !!(this.accessToken && this.publicKey);
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.accessToken)
      issues.push("MERCADOPAGO_ACCESS_TOKEN não configurado");
    if (!this.publicKey) issues.push("MERCADOPAGO_PUBLIC_KEY não configurado");

    // Validações específicas para produção
    if (isProduction) {
      if (this.accessToken.includes("TEST")) {
        issues.push('Access Token de produção não deve conter "TEST"');
      }
      if (this.publicKey.includes("TEST")) {
        issues.push('Public Key de produção não deve conter "TEST"');
      }
      if (this.environment !== "production") {
        issues.push('Environment deve ser "production" em produção');
      }
      if (!this.webhookSecret) {
        issues.push("MERCADOPAGO_WEBHOOK_SECRET recomendado em produção");
      }
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES DO SERVIDOR
// =============================================

export const serverConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: NODE_ENV,
  corsOrigin: (() => {
    const defaultOrigins = [
      "https://advancemais.com",
      "https://auth.advancemais.com",
      "https://app.advancemais.com",
    ];

    if (process.env.CORS_ORIGIN) {
      const envOrigins = process.env.CORS_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (envOrigins.length > 0) {
        return Array.from(new Set([...envOrigins, ...defaultOrigins]));
      }
    }

    return isDevelopment ? "*" : defaultOrigins;
  })(),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

  // Validação da configuração
  isValid(): boolean {
    return (
      EnvironmentValidator.isValidNumber(this.port.toString(), 1, 65535) &&
      EnvironmentValidator.isValidUrl(this.frontendUrl)
    );
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!EnvironmentValidator.isValidNumber(this.port.toString(), 1, 65535)) {
      issues.push("PORT deve ser um número válido entre 1 e 65535");
    }
    if (!EnvironmentValidator.isValidUrl(this.frontendUrl)) {
      issues.push("FRONTEND_URL deve ser uma URL válida");
    }

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES DE BANCO DE DADOS
// =============================================

export const databaseConfig = {
  // Allow overriding the connection string with an IPv4 friendly version
  url: process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || "",
  directUrl:
    process.env.DIRECT_POOL_URL || process.env.DIRECT_URL || "",

  // Validação da configuração
  isValid(): boolean {
    return !!(this.url && this.directUrl);
  },

  // Status da configuração
  getStatus(): { configured: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.url)
      issues.push("DATABASE_URL/DATABASE_POOL_URL não configurada");
    if (!this.directUrl)
      issues.push("DIRECT_URL/DIRECT_POOL_URL não configurada");

    return {
      configured: issues.length === 0,
      issues,
    };
  },
} as const;

// =============================================
// CONFIGURAÇÕES AUXILIARES
// =============================================

export const securityConfig = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  sessionSecret:
    process.env.SESSION_SECRET || "default-session-secret-change-in-production",
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || "86400000", 10),
} as const;

export const rateLimitConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
} as const;

export const uploadConfig = {
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10),
  allowedMimeTypes: (
    process.env.ALLOWED_MIME_TYPES ||
    "image/jpeg,image/png,image/gif,application/pdf"
  ).split(","),
} as const;

export const logConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  enableConsole: process.env.ENABLE_CONSOLE_LOG !== "false",
  enableFile: process.env.ENABLE_FILE_LOG === "true",
} as const;

// =============================================
// VALIDAÇÃO GERAL DA CONFIGURAÇÃO
// =============================================

/**
 * Classe para validação centralizada de todas as configurações
 */
export class ConfigurationManager {
  /**
   * Valida todas as configurações
   */
  static validateAll(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    modules: Record<string, { configured: boolean; issues: string[] }>;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const modules = {
      server: serverConfig.getStatus(),
      database: databaseConfig.getStatus(),
      supabase: supabaseConfig.getStatus(),
      jwt: jwtConfig.getStatus(),
      brevo: brevoConfig.getStatus(),
      mercadopago: mercadoPagoConfig.getStatus(),
    };

    // Coleta erros e warnings
    Object.entries(modules).forEach(([moduleName, status]) => {
      if (!status.configured) {
        if (["server", "database", "jwt"].includes(moduleName)) {
          errors.push(
            `Módulo crítico ${moduleName}: ${status.issues.join(", ")}`
          );
        } else {
          warnings.push(`Módulo ${moduleName}: ${status.issues.join(", ")}`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      modules,
    };
  }

  /**
   * Executa validação com logs estruturados
   */
  static validateWithLogging(): boolean {
    const result = this.validateAll();

    if (result.errors.length > 0) {
      console.error("❌ Erros críticos de configuração:");
      result.errors.forEach((error) => console.error(`   - ${error}`));

      if (isProduction) {
        console.error(
          "🚨 Aplicação não pode iniciar em produção com erros críticos"
        );
        process.exit(1);
      }
    }

    if (result.warnings.length > 0) {
      console.warn("⚠️ Avisos de configuração:");
      result.warnings.forEach((warning) => console.warn(`   - ${warning}`));
    }

    // Log de módulos configurados
    const configuredModules = Object.entries(result.modules)
      .filter(([_, status]) => status.configured)
      .map(([name]) => name);

    if (configuredModules.length > 0) {
      console.log("✅ Módulos configurados:", configuredModules.join(", "));
    }

    return result.isValid;
  }
}

// =============================================
// HELPERS DE AMBIENTE
// =============================================

export { isDevelopment, isProduction, isTest };

// =============================================
// CONFIGURAÇÃO CONSOLIDADA
// =============================================

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
    nodeEnv: NODE_ENV,
  },
} as const;

// =============================================
// EXECUÇÃO DE VALIDAÇÃO
// =============================================

// Executa validação na inicialização
const isConfigValid = ConfigurationManager.validateWithLogging();

if (isDevelopment && !isConfigValid) {
  console.warn(
    "⚠️ Configuração incompleta - alguns recursos podem não funcionar"
  );
}

export default appConfig;

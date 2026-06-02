import MercadoPagoConfig from 'mercadopago';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { parseScheduleConfig } from '@/utils/cron-helpers';
import { logger } from '@/utils/logger';
import {
  CONFIG_CATEGORIES,
  CONFIG_DEFINITIONS,
  getDefinition,
  getDefinitionsByCategory,
  type ConfigCategory,
  type ConfigDefinition,
  type ConfigSource,
} from '../catalog';
import { decryptSecret, fingerprintSecret, maskSecretPreview } from '../utils/config-crypto';
import {
  firstEnvValue,
  getEnvSource,
  normalizeConfigValue,
  parseEnvValue,
} from '../utils/config-normalizers';

const CACHE_TTL_MS = 30_000;

interface ConfigRow {
  categoria: string;
  chave: string;
  tipo: string;
  valor: Prisma.JsonValue | null;
  valorCriptografado: string | null;
  valorHash: string | null;
  ehSecreto: boolean;
  atualizadoEm: Date;
}

export type MercadoPagoMode = 'production' | 'test';

type MercadoPagoCredentialKey =
  | 'mp_public_key'
  | 'mp_access_token'
  | 'mp_test_public_key'
  | 'mp_test_access_token';

type MercadoPagoValidationResult = {
  activeMode: MercadoPagoMode;
  missingKeys: MercadoPagoCredentialKey[];
  publicKey: string;
  accessToken: string;
};

type CursoInstallmentsConfig = {
  enabled: boolean;
  maxInstallments: number;
};

export interface ResolvedConfigItem {
  key: string;
  label: string;
  type: ConfigDefinition['type'];
  secret: boolean;
  value: string | number | boolean | null;
  configured: boolean;
  source: ConfigSource;
  envKeys: string[];
  envSource: string | null;
  fingerprint: string | null;
  maskedPreview: string | null;
  restartRequired: boolean;
  description: string | null;
  updatedAt: string | null;
  required: boolean;
}

export interface RuntimeConfigCategoryResponse {
  category: ConfigCategory;
  label: string;
  description: string;
  items: ResolvedConfigItem[];
}

class RuntimeConfigService {
  private cache: { expiresAt: number; rows: Map<string, ConfigRow> } | null = null;
  private mpClientCache: { token: string; client: MercadoPagoConfig } | null = null;
  private pendingRowsPromise: Promise<Map<string, ConfigRow>> | null = null;
  private readonly log = logger.child({ module: 'RuntimeConfigService' });

  invalidate(): void {
    this.cache = null;
    this.mpClientCache = null;
  }

  async listAll(): Promise<RuntimeConfigCategoryResponse[]> {
    const rows = await this.getRowsMap();
    const categories = CONFIG_CATEGORIES.map((categoryMeta) => ({
      ...categoryMeta,
      items: getDefinitionsByCategory(categoryMeta.category).map((definition) =>
        this.resolvePublicItem(
          definition,
          rows.get(this.cacheKey(definition.category, definition.key)),
        ),
      ),
    }));

    return Promise.all(categories.map((category) => this.patchDerivedCategoryData(category)));
  }

  async listCategory(category: ConfigCategory): Promise<RuntimeConfigCategoryResponse> {
    const meta = CONFIG_CATEGORIES.find((item) => item.category === category);
    if (!meta) {
      throw Object.assign(new Error('Categoria de configuração inválida'), {
        code: 'INVALID_CONFIG_CATEGORY',
        statusCode: 400,
      });
    }

    const rows = await this.getRowsMap();
    const response = {
      ...meta,
      items: getDefinitionsByCategory(category).map((definition) =>
        this.resolvePublicItem(definition, rows.get(this.cacheKey(category, definition.key))),
      ),
    };

    return this.patchDerivedCategoryData(response);
  }

  async getRawValue(category: ConfigCategory, key: string): Promise<string> {
    const definition = getDefinition(category, key);
    if (!definition) return '';

    const rows = await this.getRowsMap();
    const row = rows.get(this.cacheKey(category, key));

    if (definition.secret) {
      if (row?.valorCriptografado) {
        return decryptSecret(row.valorCriptografado);
      }
      return firstEnvValue(definition.envKeys) ?? String(definition.defaultValue ?? '');
    }

    if (row?.valor !== undefined && row?.valor !== null) {
      return String(normalizeConfigValue(definition, row.valor));
    }

    const parsedEnv = parseEnvValue(definition);
    return parsedEnv === undefined ? '' : String(parsedEnv);
  }

  async getString(category: ConfigCategory, key: string): Promise<string> {
    return this.getRawValue(category, key);
  }

  async getNumber(category: ConfigCategory, key: string, fallback = 0): Promise<number> {
    const raw = await this.getRawValue(category, key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async getBoolean(category: ConfigCategory, key: string, fallback = false): Promise<boolean> {
    const raw = await this.getRawValue(category, key);
    if (!raw) return fallback;
    const normalized = String(raw).toLowerCase();
    if (['true', '1', 'sim', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  async getMercadoPagoConfig() {
    const rows = await this.getRowsMap();
    const activeModeRow = rows.get(this.cacheKey('mercadopago', 'mp_active_mode'));
    const [
      userId,
      applicationId,
      webhookSecret,
      testPublicKey,
      testAccessToken,
      publicKey,
      accessToken,
      clientId,
      clientSecret,
      successUrl,
      failureUrl,
      pendingUrl,
      billingPortalUrl,
      courseInstallments,
      graceDays,
      boletoGraceDays,
      emailsEnabled,
      assistedRecurringPixBoleto,
      cronEnabled,
      cronScheduleRaw,
      boletoWatcherEnabled,
      boletoWatcherScheduleRaw,
      boletoWatcherMaxDays,
      cobrancaEnabled,
      cobrancaScheduleRaw,
    ] = await Promise.all([
      this.getString('mercadopago', 'mp_user_id'),
      this.getString('mercadopago', 'mp_application_id'),
      this.getString('mercadopago', 'mp_webhook_secret'),
      this.getString('mercadopago', 'mp_test_public_key'),
      this.getString('mercadopago', 'mp_test_access_token'),
      this.getString('mercadopago', 'mp_public_key'),
      this.getString('mercadopago', 'mp_access_token'),
      this.getString('mercadopago', 'mp_client_id'),
      this.getString('mercadopago', 'mp_client_secret'),
      this.getString('mercadopago', 'mp_return_success_url'),
      this.getString('mercadopago', 'mp_return_failure_url'),
      this.getString('mercadopago', 'mp_return_pending_url'),
      this.getString('mercadopago', 'mp_billing_portal_url'),
      this.getCourseInstallmentsConfig(),
      this.getNumber('mercadopago', 'assinaturas_grace_days', 5),
      this.getNumber('mercadopago', 'assinaturas_boleto_grace_days', 5),
      this.getBoolean('mercadopago', 'assinaturas_emails_enabled', true),
      this.getBoolean('mercadopago', 'assinaturas_assistida_pix_boleto', true),
      this.getBoolean('mercadopago', 'cron_reconciliation_enabled', false),
      this.getString('mercadopago', 'cron_reconciliation_schedule'),
      this.getBoolean('mercadopago', 'cron_boleto_enabled', false),
      this.getString('mercadopago', 'cron_boleto_schedule'),
      this.getNumber('mercadopago', 'cron_boleto_max_days', 5),
      this.getBoolean('mercadopago', 'cron_cobranca_enabled', true),
      this.getString('mercadopago', 'cron_cobranca_schedule'),
    ]);

    const hasProduction = Boolean(publicKey || accessToken);
    const hasTest = Boolean(testPublicKey || testAccessToken);
    const normalizedActiveMode = this.resolveMercadoPagoActiveMode(
      activeModeRow?.valor ? String(activeModeRow.valor) : undefined,
      hasProduction,
      hasTest,
    );

    return {
      activeMode: normalizedActiveMode,
      userId,
      applicationId,
      webhookSecret,
      test: {
        publicKey: testPublicKey,
        accessToken: testAccessToken,
      },
      prod: {
        publicKey,
        accessToken,
        clientId,
        clientSecret,
      },
      returnUrls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      settings: {
        defaultCurrency: 'BRL',
        defaultRecurrence: 'ASSINATURA',
        graceDays,
        boletoGraceDays,
        emailsEnabled,
        assistedRecurringPixBoleto,
        billingPortalUrl,
        cronEnabled,
        cronSchedule: parseScheduleConfig(cronScheduleRaw || undefined, 120),
        boletoWatcherEnabled,
        boletoWatcherSchedule: parseScheduleConfig(boletoWatcherScheduleRaw || undefined, 60),
        boletoWatcherMaxDays,
        cobrancaEnabled,
        cobrancaSchedule: parseScheduleConfig(cobrancaScheduleRaw || undefined, 360),
      },
      courseInstallments,
      active:
        normalizedActiveMode === 'production'
          ? {
              publicKey,
              accessToken,
              clientId,
              clientSecret,
            }
          : {
              publicKey: testPublicKey,
              accessToken: testAccessToken,
              clientId: '',
              clientSecret: '',
            },
      getAccessToken: () => (normalizedActiveMode === 'production' ? accessToken : testAccessToken),
      getPublicKey: () => (normalizedActiveMode === 'production' ? publicKey : testPublicKey),
      getAccessTokenFingerprint: () =>
        fingerprintSecret(normalizedActiveMode === 'production' ? accessToken : testAccessToken),
      validateActiveCredentials: (): MercadoPagoValidationResult => {
        if (normalizedActiveMode === 'production') {
          const missingKeys: MercadoPagoCredentialKey[] = [];
          if (!publicKey) missingKeys.push('mp_public_key');
          if (!accessToken) missingKeys.push('mp_access_token');

          return {
            activeMode: normalizedActiveMode,
            missingKeys,
            publicKey,
            accessToken,
          };
        }

        const missingKeys: MercadoPagoCredentialKey[] = [];
        if (!testPublicKey) missingKeys.push('mp_test_public_key');
        if (!testAccessToken) missingKeys.push('mp_test_access_token');

        return {
          activeMode: normalizedActiveMode,
          missingKeys,
          publicKey: testPublicKey,
          accessToken: testAccessToken,
        };
      },
    };
  }

  async getMercadoPagoClient(): Promise<MercadoPagoConfig | null> {
    const config = await this.getMercadoPagoConfig();
    const validation = config.validateActiveCredentials();
    const token = validation.accessToken;
    if (!token || validation.missingKeys.length > 0) return null;

    if (this.mpClientCache?.token === token) {
      return this.mpClientCache.client;
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    this.mpClientCache = { token, client };
    return client;
  }

  async getBrevoConfig() {
    const [
      apiKey,
      fromEmail,
      fromName,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      passwordRecoveryExpirationHours,
      passwordRecoveryMaxAttempts,
      passwordRecoveryCooldownMinutes,
      maxRetries,
      retryDelay,
      timeout,
      dailyEmailLimit,
      dailySMSLimit,
      smsSender,
      smsUnicodeEnabled,
      templateCacheEnabled,
      preloadTemplates,
      emailVerificationRequired,
      emailVerificationExpirationHours,
      emailVerificationMaxResend,
      emailVerificationCooldownMinutes,
    ] = await Promise.all([
      this.getString('emails', 'brevo_api_key'),
      this.getString('emails', 'brevo_from_email'),
      this.getString('emails', 'brevo_from_name'),
      this.getString('emails', 'brevo_smtp_host'),
      this.getNumber('emails', 'brevo_smtp_port', 587),
      this.getString('emails', 'brevo_smtp_user'),
      this.getString('emails', 'brevo_smtp_password'),
      this.getNumber('emails', 'brevo_password_recovery_expiration_hours', 72),
      this.getNumber('emails', 'brevo_password_recovery_max_attempts', 3),
      this.getNumber('emails', 'brevo_password_recovery_cooldown_minutes', 15),
      this.getNumber('emails', 'brevo_max_retries', 3),
      this.getNumber('emails', 'brevo_retry_delay', 1000),
      this.getNumber('emails', 'brevo_timeout', 30000),
      this.getNumber('emails', 'brevo_daily_email_limit', 10000),
      this.getNumber('emails', 'brevo_daily_sms_limit', 1000),
      this.getString('emails', 'brevo_sms_sender'),
      this.getBoolean('emails', 'brevo_sms_unicode', false),
      this.getBoolean('emails', 'brevo_template_cache', true),
      this.getBoolean('emails', 'brevo_preload_templates', true),
      this.getBoolean('emails', 'email_verification_required', true),
      this.getNumber('emails', 'email_verification_expiration_hours', 72),
      this.getNumber('emails', 'email_verification_max_resend', 3),
      this.getNumber('emails', 'email_verification_cooldown_minutes', 5),
    ]);

    return {
      apiKey,
      fromEmail: fromEmail || 'noreply@advancemais.com',
      fromName: fromName || 'Advance+',
      smtp: {
        host: smtpHost || 'smtp-relay.brevo.com',
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      },
      passwordRecovery: {
        tokenExpirationMinutes: passwordRecoveryExpirationHours * 60,
        maxAttempts: passwordRecoveryMaxAttempts,
        cooldownMinutes: passwordRecoveryCooldownMinutes,
      },
      sending: {
        maxRetries,
        retryDelay,
        timeout,
        dailyEmailLimit,
        dailySMSLimit,
        defaultSMSSender: smsSender || 'Advance+',
        smsUnicodeEnabled,
      },
      templates: {
        cacheEnabled: templateCacheEnabled,
        preloadOnStart: preloadTemplates,
      },
      emailVerification: {
        enabled: emailVerificationRequired,
        tokenExpirationHours: emailVerificationExpirationHours,
        maxResendAttempts: emailVerificationMaxResend,
        resendCooldownMinutes: emailVerificationCooldownMinutes,
      },
      isConfigured: Boolean(apiKey && fromEmail),
    };
  }

  async getGoogleOAuthConfig() {
    const [clientId, clientSecret] = await Promise.all([
      this.getString('integracoes', 'google_client_id'),
      this.getString('integracoes', 'google_client_secret'),
    ]);

    return {
      clientId,
      clientSecret,
      configured: Boolean(clientId && clientSecret),
    };
  }

  async getUploadConfig() {
    const [maxFileSize, allowedMimeTypes] = await Promise.all([
      this.getNumber('uploads', 'max_file_size', 10485760),
      this.getString('uploads', 'allowed_mime_types'),
    ]);

    return {
      maxFileSize,
      allowedMimeTypes: (allowedMimeTypes || 'image/jpeg,image/png,image/gif,application/pdf')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }

  async getAgendaCronConfig() {
    return {
      aulas: {
        enabled: await this.getBoolean('agenda', 'agenda_cron_aulas_enabled', true),
        schedule: parseScheduleConfig(
          await this.getString('agenda', 'agenda_cron_aulas_schedule'),
          15,
        ),
      },
      provas: {
        enabled: await this.getBoolean('agenda', 'agenda_cron_provas_enabled', true),
        schedule: parseScheduleConfig(
          await this.getString('agenda', 'agenda_cron_provas_schedule'),
          15,
        ),
      },
      entrevistas: {
        enabled: await this.getBoolean('agenda', 'agenda_cron_entrevistas_enabled', true),
        schedule: parseScheduleConfig(
          await this.getString('agenda', 'agenda_cron_entrevistas_schedule'),
          15,
        ),
      },
    };
  }

  async getCourseInstallmentsConfig(): Promise<CursoInstallmentsConfig> {
    const [enabled, maxInstallmentsRaw] = await Promise.all([
      this.getBoolean('mercadopago', 'cursos_installments_enabled', false),
      this.getNumber('mercadopago', 'cursos_installments_max', 1),
    ]);

    return {
      enabled,
      maxInstallments: Math.min(12, Math.max(1, Number(maxInstallmentsRaw || 1))),
    };
  }

  private async getRowsMap(): Promise<Map<string, ConfigRow>> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.rows;
    }

    if (this.pendingRowsPromise) {
      return this.pendingRowsPromise;
    }

    this.pendingRowsPromise = this.loadRowsMap(now).finally(() => {
      this.pendingRowsPromise = null;
    });

    return this.pendingRowsPromise;
  }

  private async loadRowsMap(now: number): Promise<Map<string, ConfigRow>> {
    try {
      const rows = await prisma.sistemaConfiguracoes.findMany({
        where: { ativo: true },
        select: {
          categoria: true,
          chave: true,
          tipo: true,
          valor: true,
          valorCriptografado: true,
          valorHash: true,
          ehSecreto: true,
          atualizadoEm: true,
        },
      });

      const map = new Map<string, ConfigRow>();
      for (const row of rows) {
        map.set(this.cacheKey(row.categoria, row.chave), row);
      }

      this.cache = { expiresAt: now + CACHE_TTL_MS, rows: map };
      return map;
    } catch (error) {
      const errorCode = (error as { code?: string })?.code;
      const isMissingTable =
        errorCode === 'P2021' ||
        String((error as { message?: string })?.message ?? '').includes('SistemaConfiguracoes');
      const emptyRows = new Map<string, ConfigRow>();

      this.cache = { expiresAt: now + CACHE_TTL_MS, rows: emptyRows };

      if (isMissingTable) {
        this.log.warn(
          { code: errorCode },
          'Tabela SistemaConfiguracoes indisponível; usando fallback env',
        );
        return emptyRows;
      }

      this.log.error({ err: error }, 'Erro ao carregar configurações runtime; usando fallback env');
      return emptyRows;
    }
  }

  private resolvePublicItem(definition: ConfigDefinition, row?: ConfigRow): ResolvedConfigItem {
    if (definition.category === 'mercadopago' && definition.key === 'mp_active_mode') {
      const envValue = firstEnvValue(definition.envKeys);
      const envSource = getEnvSource(definition.envKeys);
      const source: ConfigSource =
        row && row.valor !== null
          ? 'DB'
          : definition.defaultValue !== undefined
            ? 'DEFAULT'
            : envValue !== undefined
              ? 'ENV'
              : 'EMPTY';
      const value = (row?.valor ? String(row.valor) : envValue) || 'production';

      return {
        key: definition.key,
        label: definition.label,
        type: definition.type,
        secret: false,
        value,
        configured: true,
        source,
        envKeys: definition.envKeys,
        envSource,
        fingerprint: null,
        maskedPreview: null,
        restartRequired: Boolean(definition.restartRequired),
        description: definition.description ?? null,
        updatedAt: row?.atualizadoEm?.toISOString() ?? null,
        required: Boolean(definition.required),
      };
    }

    const envValue = firstEnvValue(definition.envKeys);
    const envSource = getEnvSource(definition.envKeys);
    const hasDbValue = Boolean(row && (row.valor !== null || row.valorCriptografado));
    const source: ConfigSource = hasDbValue
      ? 'DB'
      : envValue !== undefined
        ? 'ENV'
        : definition.defaultValue !== undefined
          ? 'DEFAULT'
          : 'EMPTY';

    if (definition.secret) {
      let secretPreviewValue: string | null = null;

      try {
        if (row?.valorCriptografado) {
          secretPreviewValue = decryptSecret(row.valorCriptografado);
        } else if (typeof envValue === 'string') {
          secretPreviewValue = envValue;
        } else if (definition.defaultValue !== undefined && definition.defaultValue !== null) {
          secretPreviewValue = String(definition.defaultValue);
        }
      } catch (error) {
        this.log.warn(
          { category: definition.category, key: definition.key, err: error },
          'Não foi possível gerar preview do segredo configurado',
        );
      }

      return {
        key: definition.key,
        label: definition.label,
        type: definition.type,
        secret: true,
        value: null,
        configured: hasDbValue || Boolean(envValue),
        source,
        envKeys: definition.envKeys,
        envSource,
        fingerprint: row?.valorHash ?? fingerprintSecret(envValue),
        maskedPreview: maskSecretPreview(secretPreviewValue),
        restartRequired: Boolean(definition.restartRequired),
        description: definition.description ?? null,
        updatedAt: row?.atualizadoEm?.toISOString() ?? null,
        required: Boolean(definition.required),
      };
    }

    const value = hasDbValue
      ? normalizeConfigValue(definition, row?.valor)
      : (parseEnvValue(definition) ?? null);

    return {
      key: definition.key,
      label: definition.label,
      type: definition.type,
      secret: false,
      value,
      configured: value !== null && value !== '',
      source,
      envKeys: definition.envKeys,
      envSource,
      fingerprint: null,
      maskedPreview: null,
      restartRequired: Boolean(definition.restartRequired),
      description: definition.description ?? null,
      updatedAt: row?.atualizadoEm?.toISOString() ?? null,
      required: Boolean(definition.required),
    };
  }

  private resolveMercadoPagoActiveMode(
    rawMode: string | undefined,
    hasProduction: boolean,
    hasTest: boolean,
  ): MercadoPagoMode {
    if (rawMode === 'production' || rawMode === 'test') {
      return rawMode;
    }

    if (hasProduction && hasTest) return 'production';
    if (hasProduction) return 'production';
    if (hasTest) return 'test';
    return 'production';
  }

  private async patchDerivedCategoryData(
    category: RuntimeConfigCategoryResponse,
  ): Promise<RuntimeConfigCategoryResponse> {
    if (category.category !== 'mercadopago') return category;

    const mpConfig = await this.getMercadoPagoConfig();
    return {
      ...category,
      items: category.items.map((item) => {
        if (item.key === 'mp_active_mode') {
          return {
            ...item,
            value: mpConfig.activeMode,
            configured: true,
          };
        }

        if (item.key === 'assinaturas_default_currency') {
          return {
            ...item,
            value: 'BRL',
            configured: true,
            source: 'DEFAULT',
          };
        }

        if (item.key === 'assinaturas_recorrencia_padrao') {
          return {
            ...item,
            value: 'ASSINATURA',
            configured: true,
            source: 'DEFAULT',
          };
        }

        if (item.key === 'cursos_installments_enabled') {
          return {
            ...item,
            value: mpConfig.courseInstallments.enabled,
            configured: true,
          };
        }

        if (item.key === 'cursos_installments_max') {
          return {
            ...item,
            value: mpConfig.courseInstallments.maxInstallments,
            configured: true,
          };
        }

        return item;
      }),
    };
  }

  private cacheKey(category: string, key: string): string {
    return `${category}.${key}`;
  }
}

export const runtimeConfigService = new RuntimeConfigService();
export { CONFIG_DEFINITIONS };

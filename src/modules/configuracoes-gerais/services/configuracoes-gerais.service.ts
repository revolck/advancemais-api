import type { Request } from 'express';
import { AuditoriaCategoria, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AuditoriaService } from '@/modules/auditoria/services/auditoria.service';
import { logger } from '@/utils/logger';
import { getDefinitionsByCategory, isConfigCategory, type ConfigCategory } from '../catalog';
import {
  encryptSecret,
  fingerprintSecret,
  isConfigEncryptionKeyConfigured,
} from '../utils/config-crypto';
import { normalizeConfigValue } from '../utils/config-normalizers';
import { runtimeConfigService } from './runtime-config.service';

type SecretAction = 'keep' | 'replace' | 'clear';

export interface UpdateConfigPayload {
  values?: Record<string, unknown>;
  secrets?: Record<string, { action?: SecretAction; value?: string }>;
  motivo?: string;
}

const auditoriaService = new AuditoriaService();
const serviceLogger = logger.child({ module: 'ConfiguracoesGeraisService' });

type RuntimeCategorySnapshot = Awaited<ReturnType<typeof runtimeConfigService.listCategory>>;
type EffectiveValueMap = Record<string, string | number | boolean | null>;

const ALLOWED_LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const CONDITIONAL_REQUIRED_FIELDS: Partial<
  Record<ConfigCategory, { enabledKey: string; dependentKeys: string[] }[]>
> = {
  mercadopago: [
    {
      enabledKey: 'cron_boleto_enabled',
      dependentKeys: ['cron_boleto_schedule', 'cron_boleto_max_days'],
    },
    {
      enabledKey: 'cron_reconciliation_enabled',
      dependentKeys: ['cron_reconciliation_schedule'],
    },
    {
      enabledKey: 'cron_cobranca_enabled',
      dependentKeys: ['cron_cobranca_schedule'],
    },
    {
      enabledKey: 'cursos_installments_enabled',
      dependentKeys: ['cursos_installments_max'],
    },
  ],
  agenda: [
    {
      enabledKey: 'agenda_cron_aulas_enabled',
      dependentKeys: ['agenda_cron_aulas_schedule'],
    },
    {
      enabledKey: 'agenda_cron_provas_enabled',
      dependentKeys: ['agenda_cron_provas_schedule'],
    },
    {
      enabledKey: 'agenda_cron_entrevistas_enabled',
      dependentKeys: ['agenda_cron_entrevistas_schedule'],
    },
  ],
};

function formatAuditValue(item: RuntimeCategorySnapshot['items'][number]) {
  if (item.secret) {
    return item.maskedPreview ?? (item.configured ? 'Valor protegido' : null);
  }

  if (item.value === null || item.value === undefined || item.value === '') {
    return null;
  }

  if (typeof item.value === 'boolean') {
    return item.value ? 'Ativo' : 'Desligado';
  }

  return item.value;
}

function buildAuditFieldSnapshot(category: RuntimeCategorySnapshot, changedKeys: string[]) {
  const snapshotEntries = category.items
    .filter((item) => changedKeys.includes(item.key))
    .map((item) => [
      item.key,
      {
        label: item.label,
        type: item.type,
        secret: item.secret,
        configured: item.configured,
        source: item.source,
        value: formatAuditValue(item),
      },
    ]);

  return Object.fromEntries(snapshotEntries);
}

function buildAuditChangedFields(
  before: RuntimeCategorySnapshot,
  after: RuntimeCategorySnapshot,
  changedKeys: string[],
) {
  const beforeMap = new Map(before.items.map((item) => [item.key, item]));
  const afterMap = new Map(after.items.map((item) => [item.key, item]));

  return changedKeys.map((key) => {
    const beforeItem = beforeMap.get(key);
    const afterItem = afterMap.get(key);

    return {
      key,
      label: afterItem?.label ?? beforeItem?.label ?? key,
      type: afterItem?.type ?? beforeItem?.type ?? 'string',
      secret: Boolean(afterItem?.secret ?? beforeItem?.secret),
      before: beforeItem ? formatAuditValue(beforeItem) : null,
      after: afterItem ? formatAuditValue(afterItem) : null,
      sourceBefore: beforeItem?.source ?? null,
      sourceAfter: afterItem?.source ?? null,
    };
  });
}

function buildEffectiveValueMap(category: RuntimeCategorySnapshot): EffectiveValueMap {
  return Object.fromEntries(category.items.map((item) => [item.key, item.value ?? null]));
}

class ConfiguracoesGeraisService {
  async listAll() {
    return runtimeConfigService.listAll();
  }

  async listHistory(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize || 20)));
    const skip = (page - 1) * pageSize;

    const where = {
      categoria: AuditoriaCategoria.SISTEMA,
      tipo: { startsWith: 'CONFIGURACAO_' },
      entidadeTipo: 'SISTEMA_CONFIGURACOES',
    } as const;

    const [items, total] = await Promise.all([
      prisma.auditoriaLogs.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        include: {
          Usuarios: {
            select: { id: true, nomeCompleto: true, email: true, role: true },
          },
        },
      }),
      prisma.auditoriaLogs.count({ where }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        acao: item.acao,
        descricao: item.descricao,
        categoria:
          item.metadata && typeof item.metadata === 'object'
            ? (item.metadata as any).category
            : null,
        dadosAnteriores: item.dadosAnteriores,
        dadosNovos: item.dadosNovos,
        metadata: item.metadata,
        criadoEm: item.criadoEm,
        usuario: item.Usuarios
          ? {
              id: item.Usuarios.id,
              nome: item.Usuarios.nomeCompleto,
              email: item.Usuarios.email,
              role: item.Usuarios.role,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async updateCategory(category: string, payload: UpdateConfigPayload, req: Request) {
    if (!isConfigCategory(category)) {
      throw Object.assign(new Error('Categoria de configuração inválida'), {
        code: 'INVALID_CONFIG_CATEGORY',
        statusCode: 400,
      });
    }

    const actorId = req.user?.id;
    if (!actorId) {
      throw Object.assign(new Error('Usuário autenticado não encontrado'), {
        code: 'AUTH_USER_REQUIRED',
        statusCode: 401,
      });
    }

    const before = await runtimeConfigService.listCategory(category);
    const definitions = getDefinitionsByCategory(category);
    const values = payload.values ?? {};
    const secrets = payload.secrets ?? {};
    const changedKeys: string[] = [];
    const normalizedValues: EffectiveValueMap = {};
    const hasSecretReplace = definitions.some((definition) => {
      if (!definition.secret) return false;
      return secrets[definition.key]?.action === 'replace';
    });

    for (const definition of definitions) {
      if (definition.secret) continue;
      if (!Object.prototype.hasOwnProperty.call(values, definition.key)) continue;

      const rawValue = values[definition.key];
      normalizedValues[definition.key] =
        rawValue === null ? null : normalizeConfigValue(definition, rawValue);
    }

    this.validateUpdatePayload(category, definitions, before, normalizedValues);

    if (hasSecretReplace && !isConfigEncryptionKeyConfigured()) {
      serviceLogger.warn(
        {
          category,
          actorId,
          secretKeys: Object.keys(secrets).filter((key) => secrets[key]?.action === 'replace'),
        },
        'Tentativa de alterar segredo sem CONFIG_ENCRYPTION_KEY configurada',
      );
      throw Object.assign(
        new Error(
          'Campos protegidos não podem ser alterados agora porque a chave de segurança da API não está configurada.',
        ),
        {
          code: 'CONFIG_SECRET_UNAVAILABLE',
          statusCode: 503,
        },
      );
    }

    for (const definition of definitions) {
      if (definition.secret) {
        const secretInput = secrets[definition.key];
        if (!secretInput || secretInput.action === 'keep' || !secretInput.action) continue;

        changedKeys.push(definition.key);

        if (secretInput.action === 'clear') {
          await prisma.sistemaConfiguracoes.deleteMany({
            where: { categoria: category, chave: definition.key },
          });
          continue;
        }

        if (secretInput.action === 'replace') {
          const rawValue = String(secretInput.value ?? '').trim();
          if (!rawValue) {
            throw Object.assign(new Error(`${definition.label} não pode ficar vazio`), {
              code: 'INVALID_CONFIG_SECRET',
              statusCode: 400,
            });
          }

          let encrypted: string;
          try {
            encrypted = encryptSecret(rawValue);
          } catch (error) {
            if ((error as any)?.code === 'CONFIG_ENCRYPTION_KEY_MISSING') {
              serviceLogger.warn(
                { category, actorId, key: definition.key },
                'Falha ao criptografar segredo por ausência de CONFIG_ENCRYPTION_KEY',
              );
              throw Object.assign(
                new Error(
                  'Campos protegidos não podem ser alterados agora porque a chave de segurança da API não está configurada.',
                ),
                {
                  code: 'CONFIG_SECRET_UNAVAILABLE',
                  statusCode: 503,
                },
              );
            }
            throw error;
          }
          await prisma.sistemaConfiguracoes.upsert({
            where: { categoria_chave: { categoria: category, chave: definition.key } },
            create: {
              categoria: category,
              chave: definition.key,
              tipo: definition.type,
              ehSecreto: true,
              valorCriptografado: encrypted,
              valorHash: fingerprintSecret(rawValue),
              descricao: definition.description,
              atualizadoPorId: actorId,
            },
            update: {
              tipo: definition.type,
              ehSecreto: true,
              valor: Prisma.JsonNull,
              valorCriptografado: encrypted,
              valorHash: fingerprintSecret(rawValue),
              descricao: definition.description,
              atualizadoPorId: actorId,
              ativo: true,
            },
          });
        }

        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(values, definition.key)) continue;

      changedKeys.push(definition.key);
      const rawValue = values[definition.key];

      if (rawValue === null) {
        await prisma.sistemaConfiguracoes.deleteMany({
          where: { categoria: category, chave: definition.key },
        });
        continue;
      }

      const normalized = normalizedValues[definition.key] as string | number | boolean;
      await prisma.sistemaConfiguracoes.upsert({
        where: { categoria_chave: { categoria: category, chave: definition.key } },
        create: {
          categoria: category,
          chave: definition.key,
          tipo: definition.type,
          ehSecreto: false,
          valor: normalized,
          descricao: definition.description,
          atualizadoPorId: actorId,
        },
        update: {
          tipo: definition.type,
          ehSecreto: false,
          valor: normalized,
          valorCriptografado: null,
          valorHash: null,
          descricao: definition.description,
          atualizadoPorId: actorId,
          ativo: true,
        },
      });
    }

    runtimeConfigService.invalidate();
    await this.runPostUpdateHooks(category);
    const after = await runtimeConfigService.listCategory(category);

    if (changedKeys.length > 0) {
      await this.auditUpdate({
        req,
        category,
        changedKeys,
        before,
        after,
        motivo: payload.motivo,
      });
    }

    return after;
  }

  async testCategory(category: string) {
    if (!isConfigCategory(category)) {
      throw Object.assign(new Error('Categoria de configuração inválida'), {
        code: 'INVALID_CONFIG_CATEGORY',
        statusCode: 400,
      });
    }

    switch (category) {
      case 'mercadopago': {
        const mpConfig = await runtimeConfigService.getMercadoPagoConfig();
        const validation = mpConfig.validateActiveCredentials();
        const modeLabel = validation.activeMode === 'production' ? 'Produção' : 'Teste';
        const missingMap: Record<string, string> = {
          mp_public_key: 'Public key de produção',
          mp_access_token: 'Access token de produção',
          mp_test_public_key: 'Public key de teste',
          mp_test_access_token: 'Access token de teste',
        };
        return {
          category: 'mercadopago',
          ok: validation.missingKeys.length === 0,
          checks: [
            {
              key: 'mp_active_mode',
              label: 'Modo ativo',
              ok: true,
              message: `Modo ${modeLabel} ativo.`,
            },
            ...validation.missingKeys.map((key) => ({
              key,
              label: missingMap[key],
              ok: false,
              message: `Modo ${modeLabel} ativo, mas falta ${missingMap[key]}.`,
            })),
          ],
          success: validation.missingKeys.length === 0,
          message:
            validation.missingKeys.length === 0
              ? `Mercado Pago configurado no modo ${modeLabel}.`
              : `Modo ${modeLabel} ativo, mas faltam credenciais obrigatórias.`,
          details: {
            activeMode: validation.activeMode,
            missingKeys: validation.missingKeys,
            hasAccessToken: Boolean(validation.accessToken),
            hasPublicKey: Boolean(validation.publicKey),
            tokenFingerprint: mpConfig.getAccessTokenFingerprint(),
            courseInstallmentsEnabled: mpConfig.courseInstallments.enabled,
            courseInstallmentsMax: mpConfig.courseInstallments.maxInstallments,
          },
        };
      }
      case 'emails': {
        const brevoConfig = await runtimeConfigService.getBrevoConfig();
        return {
          success: brevoConfig.isConfigured,
          message: brevoConfig.isConfigured
            ? 'Brevo configurado.'
            : 'Configure API key e remetente.',
          details: {
            fromEmail: brevoConfig.fromEmail,
            fromName: brevoConfig.fromName,
            hasApiKey: Boolean(brevoConfig.apiKey),
          },
        };
      }
      case 'integracoes': {
        const googleConfig = await runtimeConfigService.getGoogleOAuthConfig();
        return {
          success: googleConfig.configured,
          message: googleConfig.configured
            ? 'Google OAuth configurado.'
            : 'Configure Client ID e Client Secret.',
          details: {
            hasClientId: Boolean(googleConfig.clientId),
            hasClientSecret: Boolean(googleConfig.clientSecret),
          },
        };
      }
      case 'uploads': {
        const uploadConfig = await runtimeConfigService.getUploadConfig();
        return {
          success: uploadConfig.maxFileSize > 0 && uploadConfig.allowedMimeTypes.length > 0,
          message: 'Configuração de upload validada.',
          details: uploadConfig,
        };
      }
      case 'agenda': {
        return {
          success: true,
          message: 'Configuração de agenda validada.',
          details: await runtimeConfigService.getAgendaCronConfig(),
        };
      }
      case 'logs':
      default:
        return {
          success: true,
          message: 'Configuração de logs validada.',
          details: await runtimeConfigService.listCategory(category as ConfigCategory),
        };
    }
  }

  async getPublicMercadoPagoConfig() {
    const mpConfig = await runtimeConfigService.getMercadoPagoConfig();
    const validation = mpConfig.validateActiveCredentials();
    const publicKey = validation.publicKey || null;
    return {
      configured: validation.missingKeys.length === 0 && Boolean(publicKey),
      publicKey,
      isTestMode: publicKey?.startsWith('TEST-') ?? false,
      activeMode: validation.activeMode,
      courseInstallmentsEnabled: mpConfig.courseInstallments.enabled,
      courseInstallmentsMax: mpConfig.courseInstallments.maxInstallments,
      coursePaymentMethods: mpConfig.coursePaymentMethods,
      subscriptionPaymentMethods: mpConfig.subscriptionPaymentMethods,
    };
  }

  private async auditUpdate(params: {
    req: Request;
    category: ConfigCategory;
    changedKeys: string[];
    before: RuntimeCategorySnapshot;
    after: RuntimeCategorySnapshot;
    motivo?: string;
  }) {
    try {
      const changedFields = buildAuditChangedFields(
        params.before,
        params.after,
        params.changedKeys,
      );

      await auditoriaService.registrarLog({
        categoria: AuditoriaCategoria.SISTEMA,
        tipo: 'CONFIGURACAO_GERAL_ATUALIZADA',
        acao: 'ATUALIZAR_CONFIGURACAO_GERAL',
        usuarioId: params.req.user?.id,
        entidadeId: params.category,
        entidadeTipo: 'SISTEMA_CONFIGURACOES',
        descricao: `${params.after.label} atualizado${changedFields.length > 1 ? 's' : ''}: ${changedFields
          .map((field) => field.label)
          .join(', ')}`,
        dadosAnteriores: {
          category: params.category,
          categoryLabel: params.before.label,
          fields: buildAuditFieldSnapshot(params.before, params.changedKeys),
        } as any,
        dadosNovos: {
          category: params.category,
          categoryLabel: params.after.label,
          fields: buildAuditFieldSnapshot(params.after, params.changedKeys),
        } as any,
        metadata: {
          category: params.category,
          categoryLabel: params.after.label,
          changedKeys: params.changedKeys,
          changedFields,
          motivo: params.motivo ?? null,
          actorRole: params.req.user?.role ?? null,
          origem: 'CONFIGURACOES_GERAIS',
        },
        ip: params.req.ip,
        userAgent: params.req.get('user-agent') ?? undefined,
      });
    } catch (error) {
      serviceLogger.error(
        { err: error, category: params.category },
        'Falha ao auditar configuração',
      );
    }
  }

  private async runPostUpdateHooks(category: ConfigCategory) {
    if (category !== 'agenda' && category !== 'mercadopago' && category !== 'logs') return;

    try {
      const { reloadRuntimeCronJobs } = require('./runtime-cron-registry.service') as {
        reloadRuntimeCronJobs: (category: ConfigCategory) => Promise<void>;
      };
      await reloadRuntimeCronJobs(category);
    } catch (error) {
      serviceLogger.warn({ err: error, category }, 'Não foi possível recarregar rotinas runtime');
    }
  }

  private validateUpdatePayload(
    category: ConfigCategory,
    definitions: ReturnType<typeof getDefinitionsByCategory>,
    currentCategory: RuntimeCategorySnapshot,
    normalizedValues: EffectiveValueMap,
  ) {
    const effectiveValues: EffectiveValueMap = {
      ...buildEffectiveValueMap(currentCategory),
      ...normalizedValues,
    };

    if (category === 'uploads') {
      const mimeTypesValue = String(effectiveValues.allowed_mime_types ?? '').trim();
      if (!mimeTypesValue) {
        throw Object.assign(new Error('MIME types permitidos não pode ficar vazio'), {
          code: 'INVALID_CONFIG_VALUE',
          statusCode: 400,
        });
      }
    }

    if (category === 'logs') {
      const logLevelValue = String(effectiveValues.log_level ?? '')
        .trim()
        .toLowerCase();
      if (logLevelValue && !ALLOWED_LOG_LEVELS.has(logLevelValue)) {
        throw Object.assign(new Error('Nível de log inválido'), {
          code: 'INVALID_CONFIG_VALUE',
          statusCode: 400,
        });
      }
    }

    if (category === 'mercadopago') {
      ['course_payment_methods', 'subscription_payment_methods'].forEach((key) => {
        const requested = String(effectiveValues[key] ?? '')
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        const normalized = Array.from(
          new Set(requested.filter((item) => ['pix', 'boleto', 'card'].includes(item))),
        );

        if (requested.length !== normalized.length) {
          throw Object.assign(
            new Error(
              `${
                definitions.find((item) => item.key === key)?.label ?? key
              } contém métodos inválidos`,
            ),
            {
              code: 'INVALID_CONFIG_VALUE',
              statusCode: 400,
            },
          );
        }

        if (normalized.length === 0) {
          throw Object.assign(
            new Error(
              `${
                definitions.find((item) => item.key === key)?.label ?? key
              } precisa ter pelo menos um método selecionado`,
            ),
            {
              code: 'INVALID_CONFIG_VALUE',
              statusCode: 400,
            },
          );
        }
      });
    }

    const conditionalRules = CONDITIONAL_REQUIRED_FIELDS[category] ?? [];
    conditionalRules.forEach(({ enabledKey, dependentKeys }) => {
      if (effectiveValues[enabledKey] !== true) return;

      dependentKeys.forEach((key) => {
        const definition = definitions.find((item) => item.key === key);
        const value = effectiveValues[key];
        const isMissing =
          value === null || value === undefined || (typeof value === 'string' && !value.trim());

        if (isMissing) {
          throw Object.assign(
            new Error(`${definition?.label ?? key} é obrigatório quando ${enabledKey} está ativo`),
            {
              code: 'INVALID_CONFIG_VALUE',
              statusCode: 400,
            },
          );
        }
      });
    });
  }
}

export const configuracoesGeraisService = new ConfiguracoesGeraisService();

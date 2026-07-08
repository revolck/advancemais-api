import {
  Prisma,
  WebsiteMarketingEmailTipo,
  WebsiteRecipientListStatus,
  WebsiteStatus,
} from '@prisma/client';
import cron from 'node-cron';

import { prisma } from '@/config/prisma';
import { EmailService } from '@/modules/brevo/services/email-service';
import { runtimeConfigService } from '@/modules/configuracoes-gerais/services/runtime-config.service';
import type {
  CreateMarketingEmailInput,
  ListMarketingEmailsQuery,
  MarketingEmailSenderConfigInput,
  MarketingEmailSettingsConfigInput,
  MarketingEmailTargetConfigInput,
  UpdateMarketingEmailInput,
} from '@/modules/website/validators/emails-marketing.schema';
import { invalidateCacheByPrefix } from '@/utils/cache';
import { logger } from '@/utils/logger';

const CACHE_PREFIX = 'website:emails-marketing';
const deliveryLogger = logger.child({ module: 'WebsiteMarketingEmailDelivery' });
const DELIVERY_CRON_SCHEDULE = '*/1 * * * *';
const DELIVERY_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const DELIVERY_PROCESSING_TIMEOUT_MESSAGE =
  'Tempo limite de 5 minutos excedido durante o processamento do envio.';

const leadRecipientSelect = {
  id: true,
  nome: true,
  email: true,
  status: true,
  tag: true,
  ultimoPopupId: true,
  ultimoPopupNome: true,
} satisfies Prisma.WebsitePopupLeadSelect;

const marketingEmailListSelect = {
  id: true,
  nome: true,
  status: true,
  tipo: true,
  assunto: true,
  previewText: true,
  templateSlug: true,
  settingsConfig: true,
  destinatariosEstimados: true,
  criadoEm: true,
  atualizadoEm: true,
  CriadoPor: {
    select: {
      id: true,
      nomeCompleto: true,
      UsuariosInformation: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
  AtualizadoPor: {
    select: {
      id: true,
      nomeCompleto: true,
      UsuariosInformation: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
} satisfies Prisma.WebsiteMarketingEmailSelect;

const marketingEmailDetailSelect = {
  ...marketingEmailListSelect,
  htmlContent: true,
  contentConfig: true,
  targetConfig: true,
  senderConfig: true,
  settingsConfig: true,
  criadoPorId: true,
  atualizadoPorId: true,
} satisfies Prisma.WebsiteMarketingEmailSelect;

type MarketingEmailDetailRow = Prisma.WebsiteMarketingEmailGetPayload<{
  select: typeof marketingEmailDetailSelect;
}>;

type LeadRecipientRow = Prisma.WebsitePopupLeadGetPayload<{
  select: typeof leadRecipientSelect;
}>;

type RecipientOptionsResponse = {
  sender: MarketingEmailSenderConfigInput;
  contatos: {
    id: string;
    nome: string;
    email: string | null;
    status: string;
    tag: string | null;
  }[];
  lists: {
    id: string;
    nome: string;
    folderName: string | null;
    recipientCount: number;
  }[];
};

type MarketingEmailWorkflowStatus = 'RASCUNHO' | 'PROCESSANDO' | 'FALHOU' | 'AGENDADO' | 'ENVIADO';

type MarketingEmailRecipient = {
  email: string;
  nome: string;
};

type MarketingEmailFilterOptionsResponse = {
  users: {
    id: string;
    nomeCompleto: string;
    avatarUrl: string | null;
  }[];
};

function createNotFoundError() {
  const error = new Error('Campanha de e-mail não encontrada') as Error & {
    status: number;
  };
  error.status = 404;
  return error;
}

function createSentCampaignLockedError(action: 'editar' | 'excluir') {
  const error = new Error(
    action === 'editar'
      ? 'Campanhas já enviadas não podem mais ser editadas.'
      : 'Campanhas já enviadas não podem mais ser excluídas.',
  ) as Error & {
    status: number;
    code: string;
  };
  error.status = 409;
  error.code = 'MARKETING_EMAIL_SENT_LOCKED';
  return error;
}

function toNullableString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function resolveDefaultSender(
  customSender?: MarketingEmailSenderConfigInput | null,
): Promise<MarketingEmailSenderConfigInput> {
  const brevoConfig = await runtimeConfigService.getBrevoConfig();
  const fromEmail = customSender?.fromEmail?.trim() || brevoConfig.fromEmail;
  const fallbackName = customSender?.fromName?.trim() || brevoConfig.fromName;
  const displayName = customSender?.displayName?.trim() || fallbackName;

  return {
    fromEmail,
    fromName: fallbackName,
    displayName,
  };
}

function parseTargetConfig(
  targetConfig?: Prisma.JsonValue | MarketingEmailTargetConfigInput | null,
): MarketingEmailTargetConfigInput {
  const raw = (targetConfig ?? {}) as Partial<MarketingEmailTargetConfigInput>;

  return {
    mode: raw.mode === 'REGULAR' ? 'REGULAR' : 'REGULAR',
    audienceType:
      raw.audienceType === 'MANUAL_CONTACTS' || raw.audienceType === 'LISTS'
        ? raw.audienceType
        : 'ALL_CONTACTS',
    contactIds: Array.isArray(raw.contactIds) ? raw.contactIds.filter(Boolean) : [],
    listIds: Array.isArray(raw.listIds) ? raw.listIds.filter(Boolean) : [],
  };
}

function parseSettingsConfig(
  settingsConfig?: Prisma.JsonValue | MarketingEmailSettingsConfigInput | null,
): MarketingEmailSettingsConfigInput {
  const raw = (settingsConfig ?? {}) as Partial<MarketingEmailSettingsConfigInput>;

  return {
    language: typeof raw.language === 'string' ? raw.language : null,
    replyToEmail: typeof raw.replyToEmail === 'string' ? raw.replyToEmail : null,
    trackOpens: raw.trackOpens ?? true,
    trackClicks: raw.trackClicks ?? true,
    googleAnalyticsCampaign:
      typeof raw.googleAnalyticsCampaign === 'string' ? raw.googleAnalyticsCampaign : null,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    deliveryMode: raw.deliveryMode === 'SCHEDULED' ? 'SCHEDULED' : 'NOW',
    scheduledAt:
      raw.deliveryMode === 'SCHEDULED' && typeof raw.scheduledAt === 'string'
        ? raw.scheduledAt
        : null,
    deliveryStatus:
      raw.deliveryStatus === 'PROCESSING' ||
      raw.deliveryStatus === 'SENT' ||
      raw.deliveryStatus === 'FAILED'
        ? raw.deliveryStatus
        : 'IDLE',
    processingStartedAt:
      typeof raw.processingStartedAt === 'string' ? raw.processingStartedAt : null,
    lastSentAt: typeof raw.lastSentAt === 'string' ? raw.lastSentAt : null,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
  };
}

function hasCampaignBeenSent(
  settingsConfig?: Prisma.JsonValue | MarketingEmailSettingsConfigInput | null,
) {
  return parseSettingsConfig(settingsConfig).deliveryStatus === 'SENT';
}

function getMarketingEmailWorkflowStatus(input: {
  status?: string | null;
  settingsConfig?: Prisma.JsonValue | MarketingEmailSettingsConfigInput | null;
}): MarketingEmailWorkflowStatus {
  if (input.status === 'RASCUNHO') {
    return 'RASCUNHO';
  }

  const settings = parseSettingsConfig(input.settingsConfig);

  if (settings.deliveryStatus === 'PROCESSING') {
    return 'PROCESSANDO';
  }

  if (settings.deliveryStatus === 'FAILED') {
    return 'FALHOU';
  }

  if (settings.deliveryStatus === 'SENT') {
    return 'ENVIADO';
  }

  if (settings.deliveryMode === 'SCHEDULED') {
    return 'AGENDADO';
  }

  return 'PROCESSANDO';
}

function getMarketingEmailDeliveryReferenceAt(
  settingsConfig?: Prisma.JsonValue | MarketingEmailSettingsConfigInput | null,
) {
  const settings = parseSettingsConfig(settingsConfig);
  return settings.lastSentAt ?? null;
}

function isWithinIsoRange(value: string | null, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!value) return false;

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;

  if (from) {
    const fromTime = new Date(from).getTime();
    if (Number.isFinite(fromTime) && time < fromTime) return false;
  }

  if (to) {
    const toTime = new Date(to).getTime();
    if (Number.isFinite(toTime) && time > toTime) return false;
  }

  return true;
}

function buildRecipientWhere(
  targetConfig: MarketingEmailTargetConfigInput,
): Prisma.WebsitePopupLeadWhereInput {
  const where: Prisma.WebsitePopupLeadWhereInput = {
    removidoEm: null,
    email: { not: null },
  };

  if (targetConfig.audienceType === 'MANUAL_CONTACTS' && targetConfig.contactIds.length > 0) {
    where.id = { in: targetConfig.contactIds };
  }

  return where;
}

function stripHtml(value?: string | null) {
  return (value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value?: string | null) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlFromContentConfig(
  contentConfig?: Prisma.JsonValue | Record<string, unknown> | null,
): string | null {
  const raw = (contentConfig ?? {}) as {
    popupPayload?: {
      contentConfig?: {
        titulo?: string;
        subtitulo?: string;
        botaoTexto?: string;
      } | null;
      designConfig?: {
        backgroundColor?: string | null;
        imageUrl?: string | null;
        imageAlt?: string | null;
      } | null;
    } | null;
    builder?: {
      content?: {
        titulo?: string;
        subtitulo?: string;
        botaoTexto?: string;
      } | null;
      design?: {
        backgroundColor?: string | null;
        imageUrl?: string | null;
        imageAlt?: string | null;
      } | null;
    } | null;
  };

  const content = raw.popupPayload?.contentConfig ?? raw.builder?.content ?? null;
  const design = raw.popupPayload?.designConfig ?? raw.builder?.design ?? null;

  const title = content?.titulo?.trim();
  const subtitle = content?.subtitulo?.trim();
  const buttonText = content?.botaoTexto?.trim();
  const imageUrl = design?.imageUrl?.trim();
  const imageAlt = design?.imageAlt?.trim() || title || 'Imagem da campanha';
  const backgroundColor = design?.backgroundColor?.trim() || '#f8fafc';

  if (!title && !subtitle && !buttonText && !imageUrl) {
    return null;
  }

  return [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(title || 'Campanha Advance+')}</title>`,
    '</head>',
    `<body style="margin:0;padding:32px 16px;background:${escapeHtml(backgroundColor)};font-family:Arial,sans-serif;color:#0f172a;">`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;">',
    '<tr><td style="padding:40px 32px;text-align:center;">',
    imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" style="max-width:100%;height:auto;border:0;display:block;margin:0 auto 24px;" />`
      : '',
    title
      ? `<h1 style="margin:0 0 16px;font-size:32px;line-height:1.2;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h1>`
      : '',
    subtitle
      ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#475569;">${escapeHtml(subtitle)}</p>`
      : '',
    buttonText
      ? `<div style="margin-top:8px;"><a href="#" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#0f2a6b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(buttonText)}</a></div>`
      : '',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isScheduledDue(settingsConfig: MarketingEmailSettingsConfigInput, now = Date.now()) {
  if (settingsConfig.deliveryMode !== 'SCHEDULED' || !settingsConfig.scheduledAt) {
    return false;
  }

  const scheduledAt = new Date(settingsConfig.scheduledAt).getTime();
  return Number.isFinite(scheduledAt) && scheduledAt <= now;
}

function isProcessingStale(settingsConfig: MarketingEmailSettingsConfigInput, now = Date.now()) {
  if (settingsConfig.deliveryStatus !== 'PROCESSING' || !settingsConfig.processingStartedAt) {
    return false;
  }

  const startedAt = new Date(settingsConfig.processingStartedAt).getTime();
  return Number.isFinite(startedAt) && now - startedAt > DELIVERY_PROCESSING_TIMEOUT_MS;
}

function getProcessingRemainingMs(processingStartedAt: string, now = Date.now()) {
  const startedAt = new Date(processingStartedAt).getTime();
  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return startedAt + DELIVERY_PROCESSING_TIMEOUT_MS - now;
}

async function resolveMarketingEmailRecipients(
  targetConfig?: MarketingEmailTargetConfigInput | null,
): Promise<MarketingEmailRecipient[]> {
  const parsed = parseTargetConfig(targetConfig);

  if (parsed.audienceType === 'LISTS' && parsed.listIds.length > 0) {
    const members = await prisma.websiteRecipientListMember.findMany({
      where: {
        listId: { in: parsed.listIds },
      },
      select: {
        email: true,
        nome: true,
      },
      orderBy: [{ nome: 'asc' }, { email: 'asc' }],
    });

    const recipientsByEmail = new Map<string, MarketingEmailRecipient>();
    for (const member of members) {
      const email = member.email?.trim().toLowerCase();
      if (!email) continue;
      if (recipientsByEmail.has(email)) continue;
      recipientsByEmail.set(email, {
        email,
        nome: member.nome?.trim() || email,
      });
    }

    return Array.from(recipientsByEmail.values());
  }

  const contatos = await prisma.websitePopupLead.findMany({
    where: buildRecipientWhere(parsed),
    select: {
      email: true,
      nome: true,
    },
    orderBy: [{ nome: 'asc' }, { email: 'asc' }],
  });

  const recipientsByEmail = new Map<string, MarketingEmailRecipient>();
  for (const contato of contatos) {
    const email = contato.email?.trim().toLowerCase();
    if (!email) continue;
    if (recipientsByEmail.has(email)) continue;
    recipientsByEmail.set(email, {
      email,
      nome: contato.nome?.trim() || email,
    });
  }

  return Array.from(recipientsByEmail.values());
}

async function countRecipients(targetConfig?: MarketingEmailTargetConfigInput | null) {
  const parsed = parseTargetConfig(targetConfig);

  if (parsed.audienceType === 'LISTS' && parsed.listIds.length > 0) {
    const members = await prisma.websiteRecipientListMember.findMany({
      where: {
        listId: { in: parsed.listIds },
      },
      select: {
        email: true,
      },
    });

    return new Set(
      members
        .map((member) => member.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ).size;
  }

  const total = await prisma.websitePopupLead.count({
    where: buildRecipientWhere(parsed),
  });

  return total;
}

async function buildDetail(row: MarketingEmailDetailRow) {
  const senderConfig = await resolveDefaultSender(
    row.senderConfig as MarketingEmailSenderConfigInput | null | undefined,
  );

  const targetConfig = parseTargetConfig(
    row.targetConfig as Prisma.JsonValue | MarketingEmailTargetConfigInput | null | undefined,
  );
  const settingsConfig = parseSettingsConfig(
    row.settingsConfig as Prisma.JsonValue | MarketingEmailSettingsConfigInput | null | undefined,
  );
  const workflowStatus = getMarketingEmailWorkflowStatus({
    status: row.status,
    settingsConfig,
  });
  const deliveryReferenceAt = getMarketingEmailDeliveryReferenceAt(settingsConfig);

  return {
    ...row,
    senderConfig,
    targetConfig,
    settingsConfig,
    workflowStatus,
    deliveryReferenceAt,
    destinatariosEstimados: await countRecipients(targetConfig),
  };
}

function buildListItem(
  row: Prisma.WebsiteMarketingEmailGetPayload<{
    select: typeof marketingEmailListSelect;
  }>,
) {
  const settingsConfig = parseSettingsConfig(
    row.settingsConfig as Prisma.JsonValue | MarketingEmailSettingsConfigInput | null | undefined,
  );
  const workflowStatus = getMarketingEmailWorkflowStatus({
    status: row.status,
    settingsConfig,
  });
  const deliveryReferenceAt = getMarketingEmailDeliveryReferenceAt(settingsConfig);

  return {
    ...row,
    settingsConfig,
    workflowStatus,
    deliveryReferenceAt,
    criadoPor: row.CriadoPor
      ? {
          id: row.CriadoPor.id,
          nomeCompleto: row.CriadoPor.nomeCompleto,
          avatarUrl: row.CriadoPor.UsuariosInformation?.avatarUrl ?? null,
        }
      : null,
    atualizadoPor: row.AtualizadoPor
      ? {
          id: row.AtualizadoPor.id,
          nomeCompleto: row.AtualizadoPor.nomeCompleto,
          avatarUrl: row.AtualizadoPor.UsuariosInformation?.avatarUrl ?? null,
        }
      : null,
  };
}

function normalizePayload(
  input: CreateMarketingEmailInput | UpdateMarketingEmailInput,
  senderConfig: MarketingEmailSenderConfigInput,
  destinatariosEstimados: number,
) {
  const data: Prisma.WebsiteMarketingEmailUncheckedUpdateInput = {};

  if ('nome' in input && input.nome !== undefined) data.nome = input.nome;
  if ('status' in input && input.status !== undefined) data.status = input.status;
  if ('tipo' in input && input.tipo !== undefined) data.tipo = input.tipo;
  if ('assunto' in input) data.assunto = toNullableString(input.assunto);
  if ('previewText' in input) data.previewText = toNullableString(input.previewText);
  if ('templateSlug' in input) data.templateSlug = toNullableString(input.templateSlug);
  if ('htmlContent' in input) data.htmlContent = toNullableString(input.htmlContent);
  if ('contentConfig' in input && input.contentConfig !== undefined) {
    data.contentConfig = input.contentConfig === null ? Prisma.JsonNull : input.contentConfig;
  }
  if ('targetConfig' in input && input.targetConfig !== undefined) {
    data.targetConfig =
      input.targetConfig === null
        ? Prisma.JsonNull
        : (parseTargetConfig(input.targetConfig) as Prisma.InputJsonValue);
  }
  if ('senderConfig' in input && input.senderConfig !== undefined) {
    data.senderConfig =
      input.senderConfig === null ? Prisma.JsonNull : (senderConfig as Prisma.InputJsonValue);
  }
  if ('settingsConfig' in input && input.settingsConfig !== undefined) {
    data.settingsConfig =
      input.settingsConfig === null
        ? Prisma.JsonNull
        : (parseSettingsConfig(input.settingsConfig) as Prisma.InputJsonValue);
  }

  data.destinatariosEstimados = destinatariosEstimados;

  return data;
}

async function updateDeliverySettings(
  id: string,
  currentSettings: MarketingEmailSettingsConfigInput | null | undefined,
  patch: Partial<MarketingEmailSettingsConfigInput>,
) {
  const nextSettings = {
    ...parseSettingsConfig(currentSettings),
    ...patch,
  };

  await prisma.websiteMarketingEmail.update({
    where: { id },
    data: {
      settingsConfig: nextSettings as Prisma.InputJsonValue,
    },
  });

  return nextSettings;
}

async function failDeliveryProcessing(
  id: string,
  currentSettings: MarketingEmailSettingsConfigInput | null | undefined,
  reason: string,
) {
  return updateDeliverySettings(id, currentSettings, {
    deliveryStatus: 'FAILED',
    processingStartedAt: null,
    lastError: reason,
  });
}

async function dispatchMarketingEmail(emailId: string) {
  const email = await prisma.websiteMarketingEmail.findUnique({
    where: { id: emailId },
    select: marketingEmailDetailSelect,
  });

  if (!email) return;

  const settingsConfig = parseSettingsConfig(
    email.settingsConfig as Prisma.JsonValue | MarketingEmailSettingsConfigInput | null | undefined,
  );

  if (settingsConfig.deliveryStatus === 'SENT') {
    return;
  }

  const now = Date.now();
  const shouldRunNow = settingsConfig.deliveryMode === 'NOW' || isScheduledDue(settingsConfig, now);

  if (settingsConfig.deliveryStatus === 'PROCESSING' && isProcessingStale(settingsConfig, now)) {
    await failDeliveryProcessing(email.id, settingsConfig, DELIVERY_PROCESSING_TIMEOUT_MESSAGE);
    return;
  }

  if (!shouldRunNow) {
    return;
  }

  if (settingsConfig.deliveryStatus === 'PROCESSING') {
    return;
  }

  const processingStartedAt = new Date().toISOString();
  const nextSettings = await updateDeliverySettings(email.id, settingsConfig, {
    deliveryStatus: 'PROCESSING',
    processingStartedAt,
    lastError: null,
  });
  const processingTimedOut = () => getProcessingRemainingMs(processingStartedAt) <= 0;

  const recipients = await resolveMarketingEmailRecipients(
    parseTargetConfig(
      email.targetConfig as Prisma.JsonValue | MarketingEmailTargetConfigInput | null | undefined,
    ),
  );

  if (!recipients.length) {
    await failDeliveryProcessing(email.id, nextSettings, 'Nenhum destinatário válido para envio.');
    return;
  }

  const subject = email.assunto?.trim();
  const html = email.htmlContent?.trim() || buildHtmlFromContentConfig(email.contentConfig);

  if (!subject || !html) {
    await failDeliveryProcessing(email.id, nextSettings, 'Campanha sem assunto ou conteúdo HTML.');
    return;
  }

  const emailService = new EmailService();
  const text = stripHtml(html);
  const errors: string[] = [];
  let didTimeout = false;

  for (const chunk of chunkArray(recipients, 10)) {
    if (processingTimedOut()) {
      didTimeout = true;
      break;
    }

    const results = await Promise.all(
      chunk.map(async (recipient) => {
        const remainingMs = getProcessingRemainingMs(processingStartedAt);
        if (remainingMs <= 0) {
          didTimeout = true;
          return;
        }

        const result = await Promise.race([
          emailService.sendGeneric(recipient.email, recipient.nome, subject, html, text),
          new Promise<{ success: false; error: string }>((resolve) => {
            setTimeout(() => {
              resolve({
                success: false,
                error: DELIVERY_PROCESSING_TIMEOUT_MESSAGE,
              });
            }, remainingMs);
          }),
        ]);

        if (!result.success) {
          if (result.error === DELIVERY_PROCESSING_TIMEOUT_MESSAGE) {
            didTimeout = true;
          }
          errors.push(`${recipient.email}: ${result.error ?? 'Falha no envio'}`);
        }
      }),
    );

    void results;

    if (didTimeout) {
      break;
    }
  }

  if (didTimeout) {
    await failDeliveryProcessing(email.id, nextSettings, DELIVERY_PROCESSING_TIMEOUT_MESSAGE);
    return;
  }

  if (errors.length > 0) {
    deliveryLogger.error(
      {
        emailId: email.id,
        failedCount: errors.length,
      },
      'Falha parcial ou total no disparo da campanha',
    );
  }

  await updateDeliverySettings(email.id, nextSettings, {
    deliveryStatus: errors.length === 0 ? 'SENT' : 'FAILED',
    processingStartedAt: null,
    lastSentAt: errors.length === 0 ? new Date().toISOString() : null,
    lastError: errors.length > 0 ? errors.slice(0, 3).join(' | ') : null,
  });
}

function shouldQueueImmediateDelivery(input: {
  status?: string;
  settingsConfig?: MarketingEmailSettingsConfigInput | null;
}) {
  const settings = parseSettingsConfig(input.settingsConfig);
  return input.status === 'PUBLICADO' && settings.deliveryMode === 'NOW';
}

let marketingEmailDeliveryWorkerStarted = false;

export function startMarketingEmailDeliveryWorker() {
  if (marketingEmailDeliveryWorkerStarted) return;
  marketingEmailDeliveryWorkerStarted = true;

  cron.schedule(DELIVERY_CRON_SCHEDULE, async () => {
    const emails = await prisma.websiteMarketingEmail.findMany({
      where: {
        status: WebsiteStatus.PUBLICADO,
      },
      select: {
        id: true,
        settingsConfig: true,
      },
    });

    await Promise.all(
      emails.map(async (email) => {
        const settingsConfig = parseSettingsConfig(
          email.settingsConfig as
            | Prisma.JsonValue
            | MarketingEmailSettingsConfigInput
            | null
            | undefined,
        );

        if (
          settingsConfig.deliveryMode !== 'SCHEDULED' &&
          settingsConfig.deliveryStatus !== 'PROCESSING'
        ) {
          return;
        }

        if (!isScheduledDue(settingsConfig) && !isProcessingStale(settingsConfig)) {
          return;
        }

        try {
          if (isProcessingStale(settingsConfig)) {
            await failDeliveryProcessing(
              email.id,
              settingsConfig,
              DELIVERY_PROCESSING_TIMEOUT_MESSAGE,
            );
            return;
          }

          await dispatchMarketingEmail(email.id);
        } catch (error) {
          deliveryLogger.error(
            {
              err: error,
              emailId: email.id,
            },
            'Erro ao processar campanha agendada',
          );
        }
      }),
    );
  });

  deliveryLogger.info(
    { schedule: DELIVERY_CRON_SCHEDULE },
    'Worker de envio de campanhas iniciado',
  );
}

export const websiteEmailsMarketingService = {
  async list(query: ListMarketingEmailsQuery) {
    const where: Prisma.WebsiteMarketingEmailWhereInput = {};

    if (query.status) where.status = query.status as WebsiteStatus;
    if (query.tipo) where.tipo = query.tipo as WebsiteMarketingEmailTipo;
    if (query.actorId) where.atualizadoPorId = query.actorId;
    if (query.workflowStatus === 'RASCUNHO') {
      where.status = WebsiteStatus.RASCUNHO;
    } else if (query.workflowStatus) {
      where.status = WebsiteStatus.PUBLICADO;
    }
    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { assunto: { contains: query.search, mode: 'insensitive' } },
        { previewText: { contains: query.search, mode: 'insensitive' } },
        { templateSlug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const needsComputedFiltering = Boolean(
      (query.workflowStatus && query.workflowStatus !== 'RASCUNHO') ||
        query.sentFrom ||
        query.sentTo,
    );

    if (!needsComputedFiltering) {
      const skip = (query.page - 1) * query.pageSize;
      const [total, emails] = await Promise.all([
        prisma.websiteMarketingEmail.count({ where }),
        prisma.websiteMarketingEmail.findMany({
          where,
          skip,
          take: query.pageSize,
          orderBy: { atualizadoEm: 'desc' },
          select: marketingEmailListSelect,
        }),
      ]);

      return {
        emails: emails.map(buildListItem),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      };
    }

    const candidates = await prisma.websiteMarketingEmail.findMany({
      where,
      orderBy: { atualizadoEm: 'desc' },
      select: marketingEmailListSelect,
    });

    const filtered = candidates.map(buildListItem).filter((email) => {
      if (query.workflowStatus && email.workflowStatus !== query.workflowStatus) {
        return false;
      }

      return isWithinIsoRange(email.deliveryReferenceAt, query.sentFrom, query.sentTo);
    });

    const total = filtered.length;
    const skip = (query.page - 1) * query.pageSize;
    const emails = filtered.slice(skip, skip + query.pageSize);

    return {
      emails,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  },

  async get(id: string) {
    const email = await prisma.websiteMarketingEmail.findUnique({
      where: { id },
      select: marketingEmailDetailSelect,
    });

    if (!email) return null;
    return buildDetail(email);
  },

  async getFilterOptions(): Promise<MarketingEmailFilterOptionsResponse> {
    const rows = await prisma.websiteMarketingEmail.findMany({
      where: {
        atualizadoPorId: { not: null },
      },
      select: {
        atualizadoPorId: true,
        AtualizadoPor: {
          select: {
            id: true,
            nomeCompleto: true,
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        atualizadoEm: 'desc',
      },
    });

    const users = new Map<string, { id: string; nomeCompleto: string; avatarUrl: string | null }>();

    for (const row of rows) {
      if (!row.AtualizadoPor?.id) continue;
      if (users.has(row.AtualizadoPor.id)) continue;

      users.set(row.AtualizadoPor.id, {
        id: row.AtualizadoPor.id,
        nomeCompleto: row.AtualizadoPor.nomeCompleto,
        avatarUrl: row.AtualizadoPor.UsuariosInformation?.avatarUrl ?? null,
      });
    }

    return {
      users: Array.from(users.values()).sort((a, b) =>
        a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'),
      ),
    };
  },

  async getRecipientOptions(): Promise<RecipientOptionsResponse> {
    const [brevoSender, contatos, lists] = await Promise.all([
      resolveDefaultSender(),
      prisma.websitePopupLead.findMany({
        where: {
          removidoEm: null,
          email: { not: null },
        },
        select: leadRecipientSelect,
        orderBy: [{ nome: 'asc' }, { email: 'asc' }],
        take: 500,
      }),
      prisma.websiteRecipientList.findMany({
        where: {
          status: WebsiteRecipientListStatus.ATIVA,
        },
        select: {
          id: true,
          nome: true,
          recipientCount: true,
          Folder: {
            select: {
              nome: true,
            },
          },
        },
        orderBy: [{ nome: 'asc' }],
      }),
    ]);

    return {
      sender: brevoSender,
      contatos: contatos.map((contato: LeadRecipientRow) => ({
        id: contato.id,
        nome: contato.nome?.trim() || contato.email || 'Contato sem nome',
        email: contato.email,
        status: contato.status,
        tag: contato.tag,
      })),
      lists: lists.map((list) => ({
        id: list.id,
        nome: list.nome,
        folderName: list.Folder?.nome ?? null,
        recipientCount: list.recipientCount,
      })),
    };
  },

  async create(input: CreateMarketingEmailInput, actorId?: string | null) {
    const senderConfig = await resolveDefaultSender(input.senderConfig ?? null);
    const destinatariosEstimados = await countRecipients(input.targetConfig ?? null);

    const created = await prisma.websiteMarketingEmail.create({
      data: {
        nome: input.nome,
        status: input.status,
        tipo: input.tipo,
        assunto: toNullableString(input.assunto),
        previewText: toNullableString(input.previewText),
        templateSlug: toNullableString(input.templateSlug),
        htmlContent: toNullableString(input.htmlContent),
        contentConfig: input.contentConfig ?? Prisma.JsonNull,
        targetConfig: input.targetConfig
          ? (parseTargetConfig(input.targetConfig) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        senderConfig: senderConfig as Prisma.InputJsonValue,
        settingsConfig: input.settingsConfig
          ? (parseSettingsConfig(input.settingsConfig) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        destinatariosEstimados,
        criadoPorId: actorId ?? null,
        atualizadoPorId: actorId ?? null,
      },
      select: marketingEmailDetailSelect,
    });

    await invalidateCacheByPrefix(CACHE_PREFIX);
    if (shouldQueueImmediateDelivery(input)) {
      setImmediate(() => {
        void dispatchMarketingEmail(created.id).catch((error) => {
          deliveryLogger.error(
            { err: error, emailId: created.id },
            'Erro no envio imediato da campanha',
          );
        });
      });
    }
    return buildDetail(created);
  },

  async update(id: string, input: UpdateMarketingEmailInput, actorId?: string | null) {
    const existing = await prisma.websiteMarketingEmail.findUnique({
      where: { id },
      select: marketingEmailDetailSelect,
    });

    if (!existing) throw createNotFoundError();
    if (hasCampaignBeenSent(existing.settingsConfig)) {
      throw createSentCampaignLockedError('editar');
    }

    const nextSender = await resolveDefaultSender(
      (input.senderConfig as MarketingEmailSenderConfigInput | null | undefined) ??
        (existing.senderConfig as MarketingEmailSenderConfigInput | null | undefined) ??
        null,
    );

    const nextTarget = parseTargetConfig(
      (input.targetConfig as MarketingEmailTargetConfigInput | null | undefined) ??
        (existing.targetConfig as MarketingEmailTargetConfigInput | null | undefined) ??
        null,
    );

    const destinatariosEstimados = await countRecipients(nextTarget);

    const updated = await prisma.websiteMarketingEmail.update({
      where: { id },
      data: {
        ...normalizePayload(input, nextSender, destinatariosEstimados),
        atualizadoPorId: actorId ?? null,
      },
      select: marketingEmailDetailSelect,
    });

    await invalidateCacheByPrefix(CACHE_PREFIX);
    if (
      shouldQueueImmediateDelivery({
        status: updated.status,
        settingsConfig:
          (input.settingsConfig as MarketingEmailSettingsConfigInput | null | undefined) ??
          (updated.settingsConfig as MarketingEmailSettingsConfigInput | null | undefined) ??
          null,
      })
    ) {
      setImmediate(() => {
        void dispatchMarketingEmail(updated.id).catch((error) => {
          deliveryLogger.error(
            { err: error, emailId: updated.id },
            'Erro no envio imediato da campanha',
          );
        });
      });
    }
    return buildDetail(updated);
  },

  async remove(id: string) {
    const existing = await prisma.websiteMarketingEmail.findUnique({
      where: { id },
      select: { id: true, settingsConfig: true },
    });

    if (!existing) throw createNotFoundError();
    if (hasCampaignBeenSent(existing.settingsConfig)) {
      throw createSentCampaignLockedError('excluir');
    }

    await prisma.websiteMarketingEmail.delete({ where: { id } });
    await invalidateCacheByPrefix(CACHE_PREFIX);
  },
};

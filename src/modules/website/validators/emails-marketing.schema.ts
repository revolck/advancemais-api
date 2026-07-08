import { z } from 'zod';

export const marketingEmailStatusSchema = z.enum(['PUBLICADO', 'RASCUNHO']);
export const marketingEmailWorkflowStatusSchema = z.enum([
  'RASCUNHO',
  'PROCESSANDO',
  'FALHOU',
  'AGENDADO',
  'ENVIADO',
]);
export const marketingEmailTipoSchema = z.enum(['CAMPANHA', 'NEWSLETTER', 'COMUNICADO']);
export const marketingEmailModeSchema = z.enum(['REGULAR']);
export const marketingEmailAudienceTypeSchema = z.enum([
  'ALL_CONTACTS',
  'MANUAL_CONTACTS',
  'LISTS',
]);
export const marketingEmailDeliveryModeSchema = z.enum(['NOW', 'SCHEDULED']);
export const marketingEmailDeliveryStatusSchema = z.enum(['IDLE', 'PROCESSING', 'SENT', 'FAILED']);

const normalizedStringSchema = (max: number) =>
  z
    .preprocess((value) => {
      if (value === null || value === undefined) return null;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : null;
    }, z.string().trim().max(max).nullable())
    .optional();

const stringArraySchema = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).default([]);

export const marketingEmailSenderConfigSchema = z.object({
  fromEmail: z.string().trim().email().max(255),
  fromName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
});

export const marketingEmailTargetConfigSchema = z
  .object({
    mode: marketingEmailModeSchema.default('REGULAR'),
    audienceType: marketingEmailAudienceTypeSchema.default('ALL_CONTACTS'),
    contactIds: stringArraySchema(1000, 80),
    listIds: stringArraySchema(100, 80),
  })
  .superRefine((value, ctx) => {
    if (value.audienceType === 'MANUAL_CONTACTS' && value.contactIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactIds'],
        message: 'Selecione ao menos um contato manualmente.',
      });
    }

    if (value.audienceType === 'LISTS' && value.listIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['listIds'],
        message: 'Selecione ao menos uma lista salva.',
      });
    }
  });

export const marketingEmailSettingsConfigSchema = z
  .object({
    language: normalizedStringSchema(10),
    replyToEmail: normalizedStringSchema(255),
    trackOpens: z.boolean().default(true),
    trackClicks: z.boolean().default(true),
    googleAnalyticsCampaign: normalizedStringSchema(120),
    notes: normalizedStringSchema(500),
    deliveryMode: marketingEmailDeliveryModeSchema.default('NOW'),
    scheduledAt: normalizedStringSchema(255),
    deliveryStatus: marketingEmailDeliveryStatusSchema.default('IDLE'),
    processingStartedAt: normalizedStringSchema(255),
    lastSentAt: normalizedStringSchema(255),
    lastError: normalizedStringSchema(500),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryMode !== 'SCHEDULED') return;

    if (!value.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'Informe data e hora para o envio agendado.',
      });
      return;
    }

    const scheduledAt = new Date(value.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'Informe uma data de envio válida.',
      });
    }
  });

const marketingEmailBaseSchema = z.object({
  nome: z.string().trim().min(1).max(100).default('Novo e-mail'),
  status: marketingEmailStatusSchema.default('RASCUNHO'),
  tipo: marketingEmailTipoSchema.default('CAMPANHA'),
  assunto: normalizedStringSchema(180),
  previewText: normalizedStringSchema(255),
  templateSlug: normalizedStringSchema(80),
  htmlContent: normalizedStringSchema(100000),
  contentConfig: z.record(z.any()).optional().nullable(),
  targetConfig: marketingEmailTargetConfigSchema.optional().nullable(),
  senderConfig: marketingEmailSenderConfigSchema.optional().nullable(),
  settingsConfig: marketingEmailSettingsConfigSchema.optional().nullable(),
  destinatariosEstimados: z.coerce.number().int().min(0).max(100000000).optional(),
});

export const createMarketingEmailSchema = marketingEmailBaseSchema;

export const updateMarketingEmailSchema = marketingEmailBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualização.',
  });

export const listMarketingEmailsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().max(120).optional(),
  status: marketingEmailStatusSchema.optional(),
  workflowStatus: marketingEmailWorkflowStatusSchema.optional(),
  tipo: marketingEmailTipoSchema.optional(),
  actorId: z.string().trim().max(80).optional(),
  sentFrom: z.string().datetime({ offset: true }).optional(),
  sentTo: z.string().datetime({ offset: true }).optional(),
});

export type CreateMarketingEmailInput = z.infer<typeof createMarketingEmailSchema>;
export type UpdateMarketingEmailInput = z.infer<typeof updateMarketingEmailSchema>;
export type ListMarketingEmailsQuery = z.infer<typeof listMarketingEmailsQuerySchema>;
export type MarketingEmailSenderConfigInput = z.infer<typeof marketingEmailSenderConfigSchema>;
export type MarketingEmailTargetConfigInput = z.infer<typeof marketingEmailTargetConfigSchema>;
export type MarketingEmailSettingsConfigInput = z.infer<typeof marketingEmailSettingsConfigSchema>;

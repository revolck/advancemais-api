import { z } from 'zod';

const normalizedStringSchema = (max: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }, z.string().trim().max(max).nullable());

const optionalDateQuerySchema = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.coerce.date().optional());

export const recipientListStatusSchema = z.enum(['ATIVA', 'ARQUIVADA']);
export const recipientListMembershipModeSchema = z.enum(['MANUAL', 'DINAMICA', 'HIBRIDA']);
export const recipientListRecipientKindSchema = z.enum(['MARKETING_LEAD', 'USUARIO']);
export const recipientListLogicOperatorSchema = z.enum(['AND', 'OR']);
export const recipientListConditionOperatorSchema = z.enum([
  'IS',
  'IS_NOT',
  'IN',
  'NOT_IN',
  'EXISTS',
  'NOT_EXISTS',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'BETWEEN',
  'HAS_ANY',
  'HAS_ALL',
]);

export const recipientListConditionFieldSchema = z.enum([
  'recipient.base.kind',
  'recipient.user.role',
  'recipient.user.status',
  'lead.popupId',
  'lead.status',
  'lead.tag',
  'lead.captureDate',
  'lead.ownerUsuarioId',
  'student.hasResume',
  'student.resumeCount',
  'student.hasEnrollment',
  'student.courseId',
  'student.enrollmentDate',
  'student.enrollmentStatus',
  'student.hasCertificate',
  'student.turmaId',
  'company.hasPlan',
  'company.planId',
  'company.hasVacancies',
  'company.vacancyStatus',
  'company.vacancyCount',
  'instructor.courseId',
  'instructor.turmaId',
  'instructor.assignmentCount',
]);

export const recipientReferenceSchema = z.object({
  recipientKind: recipientListRecipientKindSchema,
  recipientId: z.string().trim().min(1).max(80),
});

export const recipientListConditionSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  field: recipientListConditionFieldSchema,
  operator: recipientListConditionOperatorSchema,
  value: z.any().optional(),
  valueTo: z.any().optional(),
});

export const recipientListRulesGroupSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    operator: recipientListLogicOperatorSchema.default('AND'),
    conditions: z.array(recipientListConditionSchema).default([]),
    groups: z.array(recipientListRulesGroupSchema).default([]),
  }),
);

export const recipientListFolderSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  ordem: z.coerce.number().int().min(0).max(9999).default(0),
});

export const listRecipientListFoldersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const createRecipientListFolderSchema = recipientListFolderSchema;

export const updateRecipientListFolderSchema = recipientListFolderSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualização.',
  });

export const listRecipientListsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  search: z.string().trim().max(160).optional(),
  folderId: z.string().trim().max(80).optional(),
  status: recipientListStatusSchema.optional(),
  membershipMode: recipientListMembershipModeSchema.optional(),
  updatedFrom: optionalDateQuerySchema,
  updatedTo: optionalDateQuerySchema,
});

export const recipientListStatusesQuerySchema = z.object({
  listIds: z.preprocess(
    (value) => {
      if (Array.isArray(value)) return value;
      if (value === null || value === undefined) return [];
      return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    },
    z.array(z.string().trim().min(1).max(80)).max(50),
  ),
});

export const createRecipientListSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  descricao: normalizedStringSchema(500).optional(),
  folderId: normalizedStringSchema(80).optional(),
  status: recipientListStatusSchema.default('ATIVA'),
  membershipMode: recipientListMembershipModeSchema.default('DINAMICA'),
  rulesConfig: recipientListRulesGroupSchema.nullable().optional(),
  manualIncludes: z.array(recipientReferenceSchema).max(5000).default([]),
  manualExcludes: z.array(recipientReferenceSchema).max(5000).default([]),
});

export const updateRecipientListSchema = createRecipientListSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe pelo menos um campo para atualização.',
  });

export const recipientListRecipientsOptionsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  kind: z.enum(['ALL', 'MARKETING_LEAD', 'USUARIO']).default('ALL'),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type RecipientListRulesGroupInput = z.infer<typeof recipientListRulesGroupSchema>;
export type RecipientListConditionInput = z.infer<typeof recipientListConditionSchema>;
export type RecipientReferenceInput = z.infer<typeof recipientReferenceSchema>;
export type CreateRecipientListInput = z.infer<typeof createRecipientListSchema>;
export type UpdateRecipientListInput = z.infer<typeof updateRecipientListSchema>;
export type ListRecipientListsQuery = z.infer<typeof listRecipientListsQuerySchema>;
export type RecipientListStatusesQuery = z.infer<typeof recipientListStatusesQuerySchema>;
export type ListRecipientListFoldersQuery = z.infer<typeof listRecipientListFoldersQuerySchema>;
export type CreateRecipientListFolderInput = z.infer<typeof createRecipientListFolderSchema>;
export type UpdateRecipientListFolderInput = z.infer<typeof updateRecipientListFolderSchema>;
export type RecipientListRecipientsOptionsQuery = z.infer<
  typeof recipientListRecipientsOptionsQuerySchema
>;

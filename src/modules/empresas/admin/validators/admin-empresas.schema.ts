import {
  EmpresasPlanoModo,
  MotivosDeBloqueios,
  Status,
  StatusDeVagas,
  TiposDeBloqueios,
} from '@prisma/client';
import { z } from 'zod';

import { clientePlanoModoSchema } from '@/modules/empresas/clientes/validators/clientes.schema';

const uuidSchema = z.string().uuid('Informe um identificador válido');

const nullableString = z
  .string()
  .trim()
  .min(1, 'Informe um valor válido')
  .max(255, 'Valor muito longo');

const securePasswordSchema = z
  .string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres')
  .max(255, 'Senha muito longa');

const optionalSecurePassword = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length < 8) {
    return undefined;
  }

  return trimmed;
}, securePasswordSchema.optional());

const nullableUrl = z.string().trim().url('Informe uma URL válida').max(500, 'URL muito longa');

const socialLinksSchema = z
  .object({
    instagram: nullableString.optional().nullable(),
    linkedin: nullableString.optional().nullable(),
    facebook: nullableString.optional().nullable(),
    youtube: nullableString.optional().nullable(),
    twitter: nullableString.optional().nullable(),
    tiktok: nullableString.optional().nullable(),
  })
  .partial();

const diasTesteSchema = z
  .number({ invalid_type_error: 'Informe um número de dias válido' })
  .int('Informe um número inteiro de dias')
  .positive('Dias de teste deve ser maior que zero')
  .max(365, 'Máximo de 365 dias');

const adminEmpresasPlanoBase = z.object({
  planosEmpresariaisId: uuidSchema,
  modo: clientePlanoModoSchema,
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  diasTeste: diasTesteSchema.optional(),
});

export const adminEmpresasPlanoSchema = adminEmpresasPlanoBase.refine(
  (val) => (val.modo !== EmpresasPlanoModo.TESTE ? true : typeof val.diasTeste === 'number'),
  { message: 'Informe diasTeste para o modo teste', path: ['diasTeste'] },
);

export type AdminEmpresasPlanoInput = z.infer<typeof adminEmpresasPlanoSchema>;

export const adminEmpresasPlanoUpdateSchema = adminEmpresasPlanoBase
  .extend({ resetPeriodo: z.boolean().optional() })
  .refine((val) => (val.modo !== EmpresasPlanoModo.TESTE ? true : typeof val.diasTeste === 'number'), {
    message: 'Informe diasTeste para o modo teste',
    path: ['diasTeste'],
  });

export type AdminEmpresasPlanoUpdateInput = z.infer<typeof adminEmpresasPlanoUpdateSchema>;

export const adminEmpresasCreateSchema = z.object({
  nome: z
    .string({ required_error: 'Nome é obrigatório' })
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(255, 'Nome muito longo'),
  email: z
    .string({ required_error: 'E-mail é obrigatório' })
    .trim()
    .toLowerCase()
    .email('Informe um e-mail válido'),
  telefone: z
    .string({ required_error: 'Telefone é obrigatório' })
    .trim()
    .min(10, 'Informe um telefone válido')
    .max(20, 'Telefone muito longo'),
  senha: optionalSecurePassword,
  supabaseId: z
    .string({ required_error: 'Supabase ID é obrigatório' })
    .trim()
    .min(1, 'Supabase ID é obrigatório')
    .max(255, 'Supabase ID muito longo'),
  cnpj: z
    .string({ required_error: 'CNPJ é obrigatório' })
    .trim()
    .min(14, 'CNPJ deve ter 14 dígitos')
    .max(18, 'CNPJ muito longo'),
  cidade: nullableString.optional(),
  estado: nullableString.optional(),
  descricao: z.string().trim().max(500, 'Descrição muito longa').optional(),
  instagram: nullableString.optional(),
  linkedin: nullableString.optional(),
  facebook: nullableString.optional(),
  youtube: nullableString.optional(),
  twitter: nullableString.optional(),
  tiktok: nullableString.optional(),
  socialLinks: socialLinksSchema.optional(),
  avatarUrl: nullableUrl.optional(),
  aceitarTermos: z.boolean().optional(),
  status: z.nativeEnum(Status).optional(),
  plano: adminEmpresasPlanoSchema.optional(),
});

export type AdminEmpresasCreateInput = z.infer<typeof adminEmpresasCreateSchema>;

export const adminEmpresasUpdateSchema = z
  .object({
    nome: nullableString.optional(),
    email: z.string().trim().toLowerCase().email('Informe um e-mail válido').optional(),
    telefone: z.string().trim().min(10, 'Informe um telefone válido').max(20).optional(),
    cnpj: z.string().trim().min(14, 'CNPJ deve ter 14 dígitos').max(18).optional().nullable(),
    cidade: nullableString.optional().nullable(),
    estado: nullableString.optional().nullable(),
    descricao: z.string().trim().max(500, 'Descrição muito longa').optional().nullable(),
    instagram: nullableString.optional().nullable(),
    linkedin: nullableString.optional().nullable(),
    facebook: nullableString.optional().nullable(),
    youtube: nullableString.optional().nullable(),
    twitter: nullableString.optional().nullable(),
    tiktok: nullableString.optional().nullable(),
    socialLinks: socialLinksSchema.optional().nullable(),
    avatarUrl: nullableUrl.optional().nullable(),
    status: z.nativeEnum(Status).optional(),
    plano: adminEmpresasPlanoUpdateSchema.optional().nullable(),
  })
  .refine(
    (values) =>
      Object.values({ ...values, plano: undefined }).some((value) => value !== undefined) ||
      values.plano !== undefined,
    {
      message: 'Informe ao menos um campo para atualização',
      path: [],
    },
  );

export type AdminEmpresasUpdateInput = z.infer<typeof adminEmpresasUpdateSchema>;

export const adminEmpresasListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    search: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : value))
      .refine((value) => value === undefined || value.length >= 3, {
        message: 'A busca deve conter pelo menos 3 caracteres',
      })
      .optional(),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
    search: values.search,
  }));

export type AdminEmpresasListQuery = z.infer<typeof adminEmpresasListQuerySchema>;

export const adminEmpresasDashboardListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    search: z
      .string()
      .trim()
      .transform((value) => (value.length === 0 ? undefined : value))
      .refine((value) => value === undefined || value.length >= 3, {
        message: 'A busca deve conter pelo menos 3 caracteres',
      })
      .optional(),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: 10,
    search: values.search,
  }));

export type AdminEmpresasDashboardListQuery = z.infer<
  typeof adminEmpresasDashboardListQuerySchema
>;

export const adminEmpresasIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminEmpresasIdParam = z.infer<typeof adminEmpresasIdParamSchema>;

const paginationQueryBaseSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const withDefaultPaginationValues = <T extends { page?: number; pageSize?: number }>(values: T) =>
  ({
    ...values,
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
  }) as Omit<T, 'page' | 'pageSize'> & { page: number; pageSize: number };

const paginationQuerySchema = paginationQueryBaseSchema.transform((values) =>
  withDefaultPaginationValues(values),
);

export const adminEmpresasHistoryQuerySchema = paginationQuerySchema;
export type AdminEmpresasHistoryQuery = z.infer<typeof adminEmpresasHistoryQuerySchema>;

const statusArraySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined;

    const list = Array.isArray(value) ? value.flatMap((item) => item.split(',')) : value.split(',');

    const normalized = list
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0);
    return normalized.length > 0 ? normalized : undefined;
  })
  .refine(
    (value) =>
      value === undefined ||
      value.every((status) =>
        Object.prototype.hasOwnProperty.call(StatusDeVagas, status as StatusDeVagas),
      ),
    {
      message:
        'Informe status válidos (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, ENCERRADA ou EXPIRADO)',
    },
  )
  .transform((value) => value?.map((status) => status as StatusDeVagas));

export const adminEmpresasVagasQuerySchema = paginationQueryBaseSchema
  .extend({
    status: statusArraySchema,
  })
  .transform((values) => withDefaultPaginationValues(values));

export type AdminEmpresasVagasQuery = z.infer<typeof adminEmpresasVagasQuerySchema>;

export const adminEmpresasBloqueioSchema = z
  .object({
    tipo: z.nativeEnum(TiposDeBloqueios, { required_error: 'Tipo de bloqueio é obrigatório' }),
    motivo: z.nativeEnum(MotivosDeBloqueios, {
      required_error: 'Motivo do bloqueio é obrigatório',
    }),
    dias: z.coerce
      .number()
      .int()
      .min(1, 'Informe pelo menos 1 dia de bloqueio')
      .max(3650, 'Bloqueio temporário deve ter no máximo 10 anos')
      .describe('Quantidade de dias para bloqueio temporário')
      .optional(),
    observacoes: z
      .string()
      .trim()
      .min(3, 'Informe observações com pelo menos 3 caracteres')
      .max(500, 'Observações devem ter no máximo 500 caracteres')
      .optional(),
  })
  .refine(
    (values) =>
      values.tipo !== TiposDeBloqueios.TEMPORARIO ||
      (values.dias !== undefined && Number.isFinite(values.dias) && values.dias > 0),
    {
      message: 'Informe a quantidade de dias para bloqueios temporários',
      path: ['dias'],
    },
  );

export type AdminEmpresasBloqueioInput = z.infer<typeof adminEmpresasBloqueioSchema>;

export const adminEmpresasVagaParamSchema = adminEmpresasIdParamSchema.extend({
  vagaId: z.string().uuid(),
});

export type AdminEmpresasVagaParam = z.infer<typeof adminEmpresasVagaParamSchema>;

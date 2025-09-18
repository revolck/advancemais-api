import { Status, StatusVaga } from '@prisma/client';
import { z } from 'zod';

import { clientePlanoTipoSchema } from '@/modules/empresas/clientes/validators/clientes.schema';

const uuidSchema = z.string().uuid('Informe um identificador válido');

const nullableString = z
  .string()
  .trim()
  .min(1, 'Informe um valor válido')
  .max(255, 'Valor muito longo');

const nullableUrl = z
  .string()
  .trim()
  .url('Informe uma URL válida')
  .max(500, 'URL muito longa');

const observacaoSchema = z
  .string()
  .trim()
  .min(1, 'A observação não pode estar vazia')
  .max(500, 'A observação deve ter no máximo 500 caracteres');

export const adminEmpresasPlanoSchema = z.object({
  planoEmpresarialId: uuidSchema,
  tipo: clientePlanoTipoSchema,
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  observacao: observacaoSchema.optional().nullable(),
});

export type AdminEmpresasPlanoInput = z.infer<typeof adminEmpresasPlanoSchema>;

export const adminEmpresasPlanoUpdateSchema = adminEmpresasPlanoSchema.extend({
  resetPeriodo: z.boolean().optional(),
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
  senha: z
    .string({ required_error: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(255, 'Senha muito longa'),
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
  descricao: z
    .string()
    .trim()
    .max(500, 'Descrição muito longa')
    .optional(),
  instagram: nullableString.optional(),
  linkedin: nullableString.optional(),
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

export const adminEmpresasIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminEmpresasIdParam = z.infer<typeof adminEmpresasIdParamSchema>;

const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
  }));

export const adminEmpresasHistoryQuerySchema = paginationQuerySchema;
export type AdminEmpresasHistoryQuery = z.infer<typeof adminEmpresasHistoryQuerySchema>;

const statusArraySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined;

    const list = Array.isArray(value)
      ? value.flatMap((item) => item.split(','))
      : value.split(',');

    const normalized = list
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0);
    return normalized.length > 0 ? normalized : undefined;
  })
  .refine(
    (value) =>
      value === undefined ||
      value.every((status) => Object.prototype.hasOwnProperty.call(StatusVaga, status as StatusVaga)),
    {
      message: 'Informe status válidos (RASCUNHO, EM_ANALISE, PUBLICADO ou EXPIRADO)',
    },
  )
  .transform((value) => value?.map((status) => status as StatusVaga));

export const adminEmpresasVagasQuerySchema = paginationQuerySchema.extend({
  status: statusArraySchema,
});

export type AdminEmpresasVagasQuery = z.infer<typeof adminEmpresasVagasQuerySchema>;

export const adminEmpresasBanSchema = z.object({
  dias: z.coerce.number().int().min(1, 'Informe pelo menos 1 dia de banimento').max(3650).describe('Quantidade de dias para banimento'),
  motivo: z
    .string()
    .trim()
    .min(3, 'Informe um motivo com pelo menos 3 caracteres')
    .max(500, 'Motivo deve ter no máximo 500 caracteres')
    .optional(),
});

export type AdminEmpresasBanInput = z.infer<typeof adminEmpresasBanSchema>;

export const adminEmpresasVagaParamSchema = adminEmpresasIdParamSchema.extend({
  vagaId: z.string().uuid(),
});

export type AdminEmpresasVagaParam = z.infer<typeof adminEmpresasVagaParamSchema>;

import { StatusDeVagas } from '@prisma/client';
import { z } from 'zod';

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
      value.every((status) => Object.prototype.hasOwnProperty.call(StatusDeVagas, status as StatusDeVagas)),
    {
      message:
        'Informe status válidos (RASCUNHO, EM_ANALISE, PUBLICADO, DESPUBLICADA, PAUSADA, ENCERRADA ou EXPIRADO)',
    },
  )
  .transform((value) => value?.map((status) => status as StatusDeVagas));

export const adminVagasListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: statusArraySchema,
    empresaId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    search: z
      .string()
      .optional()
      .transform((value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
    status: values.status,
    empresaId: values.empresaId,
    search: values.search,
  }));

export type AdminVagasListQuery = z.infer<typeof adminVagasListQuerySchema>;

export const adminVagaIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminVagaIdParam = z.infer<typeof adminVagaIdParamSchema>;

import { Status } from '@prisma/client';
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
      value.every((status) => Object.prototype.hasOwnProperty.call(Status, status as Status)),
    {
      message: 'Informe status válidos (ATIVO, INATIVO, BLOQUEADO, PENDENTE ou SUSPENSO)',
    },
  )
  .transform((value) => value?.map((status) => status as Status));

export const adminCandidatosListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: statusArraySchema,
    search: z
      .string()
      .optional()
      .transform((value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      })
      .refine((value) => !value || value.length >= 3, {
        message: 'Busca deve conter pelo menos 3 caracteres',
      }),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
    status: values.status,
    search: values.search,
  }));

export type AdminCandidatosListQuery = z.infer<typeof adminCandidatosListQuerySchema>;

export const adminCandidatoIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminCandidatoIdParam = z.infer<typeof adminCandidatoIdParamSchema>;

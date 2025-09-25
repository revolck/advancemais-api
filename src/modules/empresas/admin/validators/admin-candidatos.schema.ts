import { Status } from '@prisma/client';
import { z } from 'zod';

const statusSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const normalized = value.trim().toUpperCase();
    return normalized.length > 0 ? normalized : undefined;
  })
  .refine(
    (value) =>
      value === undefined || Object.prototype.hasOwnProperty.call(Status, value as Status),
    {
      message: 'Informe um status válido (ATIVO, INATIVO, BLOQUEADO, PENDENTE ou SUSPENSO)',
    },
  )
  .transform((value) => (value ? (value as Status) : undefined));

export const adminCandidatosListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    status: statusSchema,
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
    search: values.search,
  }));

export type AdminCandidatosListQuery = z.infer<typeof adminCandidatosListQuerySchema>;

export const adminCandidatosIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type AdminCandidatosIdParam = z.infer<typeof adminCandidatosIdParamSchema>;

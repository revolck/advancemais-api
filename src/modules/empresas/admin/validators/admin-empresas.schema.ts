import { z } from 'zod';

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

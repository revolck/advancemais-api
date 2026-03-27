import { z } from 'zod';

const monthReferenceRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const dashboardFinanceiroFiltersSchema = z
  .object({
    periodo: z.enum(['7d', '30d', '90d', '12m', 'month', 'custom']).default('30d'),
    mesReferencia: z
      .string()
      .regex(monthReferenceRegex, 'mesReferencia deve estar no formato YYYY-MM')
      .optional(),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    agruparPor: z.enum(['day', 'week', 'month']).optional(),
    timezone: z.string().trim().min(1).max(100).default('America/Maceio'),
    ultimasTransacoesLimit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .superRefine((value, ctx) => {
    if (value.periodo === 'custom') {
      if (!value.dataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'dataInicio é obrigatório quando periodo=custom',
        });
      }

      if (!value.dataFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'dataFim é obrigatório quando periodo=custom',
        });
      }
    }

    if (value.dataInicio && value.dataFim) {
      const start = new Date(value.dataInicio);
      const end = new Date(value.dataFim);

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'dataFim deve ser maior ou igual a dataInicio',
        });
      }
    }
  });

export type DashboardFinanceiroFilters = z.infer<typeof dashboardFinanceiroFiltersSchema>;

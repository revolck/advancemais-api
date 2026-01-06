import { z } from 'zod';

export const faturamentoQuerySchema = z.object({
  period: z
    .enum(['day', 'week', 'month', 'year', 'custom'], {
      errorMap: () => ({ message: 'Período deve ser: day, week, month, year ou custom' }),
    })
    .default('month'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD')
    .optional(),
  tz: z.string().default('America/Sao_Paulo'),
  top: z
    .string()
    .regex(/^\d+$/, 'Top deve ser um número')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(50))
    .default('10'),
});

export type FaturamentoQuery = z.infer<typeof faturamentoQuerySchema>;

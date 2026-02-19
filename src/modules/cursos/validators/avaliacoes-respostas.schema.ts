import { z } from 'zod';

const statusCorrecaoSchema = z.enum(['PENDENTE', 'CORRIGIDA']);
const orderBySchema = z.enum(['concluidoEm', 'alunoNome', 'nota']);
const orderSchema = z.enum(['asc', 'desc']);

const coercePositiveInt = (fallback: number, min = 1, max = 200) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .optional()
    .transform((value) => value ?? fallback);

export const listAvaliacaoRespostasQuerySchema = z.object({
  page: coercePositiveInt(1),
  pageSize: coercePositiveInt(10),
  search: z.string().trim().max(120).optional(),
  statusCorrecao: statusCorrecaoSchema.optional(),
  orderBy: orderBySchema.optional().default('concluidoEm'),
  order: orderSchema.optional().default('desc'),
});

export const listAvaliacaoHistoricoQuerySchema = z.object({
  avaliacaoId: z.string().uuid(),
  page: coercePositiveInt(1),
  pageSize: coercePositiveInt(10, 1, 200),
  tipo: z.string().trim().max(60).optional(),
  acao: z.string().trim().max(120).optional(),
  alteradoPor: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const corrigirAvaliacaoRespostaSchema = z.object({
  nota: z
    .number()
    .min(0)
    .max(10)
    .refine((value) => Math.round(value * 10) === value * 10, {
      message: 'nota deve ter no máximo 1 casa decimal',
    })
    .nullable()
    .optional(),
  feedback: z.string().trim().max(2000).nullable().optional(),
  statusCorrecao: statusCorrecaoSchema.optional().default('CORRIGIDA'),
});

export type ListAvaliacaoRespostasQuery = z.infer<typeof listAvaliacaoRespostasQuerySchema>;
export type ListAvaliacaoHistoricoQuery = z.infer<typeof listAvaliacaoHistoricoQuerySchema>;
export type CorrigirAvaliacaoRespostaInput = z.infer<typeof corrigirAvaliacaoRespostaSchema>;

import { z } from 'zod';

export const listarPagamentosSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  tipo: z.string().optional(),
  status: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  // Novos filtros
  metodo: z.string().optional(),
  planoId: z.string().uuid().optional(),
  valorMin: z.coerce.number().positive().optional(),
  valorMax: z.coerce.number().positive().optional(),
});

export type ListarPagamentosQuery = z.infer<typeof listarPagamentosSchema>;


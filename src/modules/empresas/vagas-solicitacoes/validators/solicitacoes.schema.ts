import { z } from 'zod';

/**
 * Schema para query params de listagem de solicitações
 */
export const solicitacoesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val.split(',').map((s) => s.trim().toUpperCase());
    }),
  empresaId: z.string().uuid().optional(),
  criadoDe: z.string().datetime().optional(),
  criadoAte: z.string().datetime().optional(),
  search: z.string().min(3).optional(),
});

export type SolicitacoesListQuery = z.infer<typeof solicitacoesListQuerySchema>;

/**
 * Schema para aprovar solicitação
 */
export const aprovarSolicitacaoSchema = z.object({
  observacoes: z.string().max(1000).optional(),
});

export type AprovarSolicitacaoInput = z.infer<typeof aprovarSolicitacaoSchema>;

/**
 * Schema para rejeitar solicitação
 */
export const rejeitarSolicitacaoSchema = z.object({
  motivoRejeicao: z.string().min(1).max(1000),
});

export type RejeitarSolicitacaoInput = z.infer<typeof rejeitarSolicitacaoSchema>;

/**
 * Schema para parâmetros de rota (ID)
 */
export const solicitacaoParamSchema = z.object({
  id: z.string().uuid(),
});

export type SolicitacaoParam = z.infer<typeof solicitacaoParamSchema>;

import { z } from 'zod';

/**
 * Schema para adicionar um novo cartão
 */
export const adicionarCartaoSchema = z.object({
  token: z
    .string()
    .min(1, 'Token do cartão é obrigatório')
    .describe('Token gerado pelo SDK do Mercado Pago'),
  isPadrao: z
    .boolean()
    .optional()
    .default(false)
    .describe('Define se este cartão será o padrão para cobranças automáticas'),
  tipo: z
    .enum(['credito', 'debito'])
    .optional()
    .default('credito')
    .describe('Tipo do cartão: crédito ou débito'),
});

export type AdicionarCartaoInput = z.infer<typeof adicionarCartaoSchema>;

import { z } from 'zod';
import { METODO_PAGAMENTO, MODELO_PAGAMENTO } from '@prisma/client';

export const startCheckoutSchema = z.object({
  usuarioId: z.string().uuid(),
  planoEmpresarialId: z.string().uuid(),
  metodoPagamento: z.nativeEnum(METODO_PAGAMENTO),
  modeloPagamento: z.nativeEnum(MODELO_PAGAMENTO).default('ASSINATURA'),
  successUrl: z.string().url().optional(),
  failureUrl: z.string().url().optional(),
  pendingUrl: z.string().url().optional(),
});

export const cancelSchema = z.object({
  usuarioId: z.string().uuid(),
  motivo: z.string().max(500).optional(),
});

export const changePlanSchema = z.object({
  usuarioId: z.string().uuid(),
  novoPlanoEmpresarialId: z.string().uuid(),
});

export const remindPaymentSchema = z.object({
  usuarioId: z.string().uuid(),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type RemindPaymentInput = z.infer<typeof remindPaymentSchema>;

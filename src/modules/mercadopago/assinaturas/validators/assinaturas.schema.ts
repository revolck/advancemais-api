import { z } from 'zod';
const checkoutMetodoSchema = z.enum(['pagamento', 'assinatura']);
const checkoutPagamentoSchema = z.enum(['pix', 'card', 'boleto']);

const cardDataSchema = z
  .object({
    token: z.string().min(10, 'Token do cartão inválido'),
    installments: z.number().int().positive().max(48).optional(),
  })
  .strict();

export const startCheckoutSchema = z
  .object({
    usuarioId: z.string().uuid(),
    planosEmpresariaisId: z.string().uuid(),
    metodo: checkoutMetodoSchema,
    pagamento: checkoutPagamentoSchema.optional(),
    card: cardDataSchema.optional(),
    successUrl: z.string().url().optional(),
    failureUrl: z.string().url().optional(),
    pendingUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.metodo === 'pagamento' && !data.pagamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagamento'],
        message: 'Informe o tipo de pagamento (pix, card ou boleto)',
      });
      return;
    }

    if (data.metodo === 'pagamento' && data.pagamento === 'card' && !data.card) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['card'],
        message: 'Dados do cartão são obrigatórios para pagamento com cartão',
      });
      return;
    }

    if (data.metodo === 'assinatura' && data.card && !data.pagamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagamento'],
        message: 'Informe o método de cobrança da assinatura',
      });
    }

    if (data.metodo === 'assinatura' && data.pagamento && data.pagamento !== 'card') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagamento'],
        message: 'Assinaturas utilizam cartão de crédito (preapproval)',
      });
    }
  });

export const cancelSchema = z.object({
  usuarioId: z.string().uuid(),
  motivo: z.string().max(500).optional(),
});

export const changePlanSchema = z.object({
  usuarioId: z.string().uuid(),
  novoPlanosEmpresariaisId: z.string().uuid(),
});

export const remindPaymentSchema = z.object({
  usuarioId: z.string().uuid(),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type RemindPaymentInput = z.infer<typeof remindPaymentSchema>;

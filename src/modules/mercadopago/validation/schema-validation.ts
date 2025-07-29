/**
 * Validações de schema usando Zod
 */

import { z } from "zod";

/**
 * Schema para validação de order
 */
export const orderSchema = z.object({
  type: z.enum(["online", "offline"]),
  processing_mode: z.enum(["automatic", "manual"]),
  total_amount: z.number().positive("Total amount deve ser positivo"),
  external_reference: z.string().optional(),
  notification_url: z.string().url().optional(),
  items: z
    .array(
      z.object({
        id: z.string().min(1, "ID do item é obrigatório"),
        title: z.string().min(1, "Título do item é obrigatório"),
        description: z.string().optional(),
        quantity: z.number().int().positive("Quantidade deve ser positiva"),
        unit_price: z.number().positive("Preço unitário deve ser positivo"),
        currency_id: z
          .string()
          .min(3, "Currency ID deve ter pelo menos 3 caracteres"),
      })
    )
    .min(1, "Pelo menos um item é obrigatório"),
  payments: z
    .array(
      z.object({
        payment_method_id: z.string().min(1, "Payment method ID é obrigatório"),
        payment_type_id: z.string().min(1, "Payment type ID é obrigatório"),
        token: z.string().optional(),
        installments: z.number().int().positive().optional(),
        payer: z.object({
          email: z.string().email("Email deve ser válido"),
          first_name: z.string().optional(),
          last_name: z.string().optional(),
          identification: z
            .object({
              type: z.enum(["CPF", "CNPJ"]),
              number: z.string().min(11, "Número de identificação inválido"),
            })
            .optional(),
        }),
      })
    )
    .min(1, "Pelo menos um pagamento é obrigatório"),
  capture: z.boolean().optional(),
  binary_mode: z.boolean().optional(),
});

/**
 * Schema para validação de assinatura
 */
export const subscriptionSchema = z.object({
  reason: z.string().min(1, "Reason é obrigatório"),
  external_reference: z.string().optional(),
  payer_email: z.string().email("Email do pagador deve ser válido"),
  card_token_id: z.string().optional(),
  auto_recurring: z.object({
    frequency: z.number().int().positive("Frequency deve ser positivo"),
    frequency_type: z.enum(["days", "months"]),
    transaction_amount: z
      .number()
      .positive("Transaction amount deve ser positivo"),
    currency_id: z
      .string()
      .min(3, "Currency ID deve ter pelo menos 3 caracteres"),
    repetitions: z.number().int().positive().optional(),
    debit_date: z.string().optional(),
    free_trial: z
      .object({
        frequency: z.number().int().positive(),
        frequency_type: z.enum(["days", "months"]),
      })
      .optional(),
  }),
  back_url: z.string().url().optional(),
  status: z.enum(["pending", "authorized", "paused", "cancelled"]).optional(),
});

/**
 * Schema para validação de webhook
 */
export const webhookSchema = z.object({
  id: z.string().min(1, "ID do webhook é obrigatório"),
  live_mode: z.boolean(),
  type: z.string().min(1, "Tipo do webhook é obrigatório"),
  date_created: z.string(),
  application_id: z.string(),
  user_id: z.string(),
  version: z.string(),
  api_version: z.string(),
  action: z.string().min(1, "Action é obrigatória"),
  data: z.object({
    id: z.string().min(1, "Data ID é obrigatório"),
  }),
});

/**
 * Funções de validação
 */
export const validateOrder = (data: unknown) => {
  return orderSchema.safeParse(data);
};

export const validateSubscription = (data: unknown) => {
  return subscriptionSchema.safeParse(data);
};

export const validateWebhook = (data: unknown) => {
  return webhookSchema.safeParse(data);
};

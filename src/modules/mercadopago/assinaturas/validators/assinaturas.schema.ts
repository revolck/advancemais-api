import { z } from 'zod';
const checkoutMetodoSchema = z.enum(['pagamento', 'assinatura']);
const checkoutPagamentoSchema = z.enum(['pix', 'card', 'boleto']);

const cardDataSchema = z
  .object({
    token: z.string().min(10, 'Token do cartão inválido'),
    installments: z.number().int().positive().max(48).optional(),
  })
  .strict();

// Schema para dados do pagador (obrigatório para PIX/Boleto)
const payerDataSchema = z
  .object({
    email: z.string().email('Email do pagador inválido').optional(),
    // Documento do pagador (CPF ou CNPJ) - obrigatório para PIX/Boleto
    identification: z
      .object({
        type: z.enum(['CPF', 'CNPJ']),
        number: z.string().min(11).max(14), // CPF: 11 dígitos, CNPJ: 14 dígitos (apenas números)
      })
      .optional(),
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    // Endereço - obrigatório para Boleto
    address: z
      .object({
        zip_code: z.string().min(8).max(9, 'CEP deve ter 8 ou 9 caracteres'),
        street_name: z.string().min(1, 'Logradouro é obrigatório'),
        street_number: z.string().min(1, 'Número é obrigatório'),
        neighborhood: z.string().min(1, 'Bairro é obrigatório'),
        city: z.string().min(1, 'Cidade é obrigatória'),
        federal_unit: z.string().length(2, 'Estado deve ter 2 caracteres (ex: SP)'),
      })
      .optional(),
    phone: z
      .object({
        area_code: z.string().min(2).max(3).optional(),
        number: z.string().min(8).max(9).optional(),
      })
      .optional(),
  })
  .optional();

export const startCheckoutSchema = z
  .object({
    usuarioId: z.string().uuid('usuarioId deve ser um UUID válido'),
    planosEmpresariaisId: z.string().uuid('planosEmpresariaisId deve ser um UUID válido'),
    metodo: checkoutMetodoSchema,
    pagamento: checkoutPagamentoSchema.optional(),
    card: cardDataSchema.optional(),
    // Dados do pagador (opcional, mas recomendado para PIX/Boleto)
    payer: payerDataSchema,
    cupomCodigo: z.string().min(3).max(40).optional(), // Código do cupom de desconto
    // Aceite de termos de contratação - OBRIGATÓRIO e deve ser true
    aceitouTermos: z.literal(true, {
      errorMap: () => ({
        message: 'É obrigatório aceitar os termos de contratação (aceitouTermos deve ser true)',
      }),
    }),
    aceitouTermosIp: z.string().max(45).optional(), // IP do usuário (opcional)
    aceitouTermosUserAgent: z.string().max(500).optional(), // User-Agent do navegador
    // URLs de retorno
    successUrl: z.string().url().optional(),
    failureUrl: z.string().url().optional(),
    pendingUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    // Validar método de pagamento
    if (data.metodo === 'pagamento' && !data.pagamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagamento'],
        message: 'Informe o tipo de pagamento (pix, card ou boleto) quando metodo="pagamento"',
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

    // Assinaturas só aceitam cartão de crédito
    if (data.metodo === 'assinatura' && data.pagamento && data.pagamento !== 'card') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pagamento'],
        message:
          'Assinaturas utilizam apenas cartão de crédito. Para PIX ou Boleto, use metodo="pagamento"',
      });
    }

    // Boleto exige endereço completo
    if (data.metodo === 'pagamento' && data.pagamento === 'boleto') {
      if (!data.payer?.address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payer.address'],
          message:
            'Endereço completo é obrigatório para pagamento via Boleto. Informe: zip_code, street_name, street_number, neighborhood, city e federal_unit',
        });
      } else {
        const addr = data.payer.address;
        if (
          !addr.zip_code ||
          !addr.street_name ||
          !addr.street_number ||
          !addr.neighborhood ||
          !addr.city ||
          !addr.federal_unit
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['payer.address'],
            message:
              'Endereço incompleto. Para Boleto, todos os campos são obrigatórios: zip_code, street_name, street_number, neighborhood, city e federal_unit',
          });
        }
      }
    }

    // PIX/Boleto exigem identificação
    if (data.metodo === 'pagamento' && (data.pagamento === 'pix' || data.pagamento === 'boleto')) {
      if (!data.payer?.identification?.number || !data.payer?.identification?.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payer.identification'],
          message:
            'CPF ou CNPJ do pagador é obrigatório para PIX/Boleto. Por favor, informe o documento do pagador.',
        });
      }
    }
  });

export const cancelSchema = z.object({
  usuarioId: z.string().uuid(),
  motivo: z.string().max(500).optional(),
});

export const changePlanSchema = z.object({
  usuarioId: z.string().uuid(),
  novoplanosEmpresariaisId: z.string().uuid(),
});

export const remindPaymentSchema = z.object({
  usuarioId: z.string().uuid(),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
export type RemindPaymentInput = z.infer<typeof remindPaymentSchema>;

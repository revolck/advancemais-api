import { z } from 'zod';

// Schema para dados do cartão
const cardDataSchema = z
  .object({
    token: z.string().min(10, 'Token do cartão inválido'),
    installments: z.number().int().positive().max(12).optional(),
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
        number: z.string().min(11).max(14), // CPF: 11 dígitos, CNPJ: 14 dígitos
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

/**
 * Schema de validação para checkout de curso
 *
 * DIFERENÇA IMPORTANTE:
 * - Cursos usam APENAS pagamento único (não há 'metodo: assinatura')
 * - Planos empresariais usam assinaturas recorrentes
 *
 * Métodos de pagamento:
 * - PIX: Pagamento instantâneo com QR Code
 * - Boleto: Pagamento com código de barras (vence em 3 dias)
 * - Cartão: Pagamento direto ou parcelado
 */
export const startCursoCheckoutSchema = z
  .object({
    usuarioId: z.string().uuid('usuarioId deve ser um UUID válido'),
    cursoId: z.string().uuid('cursoId deve ser um UUID válido'),
    turmaId: z.string().uuid('turmaId deve ser um UUID válido'),

    // Método de pagamento (SEMPRE pagamento único para cursos)
    pagamento: z.enum(['pix', 'card', 'boleto'], {
      errorMap: () => ({
        message: 'Método de pagamento deve ser: pix, card ou boleto',
      }),
    }),

    // Dados do cartão (obrigatório se pagamento = 'card')
    card: cardDataSchema.optional(),

    // Dados do pagador (opcional, mas recomendado para PIX/Boleto)
    payer: payerDataSchema,

    // Código do cupom de desconto (opcional)
    cupomCodigo: z.string().min(3).max(40).optional(),

    // Aceite de termos de contratação - OBRIGATÓRIO e deve ser true
    aceitouTermos: z.literal(true, {
      errorMap: () => ({
        message: 'É obrigatório aceitar os termos de uso e contratação',
      }),
    }),
    aceitouTermosIp: z.string().max(45).optional(), // IP do usuário (opcional)
    aceitouTermosUserAgent: z.string().max(500).optional(), // User-Agent do navegador

    // URLs de retorno (opcionais)
    successUrl: z.string().url().optional(),
    failureUrl: z.string().url().optional(),
    pendingUrl: z.string().url().optional(),
  })
  .superRefine((data, ctx) => {
    // Validar dados do cartão
    if (data.pagamento === 'card' && !data.card) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['card'],
        message: 'Dados do cartão são obrigatórios para pagamento com cartão',
      });
      return;
    }

    // Boleto exige endereço completo
    if (data.pagamento === 'boleto') {
      if (!data.payer?.address) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payer.address'],
          message:
            'Endereço completo é obrigatório para pagamento via Boleto. ' +
            'Informe: zip_code, street_name, street_number, neighborhood, city e federal_unit',
        });
        return;
      }

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
            'Endereço incompleto. Para Boleto, todos os campos são obrigatórios: ' +
            'zip_code, street_name, street_number, neighborhood, city e federal_unit',
        });
        return;
      }
    }

    // PIX/Boleto exigem identificação (CPF ou CNPJ)
    if (data.pagamento === 'pix' || data.pagamento === 'boleto') {
      if (!data.payer?.identification?.number || !data.payer?.identification?.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['payer.identification'],
          message:
            'CPF ou CNPJ do pagador é obrigatório para PIX/Boleto. ' +
            'Por favor, informe o documento do pagador no campo payer.identification.',
        });
      }
    }
  });

/**
 * Schema para validar token de acesso ao curso
 */
export const validarTokenAcessoSchema = z.object({
  token: z.string().min(20, 'Token inválido'),
});

/**
 * Schema para consultar status de pagamento
 */
export const consultarPagamentoSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID é obrigatório'),
});

// Tipos exportados
export type StartCursoCheckoutInput = z.infer<typeof startCursoCheckoutSchema>;
export type ValidarTokenAcessoInput = z.infer<typeof validarTokenAcessoSchema>;
export type ConsultarPagamentoInput = z.infer<typeof consultarPagamentoSchema>;

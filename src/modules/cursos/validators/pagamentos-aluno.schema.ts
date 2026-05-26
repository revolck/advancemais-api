import { z } from 'zod';

const parsePositiveInt = (fallback: number, maximum: number) =>
  z.preprocess(
    (value) => (value === undefined ? fallback : Number(value)),
    z.number().int().positive().max(maximum),
  );

const optionalMoney = z.preprocess(
  (value) => (value === undefined || value === '' ? undefined : Number(value)),
  z.number().nonnegative().optional(),
);

export const listMeusPagamentosQuerySchema = z.object({
  tab: z.enum(['pendentes', 'historico']).optional().default('historico'),
  page: parsePositiveInt(1, Number.MAX_SAFE_INTEGER),
  pageSize: parsePositiveInt(10, 100),
  status: z
    .enum(['PENDENTE', 'PROCESSANDO', 'APROVADO', 'RECUSADO', 'CANCELADO', 'ESTORNADO'])
    .optional(),
  metodo: z.string().trim().min(1).optional(),
  cursoId: z.string().trim().min(1).optional(),
  turmaId: z.string().trim().min(1).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  valorMin: optionalMoney,
  valorMax: optionalMoney,
});

const payerSchema = z
  .object({
    email: z.string().email(),
    identification: z.object({
      type: z.enum(['CPF', 'CNPJ']),
      number: z.string().min(11).max(18),
    }),
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    address: z
      .object({
        zip_code: z.string().min(8).max(9),
        street_name: z.string().min(1),
        street_number: z.union([z.string().min(1), z.number().nonnegative()]),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        federal_unit: z.string().length(2).optional(),
      })
      .optional(),
  })
  .optional();

export const checkoutRecuperacaoSchema = z
  .object({
    pagamento: z.enum(['pix', 'card', 'boleto']),
    payer: payerSchema,
    card: z
      .object({
        token: z.string().min(10),
        installments: z.number().int().positive().max(12).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.pagamento === 'card' && !data.card?.token) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['card'],
        message: 'Dados do cartao sao obrigatorios',
      });
    }
    if ((data.pagamento === 'pix' || data.pagamento === 'boleto') && !data.payer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payer'],
        message: 'Dados do pagador sao obrigatorios',
      });
    }
    if (
      data.pagamento === 'boleto' &&
      (!data.payer?.address?.neighborhood ||
        !data.payer.address.city ||
        !data.payer.address.federal_unit)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payer', 'address'],
        message: 'Endereco completo e obrigatorio para boleto',
      });
    }
  });

export const acessoRecuperacaoQuerySchema = z.object({
  inscricaoId: z.string().trim().min(1),
});

export type ListMeusPagamentosQuery = z.infer<typeof listMeusPagamentosQuerySchema>;
export type CheckoutRecuperacaoInput = z.infer<typeof checkoutRecuperacaoSchema>;

import { RefinementCtx, z } from 'zod';

const valorPlanoSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'O valor do plano deve ser um número positivo',
        });
        return z.NEVER;
      }
      return value.toFixed(2);
    }

    const sanitized = value.replace(/R\$/gi, '').replace(/\s+/g, '');

    if (!/^\d+(?:[.,]\d{1,2})?$/.test(sanitized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um valor monetário válido. Ex: 199.90 ou 199,90',
      });
      return z.NEVER;
    }

    const normalized = sanitized.replace(',', '.');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O valor do plano deve ser um número válido',
      });
      return z.NEVER;
    }

    return parsed.toFixed(2);
  })
  .refine((value) => value.length > 0, {
    message: 'O valor do plano é obrigatório',
  });

const percentualDescontoSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === '') return undefined;

    if (value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const sanitized = value.replace('%', '').trim().replace(',', '.');
      if (sanitized.length === 0) {
        return undefined;
      }

      const parsed = Number(sanitized);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  },
  z.union([
    z
      .number({ invalid_type_error: 'O desconto deve ser um número' })
      .min(0, 'O desconto deve ser no mínimo 0%')
      .max(100, 'O desconto deve ser no máximo 100%'),
    z.null(),
    z.undefined(),
  ]),
);

const quantidadeVagasSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return value;
      }

      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  },
  z
    .number({
      required_error: 'A quantidade de vagas é obrigatória',
      invalid_type_error: 'A quantidade de vagas deve ser um número',
    })
    .int('A quantidade de vagas deve ser um número inteiro')
    .min(1, 'A quantidade de vagas deve ser no mínimo 1'),
);

const quantidadeVagasDestaqueSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') {
      return value === null ? null : undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return undefined;
      }

      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  },
  z.union([
    z
      .number({ invalid_type_error: 'A quantidade de vagas em destaque deve ser um número' })
      .int('A quantidade de vagas em destaque deve ser um número inteiro')
      .min(1, 'A quantidade de vagas em destaque deve ser no mínimo 1'),
    z.null(),
    z.undefined(),
  ]),
);

const planosEmpresariaisSchema = z
  .object({
    icon: z.string().trim().min(1, 'O ícone do plano é obrigatório'),
    nome: z.string().trim().min(1, 'O nome do plano é obrigatório'),
    descricao: z.string().trim().min(1, 'A descrição do plano é obrigatória'),
    valor: valorPlanoSchema,
    desconto: percentualDescontoSchema,
    quantidadeVagas: quantidadeVagasSchema,
    vagaEmDestaque: z.boolean({ invalid_type_error: 'vagaEmDestaque deve ser verdadeiro ou falso' }),
    quantidadeVagasDestaque: quantidadeVagasDestaqueSchema,
  })
  .strict();

const validatePlanoRegras = (data: z.infer<typeof planosEmpresariaisSchema>, ctx: RefinementCtx) => {
  if (data.vagaEmDestaque) {
    if (data.quantidadeVagasDestaque === undefined || data.quantidadeVagasDestaque === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantidadeVagasDestaque'],
        message: 'Informe a quantidade de vagas em destaque quando vagaEmDestaque for verdadeiro',
      });
    } else if (data.quantidadeVagas !== undefined && data.quantidadeVagasDestaque > data.quantidadeVagas) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantidadeVagasDestaque'],
        message: 'A quantidade de vagas em destaque não pode superar a quantidade total de vagas do plano',
      });
    }
  } else if (data.quantidadeVagasDestaque !== undefined && data.quantidadeVagasDestaque !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['quantidadeVagasDestaque'],
      message: 'Remova a quantidade de vagas em destaque quando vagaEmDestaque for falso',
    });
  }
};

export const createPlanosEmpresariaisSchema = planosEmpresariaisSchema.superRefine(validatePlanoRegras);

export const updatePlanosEmpresariaisSchema = planosEmpresariaisSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.vagaEmDestaque === true) {
      if (data.quantidadeVagasDestaque === undefined || data.quantidadeVagasDestaque === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantidadeVagasDestaque'],
          message: 'Informe a quantidade de vagas em destaque quando vagaEmDestaque for verdadeiro',
        });
      }
    }

    if (data.vagaEmDestaque === false && data.quantidadeVagasDestaque !== undefined && data.quantidadeVagasDestaque !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantidadeVagasDestaque'],
        message: 'Remova a quantidade de vagas em destaque quando vagaEmDestaque for falso',
      });
    }

    if (
      data.quantidadeVagas !== undefined &&
      data.quantidadeVagasDestaque !== undefined &&
      data.quantidadeVagasDestaque !== null &&
      data.quantidadeVagasDestaque > data.quantidadeVagas
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantidadeVagasDestaque'],
        message: 'A quantidade de vagas em destaque não pode superar a quantidade total de vagas do plano',
      });
    }
  });

export type CreatePlanosEmpresariaisInput = z.infer<typeof createPlanosEmpresariaisSchema>;
export type UpdatePlanosEmpresariaisInput = z.infer<typeof updatePlanosEmpresariaisSchema>;

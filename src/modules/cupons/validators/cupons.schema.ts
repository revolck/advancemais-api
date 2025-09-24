import {
  CuponsAplicarEm,
  CuponsLimiteUso,
  CuponsLimiteUsuario,
  CuponsPeriodo,
  CuponsTipoDesconto,
} from '@prisma/client';
import { RefinementCtx, z } from 'zod';

const codigoSchema = z
  .string({ required_error: 'O código do cupom é obrigatório' })
  .trim()
  .min(3, 'O código do cupom deve ter ao menos 3 caracteres')
  .max(40, 'O código do cupom deve ter no máximo 40 caracteres')
  .regex(
    /^[A-Z0-9_-]+$/i,
    'Use apenas letras, números, hífen ou underline para o código do cupom',
  );

const descricaoSchema = z
  .string()
  .trim()
  .min(1, 'A descrição do cupom não pode estar vazia')
  .max(300, 'A descrição do cupom deve ter no máximo 300 caracteres')
  .optional();

const percentualSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/%/g, '').trim().replace(',', '.');
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z
  .number({ invalid_type_error: 'Informe uma porcentagem válida' })
  .gt(0, 'A porcentagem de desconto deve ser maior que zero')
  .max(100, 'A porcentagem máxima permitida é 100%')
  .optional());

const monetarySchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const sanitized = value
      .replace(/R\$/gi, '')
      .replace(/\s+/g, '')
      .replace(/\./g, '')
      .replace(',', '.');

    if (!sanitized) {
      return undefined;
    }

    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z
  .number({ invalid_type_error: 'Informe um valor de desconto válido' })
  .gt(0, 'O valor de desconto deve ser maior que zero')
  .optional());

const positiveIntSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z
  .number({ invalid_type_error: 'Informe um número inteiro válido' })
  .int('Informe um número inteiro válido')
  .gt(0, 'O valor deve ser maior que zero')
  .optional());

const optionalDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value as any);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed;
}, z.date({ invalid_type_error: 'Informe uma data válida' }).optional());

const cursosIdsSchema = z
  .array(z.number().int('IDs de cursos devem ser inteiros').positive('IDs de cursos devem ser positivos'))
  .nonempty('Selecione ao menos um curso para aplicar o desconto')
  .optional();

const planosIdsSchema = z
  .array(z.string().uuid('IDs de planos devem ser UUIDs válidos'))
  .nonempty('Selecione ao menos um plano de assinatura para aplicar o desconto')
  .optional();

const baseCupomSchema = z
  .object({
    codigo: codigoSchema,
    descricao: descricaoSchema,
    tipoDesconto: z.nativeEnum(CuponsTipoDesconto),
    valorPercentual: percentualSchema,
    valorFixo: monetarySchema,
    aplicarEm: z.nativeEnum(CuponsAplicarEm),
    aplicarEmTodosItens: z.boolean().optional(),
    cursosIds: cursosIdsSchema,
    planosIds: planosIdsSchema,
    limiteUsoTotalTipo: z.nativeEnum(CuponsLimiteUso),
    limiteUsoTotalQuantidade: positiveIntSchema,
    limitePorUsuarioTipo: z.nativeEnum(CuponsLimiteUsuario),
    limitePorUsuarioQuantidade: positiveIntSchema,
    periodoTipo: z.nativeEnum(CuponsPeriodo),
    periodoInicio: optionalDateSchema,
    periodoFim: optionalDateSchema,
    ativo: z.boolean().optional(),
  })
  .strict();

const validateCupomRules = (data: z.infer<typeof baseCupomSchema>, ctx: RefinementCtx) => {
  if (data.tipoDesconto === CuponsTipoDesconto.PORCENTAGEM) {
    if (data.valorPercentual === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valorPercentual'],
        message: 'Informe a porcentagem de desconto',
      });
    }

    if (data.valorFixo !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valorFixo'],
        message: 'Remova o valor fixo ao utilizar um desconto percentual',
      });
    }
  }

  if (data.tipoDesconto === CuponsTipoDesconto.VALOR_FIXO) {
    if (data.valorFixo === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valorFixo'],
        message: 'Informe o valor de desconto',
      });
    }

    if (data.valorPercentual !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valorPercentual'],
        message: 'Remova a porcentagem ao utilizar um desconto em valor fixo',
      });
    }
  }

  if (data.aplicarEm === CuponsAplicarEm.APENAS_CURSOS && !data.aplicarEmTodosItens) {
    if (!data.cursosIds || data.cursosIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cursosIds'],
        message: 'Selecione os cursos que irão receber o desconto',
      });
    }
  }

  if (data.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA && !data.aplicarEmTodosItens) {
    if (!data.planosIds || data.planosIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['planosIds'],
        message: 'Selecione os planos de assinatura que irão receber o desconto',
      });
    }
  }

  if (data.limiteUsoTotalTipo === CuponsLimiteUso.LIMITADO) {
    if (data.limiteUsoTotalQuantidade === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limiteUsoTotalQuantidade'],
        message: 'Informe o limite total de usos do cupom',
      });
    }
  } else if (data.limiteUsoTotalQuantidade !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['limiteUsoTotalQuantidade'],
      message: 'Remova o limite total de usos quando o cupom for ilimitado',
    });
  }

  if (data.limitePorUsuarioTipo === CuponsLimiteUsuario.LIMITADO) {
    if (data.limitePorUsuarioQuantidade === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitePorUsuarioQuantidade'],
        message: 'Informe quantas vezes cada usuário poderá usar o cupom',
      });
    }
  } else if (data.limitePorUsuarioTipo === CuponsLimiteUsuario.ILIMITADO) {
    if (data.limitePorUsuarioQuantidade !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitePorUsuarioQuantidade'],
        message: 'Remova o limite por usuário quando o cupom for ilimitado',
      });
    }
  } else if (data.limitePorUsuarioTipo === CuponsLimiteUsuario.PRIMEIRA_COMPRA) {
    if (data.limitePorUsuarioQuantidade !== undefined && data.limitePorUsuarioQuantidade !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['limitePorUsuarioQuantidade'],
        message: 'O cupom de primeira compra é limitado automaticamente a 1 uso por usuário',
      });
    }
  }

  if (data.periodoTipo === CuponsPeriodo.PERIODO) {
    if (!data.periodoInicio || !data.periodoFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodoInicio'],
        message: 'Informe a data e horário de início e fim de validade do cupom',
      });
    } else if (data.periodoFim <= data.periodoInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodoFim'],
        message: 'A data final deve ser posterior à data inicial',
      });
    }
  } else {
    if (data.periodoInicio !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodoInicio'],
        message: 'Remova a data de início quando o cupom for ilimitado',
      });
    }

    if (data.periodoFim !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodoFim'],
        message: 'Remova a data de término quando o cupom for ilimitado',
      });
    }
  }
};

export const createCupomDescontoSchema = baseCupomSchema.superRefine(validateCupomRules);

export const updateCupomDescontoSchema = z
  .object({
    codigo: codigoSchema.optional(),
    descricao: descricaoSchema,
    tipoDesconto: z.nativeEnum(CuponsTipoDesconto).optional(),
    valorPercentual: percentualSchema,
    valorFixo: monetarySchema,
    aplicarEm: z.nativeEnum(CuponsAplicarEm).optional(),
    aplicarEmTodosItens: z.boolean().optional(),
    cursosIds: cursosIdsSchema,
    planosIds: planosIdsSchema,
    limiteUsoTotalTipo: z.nativeEnum(CuponsLimiteUso).optional(),
    limiteUsoTotalQuantidade: positiveIntSchema,
    limitePorUsuarioTipo: z.nativeEnum(CuponsLimiteUsuario).optional(),
    limitePorUsuarioQuantidade: positiveIntSchema,
    periodoTipo: z.nativeEnum(CuponsPeriodo).optional(),
    periodoInicio: optionalDateSchema,
    periodoFim: optionalDateSchema,
    ativo: z.boolean().optional(),
  })
  .strict();

export type CreateCupomDescontoInput = z.infer<typeof createCupomDescontoSchema>;
export type UpdateCupomDescontoInput = z.infer<typeof updateCupomDescontoSchema>;

import { CursosModelosRecuperacao } from '@prisma/client';
import { z } from 'zod';

const decimalNotaSchema = z
  .number({ invalid_type_error: 'Valor deve ser um número' })
  .min(0, 'Valor mínimo é 0')
  .max(10, 'Valor máximo é 10');

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .gt(0, 'Peso deve ser maior que zero')
  .max(1000, 'Peso deve ser menor ou igual a 1000');

export const updateRegrasAvaliacaoSchema = z.object({
  mediaMinima: decimalNotaSchema.optional(),
  politicaRecuperacaoAtiva: z.boolean().optional(),
  modelosRecuperacao: z.array(z.nativeEnum(CursosModelosRecuperacao)).optional(),
  ordemAplicacaoRecuperacao: z.array(z.nativeEnum(CursosModelosRecuperacao)).optional(),
  notaMaximaRecuperacao: decimalNotaSchema.nullish(),
  pesoProvaFinal: pesoSchema.nullish(),
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(500)
    .nullish(),
});

const uuidSchema = z.string().uuid('Identificador inválido');

export const registrarRecuperacaoSchema = z.object({
  inscricaoId: uuidSchema,
  provaId: uuidSchema.nullish(),
  envioId: uuidSchema.nullish(),
  notaRecuperacao: decimalNotaSchema.nullish(),
  notaFinal: decimalNotaSchema.nullish(),
  mediaCalculada: z
    .number({ invalid_type_error: 'Média deve ser um número' })
    .min(0)
    .max(10)
    .nullish(),
  modeloAplicado: z.nativeEnum(CursosModelosRecuperacao).nullish(),
  detalhes: z.record(z.any()).nullish(),
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(500)
    .nullish(),
  aplicadoEm: z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') {
          return undefined;
        }
        if (value instanceof Date) {
          return value;
        }
        const parsed = new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? value : parsed;
      },
      z.date({ invalid_type_error: 'Data inválida' }),
    )
    .optional(),
});

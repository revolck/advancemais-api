import { z } from 'zod';

const ordemSchema = z
  .number({ invalid_type_error: 'Ordem deve ser um número' })
  .int('Ordem deve ser inteiro')
  .min(0, 'Ordem deve ser maior ou igual a zero');

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .gt(0, 'Peso deve ser maior que zero')
  .max(1000, 'Peso deve ser menor ou igual a 1000');

const dataSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }, z.date({ invalid_type_error: 'Data inválida' }))
  .optional();

const provaBaseSchema = z.object({
  titulo: z.string().trim().min(3).max(255),
  etiqueta: z.string().trim().min(1).max(30),
  descricao: z
    .string({ invalid_type_error: 'Descrição deve ser um texto' })
    .trim()
    .max(2000)
    .nullish(),
  peso: pesoSchema,
  moduloId: z
    .string({ invalid_type_error: 'Identificador do módulo deve ser um texto' })
    .uuid('Identificador de módulo inválido')
    .nullish(),
  ativo: z.boolean().optional(),
  ordem: ordemSchema.optional(),
});

export const createProvaSchema = provaBaseSchema;

export const updateProvaSchema = provaBaseSchema.partial({ peso: true });

export const registrarNotaSchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido'),
  nota: z
    .number({ invalid_type_error: 'Nota deve ser um número' })
    .min(0, 'Nota mínima é 0')
    .max(10, 'Nota máxima é 10'),
  pesoTotal: pesoSchema.nullish(),
  realizadoEm: dataSchema,
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(1000)
    .nullish(),
});

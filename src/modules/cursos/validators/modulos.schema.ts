import { z } from 'zod';

const ordemSchema = z
  .number({ invalid_type_error: 'Ordem deve ser um número' })
  .int('Ordem deve ser um número inteiro')
  .min(0, 'Ordem deve ser maior ou igual a zero');

const moduloBaseSchema = z.object({
  nome: z.string().trim().min(3, 'Informe um nome com ao menos 3 caracteres').max(255),
  descricao: z
    .string({ invalid_type_error: 'Descrição deve ser um texto' })
    .trim()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
    .nullish(),
  obrigatorio: z.boolean().optional(),
  ordem: ordemSchema.optional(),
});

export const createModuloSchema = moduloBaseSchema;

export const updateModuloSchema = moduloBaseSchema.partial();

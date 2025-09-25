import { z } from 'zod';

const nomeSchema = z.string().trim().min(3).max(120);
const descricaoSchema = z.string().trim().max(255).nullish();

export const createCategoriaSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
});

export const updateCategoriaSchema = z
  .object({
    nome: nomeSchema.optional(),
    descricao: descricaoSchema,
  })
  .refine((data) => data.nome !== undefined || data.descricao !== undefined, {
    message: 'Informe ao menos um campo para atualização',
    path: ['nome'],
  });

export const createSubcategoriaSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
});

export const updateSubcategoriaSchema = z
  .object({
    nome: nomeSchema.optional(),
    descricao: descricaoSchema,
  })
  .refine((data) => data.nome !== undefined || data.descricao !== undefined, {
    message: 'Informe ao menos um campo para atualização',
    path: ['nome'],
  });

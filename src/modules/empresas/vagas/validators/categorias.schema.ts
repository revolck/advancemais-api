import { z } from 'zod';

const nomeSchema = z.string().trim().min(3).max(120);
const descricaoSchema = z.string().trim().max(255).nullish();

export const createVagaCategoriaSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
});

export const updateVagaCategoriaSchema = z
  .object({
    nome: nomeSchema.optional(),
    descricao: descricaoSchema,
  })
  .refine((data) => data.nome !== undefined || data.descricao !== undefined, {
    message: 'Informe ao menos um campo para atualização',
    path: ['nome'],
  });

export const createVagaSubcategoriaSchema = z.object({
  nome: nomeSchema,
  descricao: descricaoSchema,
});

export const updateVagaSubcategoriaSchema = z
  .object({
    nome: nomeSchema.optional(),
    descricao: descricaoSchema,
  })
  .refine((data) => data.nome !== undefined || data.descricao !== undefined, {
    message: 'Informe ao menos um campo para atualização',
    path: ['nome'],
  });

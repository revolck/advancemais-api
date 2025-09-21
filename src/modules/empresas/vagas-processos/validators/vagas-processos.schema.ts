import { OrigemVagas, StatusProcesso } from '@prisma/client';
import { z } from 'zod';

const observacoesSchema = z
  .string()
  .trim()
  .min(3, 'Descreva a observação com pelo menos 3 caracteres.')
  .max(1000, 'As observações devem ter no máximo 1000 caracteres.')
  .or(z.literal(''))
  .or(z.null())
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === '' || value === null) return null;
    return value;
  });

export const vagaProcessoParamsSchema = z.object({
  vagaId: z.string({ required_error: 'O identificador da vaga é obrigatório.' }).uuid('Informe um ID de vaga válido.'),
});

export const vagaProcessoDetailParamsSchema = vagaProcessoParamsSchema.extend({
  processoId: z.string({ required_error: 'O identificador do processo é obrigatório.' }).uuid('Informe um ID de processo válido.'),
});

export const vagaProcessoListQuerySchema = z
  .object({
    status: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.toUpperCase()),
      )
      .pipe(z.array(z.nativeEnum(StatusProcesso)))
      .optional(),
    origem: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.toUpperCase()),
      )
      .pipe(z.array(z.nativeEnum(OrigemVagas)))
      .optional(),
    candidatoId: z.string().uuid('Informe um ID de candidato válido.').optional(),
  })
  .partial();

export const createVagaProcessoSchema = z.object({
  candidatoId: z
    .string({ required_error: 'O identificador do candidato é obrigatório.' })
    .uuid('Informe um ID de candidato válido.'),
  status: z.nativeEnum(StatusProcesso).optional(),
  origem: z.nativeEnum(OrigemVagas).optional(),
  observacoes: observacoesSchema,
  agendadoEm: z.coerce.date().optional(),
});

export const updateVagaProcessoSchema = createVagaProcessoSchema
  .partial()
  .extend({ candidatoId: z.never().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualização do processo seletivo.',
    path: ['status'],
  });

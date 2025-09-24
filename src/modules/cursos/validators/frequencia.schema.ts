import { z } from 'zod';

const statusSchema = z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'ATRASADO']);

const dateSchema = z
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

const aulaIdSchema = z.string().uuid('Identificador da aula inválido').nullish();
const inscricaoIdSchema = z.string().uuid('Identificador da inscrição inválido');

const justificativaSchema = z
  .string({ invalid_type_error: 'Justificativa deve ser um texto' })
  .trim()
  .min(3, 'Justificativa deve conter ao menos 3 caracteres')
  .max(500, 'Justificativa deve conter no máximo 500 caracteres')
  .nullish();

const observacoesSchema = z
  .string({ invalid_type_error: 'Observações deve ser um texto' })
  .trim()
  .max(500, 'Observações deve conter no máximo 500 caracteres')
  .nullish();

export const createFrequenciaSchema = z
  .object({
    inscricaoId: inscricaoIdSchema,
    aulaId: aulaIdSchema,
    dataReferencia: dateSchema,
    status: statusSchema,
    justificativa: justificativaSchema,
    observacoes: observacoesSchema,
  })
  .refine((data) => (data.status === 'JUSTIFICADO' ? !!data.justificativa?.trim() : true), {
    path: ['justificativa'],
    message: 'Justificativa é obrigatória para faltas justificadas',
  });

export const updateFrequenciaSchema = z
  .object({
    aulaId: aulaIdSchema.optional(),
    dataReferencia: dateSchema,
    status: statusSchema.optional(),
    justificativa: justificativaSchema.optional(),
    observacoes: observacoesSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualização da frequência',
  })
  .refine(
    (data) =>
      data.status === 'JUSTIFICADO'
        ? !!data.justificativa && data.justificativa.trim().length > 0
        : true,
    {
      path: ['justificativa'],
      message: 'Justificativa é obrigatória quando o status for JUSTIFICADO',
    },
  )
  .refine(
    (data) =>
      data.justificativa === undefined || data.justificativa === null
        ? true
        : data.justificativa.trim().length > 0,
    {
      path: ['justificativa'],
      message: 'Justificativa não pode ser vazia',
    },
  );

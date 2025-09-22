import { CursoStatus } from '@prisma/client';
import { z } from 'zod';

const positiveInt = z
  .coerce.number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

const optionalDate = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }, z.date({ invalid_type_error: 'Informe uma data válida' }))
  .optional();

export const createTurmaSchema = z
  .object({
    nome: z.string().trim().min(3).max(255),
    dataInicio: optionalDate,
    dataFim: optionalDate,
    dataInscricaoInicio: optionalDate,
    dataInscricaoFim: optionalDate,
    vagasTotais: positiveInt,
    vagasDisponiveis: positiveInt.optional(),
    status: z.nativeEnum(CursoStatus).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dataInicio && value.dataFim && value.dataInicio > value.dataFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'Data de fim deve ser posterior à data de início',
      });
    }

    if (
      value.dataInscricaoInicio &&
      value.dataInscricaoFim &&
      value.dataInscricaoInicio > value.dataInscricaoFim
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataInscricaoFim'],
        message: 'Data final de inscrição deve ser posterior à data inicial',
      });
    }
  });

export const updateTurmaSchema = createTurmaSchema.partial();

export const turmaEnrollmentSchema = z.object({
  alunoId: z.string().uuid(),
});

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

const turmaBaseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  dataInicio: optionalDate,
  dataFim: optionalDate,
  dataInscricaoInicio: optionalDate,
  dataInscricaoFim: optionalDate,
  vagasTotais: positiveInt,
  vagasDisponiveis: positiveInt.optional(),
  status: z.nativeEnum(CursoStatus).optional(),
});

const applyDateValidations = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.superRefine((value, ctx) => {
    const dataInicio = (value as z.infer<typeof turmaBaseSchema>).dataInicio;
    const dataFim = (value as z.infer<typeof turmaBaseSchema>).dataFim;
    const dataInscricaoInicio = (value as z.infer<typeof turmaBaseSchema>).dataInscricaoInicio;
    const dataInscricaoFim = (value as z.infer<typeof turmaBaseSchema>).dataInscricaoFim;

    if (dataInicio && dataFim && dataInicio > dataFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'Data de fim deve ser posterior à data de início',
      });
    }

    if (dataInscricaoInicio && dataInscricaoFim && dataInscricaoInicio > dataInscricaoFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataInscricaoFim'],
        message: 'Data final de inscrição deve ser posterior à data inicial',
      });
    }
  });

export const createTurmaSchema = applyDateValidations(turmaBaseSchema);

export const updateTurmaSchema = applyDateValidations(turmaBaseSchema.partial());

export const turmaEnrollmentSchema = z.object({
  alunoId: z.string().uuid(),
});

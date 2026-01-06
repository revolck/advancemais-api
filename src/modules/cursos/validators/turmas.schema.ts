import { CursoStatus, CursosMetodos, CursosTurnos, StatusInscricao } from '@prisma/client';
import { z } from 'zod';

const uuid = z.string().uuid('Identificador inválido');

const positiveInt = z.coerce
  .number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

const optionalDate = z
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
    z.date({ invalid_type_error: 'Informe uma data válida' }),
  )
  .optional();

const turmaBaseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  instrutorId: uuid.optional(),
  turno: z.nativeEnum(CursosTurnos).optional(),
  metodo: z.nativeEnum(CursosMetodos).optional(),
  dataInicio: optionalDate,
  dataFim: optionalDate,
  dataInscricaoInicio: optionalDate,
  dataInscricaoFim: optionalDate,
  vagasTotais: positiveInt,
  vagasDisponiveis: positiveInt.optional(),
  status: z.nativeEnum(CursoStatus).optional(),
});

const turmaEstruturaItemSchema = z.object({
  type: z.enum(['AULA', 'PROVA', 'ATIVIDADE']),
  title: z.string().trim().min(1).max(255),
  templateId: uuid,
  strategy: z.enum(['CLONE', 'REFERENCE']).optional().default('CLONE'),
  startDate: optionalDate.optional(),
  endDate: optionalDate.optional(),
  instructorId: uuid.optional(),
  instructorIds: z.array(uuid).optional(),
  ordem: z.coerce.number().int().min(0).optional(),
});

const turmaEstruturaModuleSchema = z.object({
  title: z.string().trim().min(1).max(255),
  startDate: optionalDate.optional(),
  endDate: optionalDate.optional(),
  instructorId: uuid.optional(),
  instructorIds: z.array(uuid).optional(),
  items: z.array(turmaEstruturaItemSchema).default([]),
});

const turmaEstruturaSchema = z.object({
  modules: z.array(turmaEstruturaModuleSchema).default([]),
  standaloneItems: z.array(turmaEstruturaItemSchema).default([]),
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

    if (dataInicio && dataInscricaoFim && dataInscricaoFim < dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataInscricaoFim'],
        message: 'Data final de inscrição deve ser posterior à data de início da turma',
      });
    }
  });

export const createTurmaSchema = applyDateValidations(
  turmaBaseSchema.extend({
    estrutura: turmaEstruturaSchema,
  }),
).superRefine((value, ctx) => {
  const estrutura = (value as any).estrutura as z.infer<typeof turmaEstruturaSchema> | undefined;
  const modules = estrutura?.modules ?? [];
  const standaloneItems = estrutura?.standaloneItems ?? [];
  const allItems = [...modules.flatMap((m) => m.items ?? []), ...standaloneItems];

  const aulasCount = allItems.filter((item) => item.type === 'AULA').length;
  const avaliacoesCount = allItems.filter(
    (item) => item.type === 'PROVA' || item.type === 'ATIVIDADE',
  ).length;

  if (aulasCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura'],
      message: 'A estrutura da turma deve conter ao menos 1 item do tipo AULA',
    });
  }

  if (avaliacoesCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura'],
      message: 'A estrutura da turma deve conter ao menos 1 item do tipo PROVA ou ATIVIDADE',
    });
  }
});

export const updateTurmaSchema = applyDateValidations(turmaBaseSchema.partial());

export const turmaInscricaoSchema = z.object({
  alunoId: z.string().uuid(),
});

export const updateInscricaoStatusSchema = z.object({
  status: z.nativeEnum(StatusInscricao, {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
});

export const listTurmasQuerySchema = z.object({
  page: positiveInt.min(1).default(1),
  pageSize: positiveInt.min(1).max(100).default(10),
  status: z.nativeEnum(CursoStatus).optional(),
  turno: z.nativeEnum(CursosTurnos).optional(),
  metodo: z.nativeEnum(CursosMetodos).optional(),
  instrutorId: z.string().uuid().optional(),
});

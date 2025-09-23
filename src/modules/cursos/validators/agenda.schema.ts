import { CursosAgendaTipo } from '@prisma/client';
import { z } from 'zod';

const tituloSchema = z
  .string({ invalid_type_error: 'Título deve ser um texto' })
  .trim()
  .min(3, 'Título deve ter ao menos 3 caracteres')
  .max(255, 'Título deve ter no máximo 255 caracteres');

const descricaoSchema = z
  .string({ invalid_type_error: 'Descrição deve ser um texto' })
  .trim()
  .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
  .nullish();

const aulaIdSchema = z
  .string({ invalid_type_error: 'Identificador da aula deve ser um texto' })
  .uuid('Identificador da aula inválido')
  .nullish();

const provaIdSchema = z
  .string({ invalid_type_error: 'Identificador da prova deve ser um texto' })
  .uuid('Identificador da prova inválido')
  .nullish();

const baseSchema = z.object({
  tipo: z.nativeEnum(CursosAgendaTipo),
  titulo: tituloSchema,
  descricao: descricaoSchema,
  inicio: z.coerce.date({ invalid_type_error: 'Informe uma data/hora válida para início' }),
  fim: z.coerce
    .date({ invalid_type_error: 'Informe uma data/hora válida para término' })
    .optional(),
  aulaId: aulaIdSchema,
  provaId: provaIdSchema,
});

export const createAgendaSchema = baseSchema.superRefine((data, ctx) => {
  if (data.fim && data.fim.getTime() < data.inicio.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fim'],
      message: 'Data de término não pode ser anterior à data de início',
    });
  }

  if (data.tipo === CursosAgendaTipo.AULA) {
    if (!data.aulaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aulaId'],
        message: 'Informe a aula vinculada ao evento',
      });
    }
    if (data.provaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provaId'],
        message: 'Eventos de aula não podem referenciar provas',
      });
    }
    return;
  }

  if (data.tipo === CursosAgendaTipo.PROVA) {
    if (!data.provaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provaId'],
        message: 'Informe a prova vinculada ao evento',
      });
    }
    if (data.aulaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aulaId'],
        message: 'Eventos de prova não podem referenciar aulas',
      });
    }
    return;
  }

  if (data.aulaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['aulaId'],
      message: `Eventos do tipo ${data.tipo} não podem vincular aulas`,
    });
  }
  if (data.provaId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['provaId'],
      message: `Eventos do tipo ${data.tipo} não podem vincular provas`,
    });
  }
});

export const updateAgendaSchema = z
  .object({
    tipo: z.nativeEnum(CursosAgendaTipo).optional(),
    titulo: tituloSchema.optional(),
    descricao: descricaoSchema.optional(),
    inicio: z.coerce.date({ invalid_type_error: 'Informe uma data/hora válida para início' }).optional(),
    fim: z.coerce.date({ invalid_type_error: 'Informe uma data/hora válida para término' }).optional(),
    aulaId: aulaIdSchema.optional(),
    provaId: provaIdSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.inicio && data.fim && data.fim.getTime() < data.inicio.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fim'],
        message: 'Data de término não pode ser anterior à data de início',
      });
    }

    if (data.aulaId && data.provaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provaId'],
        message: 'Não é permitido vincular aula e prova ao mesmo evento',
      });
    }

    if (data.tipo === CursosAgendaTipo.AULA && data.provaId && data.provaId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provaId'],
        message: 'Eventos de aula não podem referenciar provas',
      });
    }

    if (data.tipo === CursosAgendaTipo.PROVA && data.aulaId && data.aulaId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['aulaId'],
        message: 'Eventos de prova não podem referenciar aulas',
      });
    }

    if (data.tipo && data.tipo !== CursosAgendaTipo.AULA && data.tipo !== CursosAgendaTipo.PROVA) {
      if (data.aulaId && data.aulaId !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['aulaId'],
          message: `Eventos do tipo ${data.tipo} não podem vincular aulas`,
        });
      }
      if (data.provaId && data.provaId !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['provaId'],
          message: `Eventos do tipo ${data.tipo} não podem vincular provas`,
        });
      }
    }
  });

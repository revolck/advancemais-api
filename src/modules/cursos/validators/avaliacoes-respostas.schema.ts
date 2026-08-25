import { z } from 'zod';

const statusCorrecaoSchema = z.enum(['PENDENTE', 'CORRIGIDA']);
const orderBySchema = z.enum(['concluidoEm', 'alunoNome', 'nota']);
const orderSchema = z.enum(['asc', 'desc']);

const coercePositiveInt = (fallback: number, min = 1, max = 200) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .optional()
    .transform((value) => value ?? fallback);

export const listAvaliacaoRespostasQuerySchema = z.object({
  page: coercePositiveInt(1),
  pageSize: coercePositiveInt(10),
  search: z.string().trim().max(120).optional(),
  statusCorrecao: statusCorrecaoSchema.optional(),
  orderBy: orderBySchema.optional().default('concluidoEm'),
  order: orderSchema.optional().default('desc'),
});

export const listAvaliacaoHistoricoQuerySchema = z.object({
  avaliacaoId: z.string().uuid(),
  page: coercePositiveInt(1),
  pageSize: coercePositiveInt(10, 1, 200),
  tipo: z.string().trim().max(60).optional(),
  acao: z.string().trim().max(120).optional(),
  alteradoPor: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const corrigirAvaliacaoRespostaSchema = z.object({
  nota: z
    .number()
    .min(0)
    .max(10)
    .refine((value) => Math.round(value * 10) === value * 10, {
      message: 'nota deve ter no máximo 1 casa decimal',
    })
    .nullable()
    .optional(),
  feedback: z.string().trim().max(2000).nullable().optional(),
  statusCorrecao: statusCorrecaoSchema.optional().default('CORRIGIDA'),
});

export const listAvaliacaoRespostaComentariosQuerySchema = z.object({
  filtro: z.enum(['PRINCIPAL', 'RECENTES', 'MEUS_COMENTARIOS']).optional().default('PRINCIPAL'),
  search: z.string().trim().max(120).optional(),
  page: coercePositiveInt(1),
  pageSize: coercePositiveInt(8, 1, 30),
});

const comentarioAnexoSchema = z.object({
  url: z.string().url().max(2000),
  nome: z.string().trim().min(1).max(255),
  tipo: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(
      (tipo) =>
        [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.oasis.opendocument.text',
          'application/vnd.oasis.opendocument.spreadsheet',
          'application/vnd.oasis.opendocument.presentation',
          'text/plain',
          'text/csv',
        ].includes(tipo),
      'Tipo de anexo não permitido',
    ),
  tamanho: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
});

const comentarioConteudoFields = {
  conteudo: z.string().trim().max(2000).optional().default(''),
  anexos: z.array(comentarioAnexoSchema).max(3).optional().default([]),
};

const validateComentarioConteudo = (
  value: { conteudo: string; anexos: z.infer<typeof comentarioAnexoSchema>[] },
  context: z.RefinementCtx,
) => {
  if (!value.conteudo && value.anexos.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe um comentário ou adicione pelo menos um anexo',
      path: ['conteudo'],
    });
  }
};

export const createAvaliacaoRespostaComentarioSchema = z
  .object({
    ...comentarioConteudoFields,
    parentId: z.string().uuid().nullable().optional(),
  })
  .superRefine(validateComentarioConteudo);

export const updateAvaliacaoRespostaComentarioSchema = z
  .object(comentarioConteudoFields)
  .superRefine(validateComentarioConteudo);

export const fixarAvaliacaoRespostaComentarioSchema = z.object({
  fixado: z.boolean(),
});

export type ListAvaliacaoRespostasQuery = z.infer<typeof listAvaliacaoRespostasQuerySchema>;
export type ListAvaliacaoHistoricoQuery = z.infer<typeof listAvaliacaoHistoricoQuerySchema>;
export type CorrigirAvaliacaoRespostaInput = z.infer<typeof corrigirAvaliacaoRespostaSchema>;
export type ListAvaliacaoRespostaComentariosQuery = z.infer<
  typeof listAvaliacaoRespostaComentariosQuerySchema
>;
export type CreateAvaliacaoRespostaComentarioInput = z.infer<
  typeof createAvaliacaoRespostaComentarioSchema
>;
export type UpdateAvaliacaoRespostaComentarioInput = z.infer<
  typeof updateAvaliacaoRespostaComentarioSchema
>;
export type FixarAvaliacaoRespostaComentarioInput = z.infer<
  typeof fixarAvaliacaoRespostaComentarioSchema
>;

import { CursosCertificados, CursosCertificadosTipos } from '@prisma/client';
import { z } from 'zod';

const emptyToUndefined = (value: unknown) => {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim().length === 0) return undefined;
  return value;
};

const optionalUrlSchema = z
  .string({ invalid_type_error: 'assinaturaUrl deve ser uma URL válida' })
  .trim()
  .url('assinaturaUrl deve ser uma URL válida')
  .max(2048, 'assinaturaUrl deve conter no máximo 2048 caracteres')
  .optional()
  .or(z.literal('').transform(() => undefined))
  .or(z.null().transform(() => undefined));

export const emitirCertificadoSchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido'),
  tipo: z.nativeEnum(CursosCertificados, {
    invalid_type_error: 'Tipo de certificado inválido',
  }),
  formato: z.nativeEnum(CursosCertificadosTipos, {
    invalid_type_error: 'Formato de certificado inválido',
  }),
  cargaHoraria: z
    .number({ invalid_type_error: 'Carga horária deve ser um número' })
    .int('Carga horária deve ser um número inteiro')
    .min(1, 'Carga horária mínima é 1')
    .max(1000, 'Carga horária máxima suportada é 1000')
    .optional(),
  assinaturaUrl: optionalUrlSchema,
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(500, 'Observações devem conter no máximo 500 caracteres')
    .nullish(),
  conteudoProgramatico: z
    .string({ invalid_type_error: 'Conteúdo programático deve ser um texto' })
    .trim()
    .max(12000, 'Conteúdo programático deve conter no máximo 12000 caracteres')
    .optional()
    .or(z.literal('').transform(() => undefined))
    .or(z.null().transform(() => undefined)),
});

export const listarCertificadosQuerySchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido').optional(),
  tipo: z.nativeEnum(CursosCertificados).optional(),
  formato: z.nativeEnum(CursosCertificadosTipos).optional(),
});

export const certificadoStatusSchema = z.enum(['EMITIDO', 'CANCELADO', 'REVOGADO']);

export const listarCertificadosGlobaisQuerySchema = z
  .object({
    search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    cursoId: z.preprocess(emptyToUndefined, z.string().uuid('cursoId inválido').optional()),
    turmaId: z.preprocess(emptyToUndefined, z.string().uuid('turmaId inválido').optional()),
    status: z.preprocess((value) => {
      if (value == null) return undefined;
      if (typeof value !== 'string') return value;
      const normalized = value.trim().toUpperCase();
      if (!normalized || normalized === 'TODOS' || normalized === 'ALL') return undefined;
      return normalized;
    }, certificadoStatusSchema.optional()),
    emitidoDe: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    emitidoA: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(10),
    sortBy: z.preprocess(
      emptyToUndefined,
      z.enum(['alunoNome', 'emitidoEm', 'status', 'codigo']).default('emitidoEm'),
    ),
    sortDir: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc')),
  })
  .superRefine((value, ctx) => {
    if (value.emitidoDe && value.emitidoA && value.emitidoA < value.emitidoDe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emitidoA não pode ser anterior a emitidoDe',
        path: ['emitidoA'],
      });
    }
  });

export const emitirCertificadoGlobalSchema = z.object({
  cursoId: z.string().uuid('cursoId inválido'),
  turmaId: z.string().uuid('turmaId inválido'),
  alunoId: z.string().uuid('alunoId inválido'),
  modeloId: z.string().trim().optional(),
  forcarReemissao: z.coerce.boolean().optional().default(false),
  conteudoProgramatico: z
    .string({ invalid_type_error: 'Conteúdo programático deve ser um texto' })
    .trim()
    .max(12000, 'Conteúdo programático deve conter no máximo 12000 caracteres')
    .optional()
    .or(z.literal('').transform(() => undefined))
    .or(z.null().transform(() => undefined)),
});

export const listarMeCertificadosQuerySchema = z
  .object({
    cursoId: z.preprocess(emptyToUndefined, z.string().uuid('cursoId inválido').optional()),
    turmaId: z.preprocess(emptyToUndefined, z.string().uuid('turmaId inválido').optional()),
    emitidoDe: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    emitidoA: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(50).default(10),
  })
  .superRefine((value, ctx) => {
    if (value.emitidoDe && value.emitidoA && value.emitidoA < value.emitidoDe) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'emitidoA não pode ser anterior a emitidoDe',
        path: ['emitidoA'],
      });
    }
  });

export const certificadoIdSchema = z.string().uuid('certificadoId inválido');

export const codigoCertificadoSchema = z
  .string({ invalid_type_error: 'Código do certificado deve ser um texto' })
  .trim()
  .min(6, 'Código do certificado deve conter ao menos 6 caracteres')
  .max(32, 'Código do certificado deve conter no máximo 32 caracteres');

export type EmitirCertificadoInput = z.infer<typeof emitirCertificadoSchema>;
export type ListarCertificadosQuery = z.infer<typeof listarCertificadosQuerySchema>;
export type ListarCertificadosGlobaisQuery = z.infer<typeof listarCertificadosGlobaisQuerySchema>;
export type EmitirCertificadoGlobalInput = z.infer<typeof emitirCertificadoGlobalSchema>;
export type ListarMeCertificadosQuery = z.infer<typeof listarMeCertificadosQuerySchema>;

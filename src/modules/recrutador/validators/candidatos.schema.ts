import { z } from 'zod';
import { entrevistaModalidadeValues } from '@/modules/entrevistas/validators/overview.schema';

const nullableTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalIsoDate = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return value;
}, z.date().optional());

export const recrutadorCandidatosListQuerySchema = z
  .object({
    search: nullableTrimmedString,
    empresaUsuarioId: z.string().uuid().optional(),
    vagaId: z.string().uuid().optional(),
    criadoDe: optionalIsoDate,
    criadoAte: optionalIsoDate,
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .refine(
    (values) =>
      !values.criadoDe ||
      !values.criadoAte ||
      values.criadoDe.getTime() <= values.criadoAte.getTime(),
    {
      message: '`criadoDe` não pode ser maior que `criadoAte`.',
      path: ['criadoDe'],
    },
  )
  .transform((values) => ({
    search: values.search,
    empresaUsuarioId: values.empresaUsuarioId,
    vagaId: values.vagaId,
    criadoDe: values.criadoDe,
    criadoAte: values.criadoAte,
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 10,
  }));

export type RecrutadorCandidatosListQuery = z.infer<typeof recrutadorCandidatosListQuerySchema>;

export const recrutadorCandidatoIdParamSchema = z.object({
  candidatoId: z.string().uuid(),
});

export type RecrutadorCandidatoIdParam = z.infer<typeof recrutadorCandidatoIdParamSchema>;

export const recrutadorCandidatoCurriculoParamSchema = z.object({
  candidatoId: z.string().uuid(),
  curriculoId: z.string().uuid(),
});

export type RecrutadorCandidatoCurriculoParam = z.infer<
  typeof recrutadorCandidatoCurriculoParamSchema
>;

const enderecoPresencialSchema = z.object({
  cep: z.string().trim().min(1).max(20),
  logradouro: z.string().trim().min(1).max(255),
  numero: z.string().trim().min(1).max(50),
  complemento: z.string().trim().max(120).nullable().optional(),
  bairro: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  estado: z.string().trim().min(2).max(2),
  pontoReferencia: z.string().trim().max(255).nullable().optional(),
});

export const recrutadorCriarEntrevistaNoCandidatoSchema = z
  .object({
    candidaturaId: z.string().uuid(),
    empresaUsuarioId: z.string().uuid(),
    vagaId: z.string().uuid(),
    modalidade: z.enum(entrevistaModalidadeValues),
    dataInicio: z.string().datetime(),
    dataFim: z.string().datetime(),
    descricao: z.string().trim().max(5000).optional(),
    enderecoPresencial: enderecoPresencialSchema.optional(),
    gerarMeet: z.coerce.boolean().optional(),
    empresaAnonima: z.coerce.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.dataInicio);
    const end = new Date(value.dataFim);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'dataFim deve ser maior que dataInicio',
      });
    }

    if (value.modalidade === 'PRESENCIAL' && !value.enderecoPresencial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enderecoPresencial'],
        message: 'enderecoPresencial é obrigatório para modalidade PRESENCIAL',
      });
    }

    if (value.modalidade !== 'PRESENCIAL' && value.enderecoPresencial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enderecoPresencial'],
        message: 'enderecoPresencial só pode ser usado para modalidade PRESENCIAL',
      });
    }
  });

export type RecrutadorCriarEntrevistaNoCandidatoInput = z.infer<
  typeof recrutadorCriarEntrevistaNoCandidatoSchema
>;

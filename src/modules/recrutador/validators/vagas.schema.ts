import { StatusDeVagas } from '@prisma/client';
import { z } from 'zod';

const recruiterSortByValues = [
  'titulo',
  'inseridaEm',
  'inscricoesAte',
  'numeroVagas',
  'empresaNome',
] as const;

const recruiterSortDirValues = ['asc', 'desc'] as const;

const normalizeOptionalString = z
  .string()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const recruiterStatusArraySchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined;

    const raw = Array.isArray(value) ? value.flatMap((item) => item.split(',')) : value.split(',');

    const normalized = raw
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0);

    return normalized.length > 0 ? normalized : undefined;
  })
  .refine(
    (value) =>
      value === undefined ||
      value.every(
        (status) =>
          Object.prototype.hasOwnProperty.call(StatusDeVagas, status as StatusDeVagas) ||
          status === 'ALL' ||
          status === 'TODAS' ||
          status === 'TODOS',
      ),
    {
      message:
        'Informe status válidos (PUBLICADO, EM_ANALISE, PAUSADA, ENCERRADA, EXPIRADO ou DESPUBLICADA).',
    },
  )
  .transform((value) =>
    value?.map((status) => status as StatusDeVagas | 'ALL' | 'TODAS' | 'TODOS'),
  );

export const recrutadorVagasListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    search: normalizeOptionalString,
    status: recruiterStatusArraySchema,
    empresaUsuarioId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined))
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    localizacao: normalizeOptionalString,
    sortBy: z.enum(recruiterSortByValues).optional(),
    sortDir: z.enum(recruiterSortDirValues).optional(),
  })
  .transform((values) => ({
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 10,
    search: values.search,
    status: values.status,
    empresaUsuarioId: values.empresaUsuarioId,
    localizacao: values.localizacao,
    sortBy: values.sortBy ?? 'inseridaEm',
    sortDir: values.sortDir ?? 'desc',
  }));

export type RecrutadorVagasListQuery = z.infer<typeof recrutadorVagasListQuerySchema>;

const optionalIsoDate = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return value;
}, z.date().optional());

const recruiterVagaCandidatosSortByValues = [
  'nome',
  'email',
  'codigo',
  'criadoEm',
  'atualizadoEm',
  'statusCandidatura',
] as const;

export const recrutadorVagaIdParamSchema = z.object({
  vagaId: z.string().uuid(),
});

export type RecrutadorVagaIdParam = z.infer<typeof recrutadorVagaIdParamSchema>;

export const recrutadorVagaCandidaturaStatusParamSchema = z.object({
  vagaId: z.string().uuid(),
  candidaturaId: z.string().uuid(),
});

export type RecrutadorVagaCandidaturaStatusParam = z.infer<
  typeof recrutadorVagaCandidaturaStatusParamSchema
>;

export const recrutadorAtualizarCandidaturaStatusBodySchema = z.object({
  statusId: z.string().uuid(),
});

export type RecrutadorAtualizarCandidaturaStatusBody = z.infer<
  typeof recrutadorAtualizarCandidaturaStatusBodySchema
>;

export const recrutadorVagaCandidatosQuerySchema = z
  .object({
    search: normalizeOptionalString,
    inscricaoDe: optionalIsoDate,
    inscricaoAte: optionalIsoDate,
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.enum(recruiterVagaCandidatosSortByValues).optional(),
    sortDir: z.enum(recruiterSortDirValues).optional(),
  })
  .refine(
    (values) =>
      !values.inscricaoDe ||
      !values.inscricaoAte ||
      values.inscricaoDe.getTime() <= values.inscricaoAte.getTime(),
    {
      message: '`inscricaoDe` não pode ser maior que `inscricaoAte`.',
      path: ['inscricaoDe'],
    },
  )
  .transform((values) => ({
    search: values.search,
    inscricaoDe: values.inscricaoDe,
    inscricaoAte: values.inscricaoAte,
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 10,
    sortBy: values.sortBy ?? 'criadoEm',
    sortDir: values.sortDir ?? 'desc',
  }));

export type RecrutadorVagaCandidatosQuery = z.infer<typeof recrutadorVagaCandidatosQuerySchema>;

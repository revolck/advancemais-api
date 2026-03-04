import { z } from 'zod';

const statusSchema = z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'ATRASADO']);
const statusFiltroSchema = z.enum(['PRESENTE', 'AUSENTE', 'JUSTIFICADO', 'ATRASADO', 'PENDENTE']);
const tipoOrigemSchema = z.enum(['AULA', 'PROVA', 'ATIVIDADE']);
const modoLancamentoSchema = z.enum(['MANUAL', 'AUTOMATICO']);
const orderBySchema = z.enum(['atualizadoEm', 'status', 'tipoOrigem']);
const orderSchema = z.enum(['asc', 'desc']);
const uuidSchema = z.string().uuid('Identificador inválido');

const normalizeOptionalUuid = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}, uuidSchema.optional());

const normalizeOptionalTipoOrigem = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!normalized || normalized === 'TODOS' || normalized === 'TODAS') {
    return undefined;
  }
  return normalized;
}, tipoOrigemSchema.optional());

const normalizeOptionalStatus = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (!normalized || normalized === 'TODOS' || normalized === 'TODAS') {
    return undefined;
  }
  return normalized;
}, statusFiltroSchema.optional());

const dateSchema = z
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
    z.date({ invalid_type_error: 'Data inválida' }),
  )
  .optional();

const aulaIdSchema = z.string().uuid('Identificador da aula inválido').nullish();
const inscricaoIdSchema = z.string().uuid('Identificador da inscrição inválido');
const origemIdSchema = z.string().uuid('Identificador da origem inválido').nullish();

const justificativaSchema = z
  .string({ invalid_type_error: 'Justificativa deve ser um texto' })
  .trim()
  .min(1, 'Justificativa deve conter ao menos 1 caractere')
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
    tipoOrigem: tipoOrigemSchema.optional().default('AULA'),
    origemId: origemIdSchema,
    origemTitulo: z.string().trim().min(1).max(255).nullish(),
    dataReferencia: dateSchema,
    status: statusSchema,
    modoLancamento: modoLancamentoSchema.optional().default('MANUAL'),
    minutosPresenca: z.number().int().min(0).max(1440).optional(),
    minimoMinutosParaPresenca: z.number().int().min(1).max(1440).optional(),
    justificativa: justificativaSchema,
    observacoes: observacoesSchema,
  })
  .refine(
    (data) => {
      if (data.tipoOrigem === 'AULA') {
        return !!(data.origemId ?? data.aulaId);
      }
      return !!data.origemId;
    },
    {
      path: ['origemId'],
      message: 'origemId é obrigatório para o tipo de origem informado',
    },
  )
  .refine(
    (data) =>
      data.status === 'JUSTIFICADO' || data.status === 'AUSENTE'
        ? !!data.justificativa?.trim()
        : true,
    {
      path: ['justificativa'],
      message: 'Justificativa é obrigatória para status AUSENTE ou JUSTIFICADO',
    },
  );

export const updateFrequenciaSchema = z
  .object({
    aulaId: aulaIdSchema.optional(),
    tipoOrigem: tipoOrigemSchema.optional(),
    origemId: origemIdSchema.optional(),
    origemTitulo: z.string().trim().min(1).max(255).nullish().optional(),
    dataReferencia: dateSchema,
    status: statusSchema.optional(),
    modoLancamento: modoLancamentoSchema.optional(),
    minutosPresenca: z.number().int().min(0).max(1440).optional(),
    minimoMinutosParaPresenca: z.number().int().min(1).max(1440).optional(),
    justificativa: justificativaSchema.optional(),
    observacoes: observacoesSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualização da frequência',
  })
  .refine(
    (data) => {
      if (data.status !== 'JUSTIFICADO' && data.status !== 'AUSENTE') {
        return true;
      }
      return !!data.justificativa && data.justificativa.trim().length > 0;
    },
    {
      path: ['justificativa'],
      message: 'Justificativa é obrigatória quando o status for AUSENTE ou JUSTIFICADO',
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
  )
  .refine(
    (data) => {
      if (!data.tipoOrigem) return true;
      if (data.tipoOrigem === 'AULA') {
        return data.origemId !== null;
      }
      return data.origemId !== null;
    },
    {
      path: ['origemId'],
      message: 'origemId é obrigatório para o tipo de origem informado',
    },
  );

export const upsertFrequenciaLancamentoSchema = z
  .object({
    inscricaoId: inscricaoIdSchema,
    tipoOrigem: tipoOrigemSchema,
    origemId: z.string().uuid('Identificador da origem inválido'),
    origemTitulo: z.string().trim().min(1).max(255).nullish(),
    status: statusSchema,
    modoLancamento: modoLancamentoSchema.optional().default('MANUAL'),
    minutosPresenca: z.number().int().min(0).max(1440).optional(),
    minimoMinutosParaPresenca: z.number().int().min(1).max(1440).optional(),
    justificativa: justificativaSchema,
    observacoes: observacoesSchema,
  })
  .refine(
    (data) =>
      data.status === 'JUSTIFICADO' || data.status === 'AUSENTE'
        ? !!data.justificativa?.trim()
        : true,
    {
      path: ['justificativa'],
      message: 'Justificativa é obrigatória para status AUSENTE ou JUSTIFICADO',
    },
  );

export const upsertFrequenciaAlunoLancamentoSchema = z
  .object({
    cursoId: uuidSchema,
    turmaId: uuidSchema,
    inscricaoId: inscricaoIdSchema,
    tipoOrigem: tipoOrigemSchema,
    origemId: z.string().uuid('Identificador da origem inválido'),
    origemTitulo: z.string().trim().min(1).max(255).nullish(),
    status: statusSchema,
    modoLancamento: modoLancamentoSchema.optional().default('MANUAL'),
    minutosPresenca: z.number().int().min(0).max(1440).optional(),
    minimoMinutosParaPresenca: z.number().int().min(1).max(1440).optional(),
    justificativa: justificativaSchema,
    observacoes: observacoesSchema,
  })
  .refine(
    (data) =>
      data.status === 'JUSTIFICADO' || data.status === 'AUSENTE'
        ? !!data.justificativa?.trim()
        : true,
    {
      path: ['justificativa'],
      message: 'Justificativa é obrigatória para status AUSENTE ou JUSTIFICADO',
    },
  );

export const listFrequenciaHistoricoNaturalQuerySchema = z.object({
  inscricaoId: uuidSchema,
  tipoOrigem: tipoOrigemSchema,
  origemId: uuidSchema,
});

export const listFrequenciaHistoricoAlunoNaturalQuerySchema = z.object({
  cursoId: uuidSchema,
  turmaId: uuidSchema,
  inscricaoId: uuidSchema,
  tipoOrigem: tipoOrigemSchema,
  origemId: uuidSchema,
});

export const listFrequenciaQuerySchema = z.object({
  tipoOrigem: normalizeOptionalTipoOrigem,
  origemId: normalizeOptionalUuid,
  inscricaoId: normalizeOptionalUuid,
  status: normalizeOptionalStatus,
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(10),
  dataInicio: dateSchema,
  dataFim: dateSchema,
});

export const listFrequenciaGeralQuerySchema = z.object({
  cursoId: normalizeOptionalUuid,
  turmaIds: z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value;
  }, z.array(uuidSchema).min(1, 'turmaIds inválido').optional()),
  tipoOrigem: normalizeOptionalTipoOrigem,
  origemId: normalizeOptionalUuid,
  inscricaoId: normalizeOptionalUuid,
  status: normalizeOptionalStatus,
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(10),
  orderBy: orderBySchema.optional(),
  order: orderSchema.optional(),
  dataInicio: dateSchema,
  dataFim: dateSchema,
});

export type ListFrequenciaQuery = z.infer<typeof listFrequenciaQuerySchema>;
export type ListFrequenciaGeralQuery = z.infer<typeof listFrequenciaGeralQuerySchema>;

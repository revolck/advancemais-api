import { z } from 'zod';

const parseCsv = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseSingleQueryValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const firstNonEmpty: string | undefined = value
      .map((item) => parseSingleQueryValue(item))
      .find((item) => typeof item === 'string' && item.length > 0);

    return firstNonEmpty || undefined;
  }

  if (typeof value === 'object') {
    const objectValues = Object.values(value as Record<string, unknown>);
    const firstNonEmpty: string | undefined = objectValues
      .map((item) => parseSingleQueryValue(item))
      .find((item) => typeof item === 'string' && item.length > 0);

    return firstNonEmpty || undefined;
  }

  const raw = String(value).trim();
  if (!raw) {
    return undefined;
  }

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      return parseSingleQueryValue(parsed);
    } catch {
      // segue o fluxo normal e deixa a validação uuid decidir
    }
  }

  const normalized = raw.replace(/^['"]+|['"]+$/g, '').trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const entrevistaStatusValues = [
  'AGENDADA',
  'CONFIRMADA',
  'REALIZADA',
  'CANCELADA',
  'REAGENDADA',
  'NAO_COMPARECEU',
] as const;

export const entrevistaModalidadeValues = ['ONLINE', 'PRESENCIAL'] as const;

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

export const entrevistasOverviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    empresaUsuarioId: z.string().uuid().optional(),
    vagaId: z.string().uuid().optional(),
    recrutadorId: z.string().uuid().optional(),
    statusEntrevista: z.preprocess(parseCsv, z.array(z.enum(entrevistaStatusValues)).default([])),
    modalidades: z.preprocess(parseCsv, z.array(z.enum(entrevistaModalidadeValues)).default([])),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    sortBy: z
      .enum(['agendadaPara', 'criadoEm', 'statusEntrevista', 'candidatoNome', 'vagaTitulo'])
      .default('agendadaPara'),
    sortDir: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((value, ctx) => {
    if (value.dataInicio && value.dataFim) {
      const start = new Date(value.dataInicio);
      const end = new Date(value.dataFim);

      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'dataFim deve ser maior ou igual a dataInicio',
        });
      }
    }
  });

export const entrevistasOpcoesVagasQuerySchema = z.object({
  empresaUsuarioId: z.preprocess(parseSingleQueryValue, z.string().uuid()),
});

export const entrevistasOpcoesCandidatosQuerySchema = z.object({
  vagaId: z.preprocess(parseSingleQueryValue, z.string().uuid()),
});

export const createEntrevistaSchema = z
  .object({
    empresaUsuarioId: z.string().uuid(),
    vagaId: z.string().uuid(),
    candidaturaId: z.string().uuid(),
    candidatoId: z.string().uuid().optional(),
    modalidade: z.enum(entrevistaModalidadeValues),
    dataInicio: z.string().datetime(),
    dataFim: z.string().datetime(),
    descricao: z.string().trim().max(5000).optional(),
    enderecoPresencial: enderecoPresencialSchema.optional(),
    gerarMeet: z.coerce.boolean().optional(),
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
        message: 'enderecoPresencial só pode ser usado com modalidade PRESENCIAL',
      });
    }

    if (value.modalidade !== 'ONLINE' && value.gerarMeet === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gerarMeet'],
        message: 'gerarMeet só pode ser usado com modalidade ONLINE',
      });
    }
  });

export type EntrevistasOverviewQuery = z.infer<typeof entrevistasOverviewQuerySchema>;
export type EntrevistasOpcoesVagasQuery = z.infer<typeof entrevistasOpcoesVagasQuerySchema>;
export type EntrevistasOpcoesCandidatosQuery = z.infer<
  typeof entrevistasOpcoesCandidatosQuerySchema
>;
export type CreateEntrevistaInput = z.infer<typeof createEntrevistaSchema>;

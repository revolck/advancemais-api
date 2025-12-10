import { z } from 'zod';

const booleanPreprocessor = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'nao', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}, z.boolean().optional());

// Preprocessor para datas - aceita ISO string ou YYYY-MM-DD
const datePreprocessor = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  // Tenta parsear a data
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}, z.date().optional());

const statusListPreprocessor = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const entries = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

  // Retorna lista única de IDs (UUIDs)
  const unique = Array.from(new Set(entries.map((item) => String(item))));
  return unique;
}, z.array(z.string().uuid()).optional());

// Validador para search que aceita UUID ou texto com mínimo de 3 caracteres
const searchPreprocessor = z.preprocess(
  (value) => {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    // Se for UUID válido, aceitar mesmo que tenha menos de 3 caracteres (UUIDs têm 36)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmed)) {
      return trimmed;
    }
    // Caso contrário, validar mínimo de 3 caracteres
    if (trimmed.length < 3) {
      return undefined;
    }
    return trimmed;
  },
  z.string().max(180).optional(),
);

export const candidaturasOverviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    vagaId: z.string().uuid().optional(),
    empresaUsuarioId: z.string().uuid().optional(),
    search: searchPreprocessor,
    status: statusListPreprocessor,
    onlyWithCandidaturas: booleanPreprocessor,
    // Filtros de data de candidatura (aplicadaEm)
    aplicadaDe: datePreprocessor,
    aplicadaAte: datePreprocessor,
  })
  .transform((value) => ({
    ...value,
    status: value.status ?? [],
    onlyWithCandidaturas: value.onlyWithCandidaturas ?? undefined,
  }));

export type CandidaturasOverviewQuery = z.infer<typeof candidaturasOverviewQuerySchema>;

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

export const candidaturasOverviewQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    vagaId: z.string().uuid().optional(),
    empresaUsuarioId: z.string().uuid().optional(),
    search: z
      .string()
      .trim()
      .min(3, 'A busca deve conter ao menos 3 caracteres')
      .max(180)
      .optional(),
    status: statusListPreprocessor,
    onlyWithCandidaturas: booleanPreprocessor,
  })
  .transform((value) => ({
    ...value,
    status: value.status ?? [],
    onlyWithCandidaturas: value.onlyWithCandidaturas ?? undefined,
  }));

export type CandidaturasOverviewQuery = z.infer<typeof candidaturasOverviewQuerySchema>;

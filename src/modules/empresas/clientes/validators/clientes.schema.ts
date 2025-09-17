import { z } from 'zod';

export const clientePlanoTipoSchema = z.enum([
  '7_dias',
  '15_dias',
  '30_dias',
  '60_dias',
  '90dias',
  '120_dias',
  'parceiro',
]);

const uuidSchema = z.string().uuid('Informe um identificador válido');

const observacaoSchema = z
  .string()
  .trim()
  .min(1, 'A observação não pode estar vazia')
  .max(500, 'A observação deve ter no máximo 500 caracteres');

export const createClientePlanoSchema = z.object({
  usuarioId: uuidSchema,
  planoEmpresarialId: uuidSchema,
  tipo: clientePlanoTipoSchema,
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  observacao: observacaoSchema.optional().nullable(),
});

export const updateClientePlanoSchema = z.object({
  planoEmpresarialId: uuidSchema.optional(),
  tipo: clientePlanoTipoSchema.optional(),
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  observacao: observacaoSchema.optional().nullable(),
});

export const listClientePlanoQuerySchema = z.object({
  usuarioId: uuidSchema.optional(),
  ativo: z
    .preprocess((value) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      const raw = Array.isArray(value) ? value[0] : value;
      if (typeof raw !== 'string') {
        return raw;
      }

      const normalized = raw.trim().toLowerCase();
      if (['true', '1'].includes(normalized)) return true;
      if (['false', '0'].includes(normalized)) return false;

      return raw;
    }, z.boolean({ invalid_type_error: 'Valor inválido para o filtro ativo' }).optional()),
});

export type CreateClientePlanoInput = z.infer<typeof createClientePlanoSchema>;
export type UpdateClientePlanoInput = z.infer<typeof updateClientePlanoSchema>;
export type ListClientePlanoQuery = z.infer<typeof listClientePlanoQuerySchema>;
export type ClientePlanoTipo = z.infer<typeof clientePlanoTipoSchema>;

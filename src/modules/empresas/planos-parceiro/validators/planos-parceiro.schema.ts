import { z } from 'zod';

export const planoParceiroTipoSchema = z.enum([
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

export const createPlanoParceiroSchema = z.object({
  empresaId: uuidSchema,
  planoEmpresarialId: uuidSchema,
  tipo: planoParceiroTipoSchema,
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  observacao: observacaoSchema.optional().nullable(),
});

export const updatePlanoParceiroSchema = z.object({
  planoEmpresarialId: uuidSchema.optional(),
  tipo: planoParceiroTipoSchema.optional(),
  iniciarEm: z.coerce.date({ invalid_type_error: 'Informe uma data válida' }).optional(),
  observacao: observacaoSchema.optional().nullable(),
});

export const listPlanoParceiroQuerySchema = z.object({
  empresaId: uuidSchema.optional(),
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

export type CreatePlanoParceiroInput = z.infer<typeof createPlanoParceiroSchema>;
export type UpdatePlanoParceiroInput = z.infer<typeof updatePlanoParceiroSchema>;
export type ListPlanoParceiroQuery = z.infer<typeof listPlanoParceiroQuerySchema>;
export type PlanoParceiroTipo = z.infer<typeof planoParceiroTipoSchema>;

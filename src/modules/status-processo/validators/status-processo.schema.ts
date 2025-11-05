import { z } from 'zod';

export const createStatusProcessoSchema = z.object({
  nome: z
    .string({ required_error: 'O nome do status é obrigatório.' })
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.')
    .trim(),
  descricao: z
    .string()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .trim()
    .optional()
    .or(z.literal('')),
  ativo: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateStatusProcessoSchema = createStatusProcessoSchema.partial();

export const statusProcessoFiltersSchema = z.object({
  // Aceita boolean via querystring (ex: "true", "false", 1, 0)
  ativo: z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return val;
  }, z.boolean().optional()),
  search: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  // Converte números vindos por querystring (ex: "1")
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  // Aceita parâmetros de ordenação sem quebrar a validação
  sortBy: z.enum(['nome', 'criadoEm', 'atualizadoEm']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const statusProcessoIdSchema = z.object({
  id: z.string().uuid('ID deve ser um UUID válido.'),
});

export const validate = (schema: z.ZodSchema) => {
  return (req: any, res: any, next: any) => {
    try {
      // Verifica se o schema é válido
      if (!schema || typeof schema.parse !== 'function') {
        return res.status(500).json({
          success: false,
          message: 'Erro interno: Schema de validação inválido',
          code: 'INVALID_VALIDATION_SCHEMA',
          correlationId: req.id,
          timestamp: new Date().toISOString(),
        });
      }

      const validatedData = schema.parse({
        ...req.body,
        ...req.params,
        ...req.query,
      });

      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          // received field not guaranteed across all issue types
        }));

        return res.status(400).json({
          success: false,
          message: 'Dados inválidos fornecidos. Verifique os campos obrigatórios e formatos.',
          code: 'VALIDATION_ERROR',
          errors: formattedErrors,
          correlationId: req.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Para outros tipos de erro
      return res.status(500).json({
        success: false,
        message: 'Erro interno durante validação dos dados',
        code: 'VALIDATION_INTERNAL_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        correlationId: req.id,
        timestamp: new Date().toISOString(),
      });
    }
  };
};

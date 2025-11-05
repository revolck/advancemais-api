import { CursosStatusPadrao } from '@prisma/client';
import { z } from 'zod';

const positiveInt = z.coerce
  .number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

const statusPadraoSingle = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toUpperCase())
  .pipe(z.nativeEnum(CursosStatusPadrao));

const statusPadraoFilterSchema = z
  .preprocess((input) => {
    if (Array.isArray(input)) {
      return input;
    }

    if (typeof input === 'string') {
      const parts = input
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      if (parts.length === 0) {
        return undefined;
      }

      if (parts.length === 1) {
        return parts[0];
      }

      return parts;
    }

    return input;
  }, z.union([statusPadraoSingle, z.array(statusPadraoSingle)]).optional())
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : [value];
    return Array.from(new Set(values));
  });

export const listCoursesQuerySchema = z.object({
  page: positiveInt.min(1).default(1),
  pageSize: positiveInt.min(1).max(100).default(10),
  search: z.string().trim().min(1).optional(),
  statusPadrao: statusPadraoFilterSchema,
  categoriaId: positiveInt.optional(),
  subcategoriaId: positiveInt.optional(),
  instrutorId: z.string().uuid().optional(),
  includeTurmas: z.coerce.boolean().optional(),
});

export const createCourseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  descricao: z.string().trim().max(2000).nullish(),
  cargaHoraria: positiveInt,
  categoriaId: positiveInt.optional(),
  subcategoriaId: positiveInt.optional(),
  statusPadrao: z.nativeEnum(CursosStatusPadrao).optional(),
  estagioObrigatorio: z.coerce.boolean().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

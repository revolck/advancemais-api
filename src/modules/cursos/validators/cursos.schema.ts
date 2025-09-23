import { CursosStatusPadrao } from '@prisma/client';
import { z } from 'zod';

const positiveInt = z
  .coerce.number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

const statusPadraoQuerySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.nativeEnum(CursosStatusPadrao))
  .optional();

export const listCoursesQuerySchema = z.object({
  page: positiveInt.min(1).default(1),
  pageSize: positiveInt.min(1).max(100).default(10),
  search: z.string().trim().min(1).optional(),
  statusPadrao: statusPadraoQuerySchema,
  instrutorId: z.string().uuid().optional(),
  includeTurmas: z.coerce.boolean().optional(),
});

export const createCourseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  descricao: z.string().trim().max(2000).nullish(),
  cargaHoraria: positiveInt,
  instrutorId: z.string().uuid(),
  categoriaId: positiveInt.optional(),
  subcategoriaId: positiveInt.optional(),
  statusPadrao: z.nativeEnum(CursosStatusPadrao).optional(),
  estagioObrigatorio: z.coerce.boolean().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

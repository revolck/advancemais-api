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
  imagemUrl: z
    .union([
      z.string().trim().url('URL da imagem inválida'),
      z.literal('').transform(() => null),
      z.null(),
    ])
    .optional(),
  cargaHoraria: positiveInt,
  categoriaId: positiveInt.optional(),
  subcategoriaId: positiveInt.optional(),
  statusPadrao: z.nativeEnum(CursosStatusPadrao).optional(),
  estagioObrigatorio: z.coerce.boolean().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

/**
 * Schema de validação para histórico de inscrições de um curso
 * Similar ao histórico de alunos
 */
const paginationQueryBaseSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const withDefaultPaginationValues = <T extends { page?: number; pageSize?: number }>(values: T) =>
  ({
    ...values,
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 20,
  }) as Omit<T, 'page' | 'pageSize'> & { page: number; pageSize: number };

import { StatusInscricao } from '@prisma/client';

export const cursoHistoricoInscricoesQuerySchema = paginationQueryBaseSchema
  .extend({
    status: z
      .union([
        z.nativeEnum(StatusInscricao, {
          errorMap: () => ({
            message: `Status inválido. Valores aceitos: ${Object.values(StatusInscricao).join(', ')}`,
          }),
        }),
        z.string(),
        z.array(z.nativeEnum(StatusInscricao)),
      ])
      .optional(),
    turmaId: z.string().uuid().optional(),
  })
  .transform(
    (data: {
      page?: number;
      pageSize?: number;
      status?: StatusInscricao | string | StatusInscricao[];
      turmaId?: string;
    }) => {
      // Normalizar paginação
      const pagination = withDefaultPaginationValues(data);

      // Normalizar status: converter string única, string com vírgulas ou array para array
      let statusArray: StatusInscricao[] | undefined;
      if (data.status !== undefined) {
        if (Array.isArray(data.status)) {
          statusArray = data.status;
        } else if (typeof data.status === 'string') {
          // Se contém vírgula, tratar como múltiplos status
          if (data.status.includes(',')) {
            const statuses = data.status.split(',').map((s: string) => s.trim());
            statusArray = statuses
              .map((s: string) => {
                if (Object.values(StatusInscricao).includes(s as StatusInscricao)) {
                  return s as StatusInscricao;
                }
                return null;
              })
              .filter((s: StatusInscricao | null): s is StatusInscricao => s !== null);
          } else {
            // Status único
            if (Object.values(StatusInscricao).includes(data.status as StatusInscricao)) {
              statusArray = [data.status as StatusInscricao];
            }
          }
        } else {
          // Já é StatusInscricao enum
          statusArray = [data.status];
        }
      }

      return {
        ...pagination,
        status: statusArray,
        turmaId: data.turmaId,
      };
    },
  );

export type CursoHistoricoInscricoesQuery = z.infer<typeof cursoHistoricoInscricoesQuerySchema>;

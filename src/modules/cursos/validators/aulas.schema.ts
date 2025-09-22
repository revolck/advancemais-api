import { CursosMateriais, TiposDeArquivos } from '@prisma/client';
import { z } from 'zod';

const nonNegativeInt = z
  .preprocess((value) => {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.union([z.number({ invalid_type_error: 'Informe um número válido' }).int('Valor deve ser inteiro').min(0), z.null()]))
  .optional();

const materialSchema = z.object({
  titulo: z.string().trim().min(3).max(255),
  descricao: z
    .string({ invalid_type_error: 'Descrição deve ser um texto' })
    .trim()
    .max(2000)
    .nullish(),
  tipo: z.nativeEnum(CursosMateriais),
  tipoArquivo: z.nativeEnum(TiposDeArquivos).nullish(),
  url: z
    .string({ invalid_type_error: 'Informe uma URL válida' })
    .trim()
    .url('Informe uma URL válida')
    .nullish(),
  duracaoEmSegundos: nonNegativeInt,
  tamanhoEmBytes: nonNegativeInt,
  ordem: nonNegativeInt,
});

const aulaBaseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  descricao: z
    .string({ invalid_type_error: 'Descrição deve ser um texto' })
    .trim()
    .max(2000)
    .nullish(),
  ordem: nonNegativeInt,
  materiais: z.array(materialSchema).optional(),
});

export const createAulaSchema = aulaBaseSchema;

export const updateAulaSchema = aulaBaseSchema.partial();

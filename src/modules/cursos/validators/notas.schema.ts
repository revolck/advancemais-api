import { z } from 'zod';

const notaTipos = [
  'PROVA',
  'TRABALHO',
  'ATIVIDADE',
  'PROJETO',
  'SEMINARIO',
  'PARTICIPACAO',
  'SIMULADO',
  'BONUS',
  'OUTRO',
] as const;

const notaTipoSchema = z.enum(notaTipos);

type NotaTipo = (typeof notaTipos)[number];
type NotaTipoQueExigeTitulo = Exclude<NotaTipo, 'PROVA'>;

const tiposQueExigemTitulo = notaTipos.filter(
  (tipo): tipo is NotaTipoQueExigeTitulo => tipo !== 'PROVA',
);

const tipoExigeTitulo = (tipo: NotaTipo | undefined): tipo is NotaTipoQueExigeTitulo =>
  !!tipo && tipo !== 'PROVA' && tiposQueExigemTitulo.includes(tipo as NotaTipoQueExigeTitulo);

const decimalNotaSchema = z
  .number({ invalid_type_error: 'Nota deve ser um número' })
  .min(0, 'Nota mínima é 0')
  .max(10, 'Nota máxima é 10');

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .min(0, 'Peso deve ser maior ou igual a zero')
  .max(1000, 'Peso deve ser menor ou igual a 1000');

const valorMaximoSchema = z
  .number({ invalid_type_error: 'Valor máximo deve ser um número' })
  .min(0, 'Valor máximo deve ser maior ou igual a zero')
  .max(10, 'Valor máximo deve ser menor ou igual a 10');

const dataSchema = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      if (value instanceof Date) {
        return value;
      }
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? value : parsed;
    },
    z.date({ invalid_type_error: 'Data inválida' }),
  )
  .optional();

const tituloSchema = z
  .string({ invalid_type_error: 'Título deve ser um texto' })
  .trim()
  .min(3, 'Título deve conter ao menos 3 caracteres')
  .max(255);

const descricaoSchema = z
  .string({ invalid_type_error: 'Descrição deve ser um texto' })
  .trim()
  .max(1000)
  .nullish();

const observacoesSchema = z
  .string({ invalid_type_error: 'Observações devem ser um texto' })
  .trim()
  .max(500)
  .nullish();

const referenciaExternaSchema = z
  .string({ invalid_type_error: 'Referência externa deve ser um texto' })
  .trim()
  .max(120)
  .nullish();

export const createNotaSchema = z
  .object({
    inscricaoId: z.string().uuid('Identificador da inscrição inválido'),
    tipo: notaTipoSchema,
    provaId: z.string().uuid('Identificador da prova inválido').nullish(),
    referenciaExterna: referenciaExternaSchema,
    titulo: tituloSchema.nullish(),
    descricao: descricaoSchema,
    nota: decimalNotaSchema.nullish(),
    peso: pesoSchema.nullish(),
    valorMaximo: valorMaximoSchema.nullish(),
    dataReferencia: dataSchema,
    observacoes: observacoesSchema,
  })
  .refine((data) => (data.tipo === 'PROVA' ? !!data.provaId : true), {
    path: ['provaId'],
    message: 'provaId é obrigatório para notas de prova',
  })
  .refine((data) => (data.tipo !== 'PROVA' ? !!data.titulo?.trim() : true), {
    path: ['titulo'],
    message: 'Título é obrigatório para notas que não são de prova',
  });

export const updateNotaSchema = z
  .object({
    tipo: notaTipoSchema.optional(),
    provaId: z.string().uuid('Identificador da prova inválido').nullish().optional(),
    referenciaExterna: referenciaExternaSchema,
    titulo: tituloSchema.nullish().optional(),
    descricao: descricaoSchema.optional(),
    nota: decimalNotaSchema.nullish().optional(),
    peso: pesoSchema.nullish().optional(),
    valorMaximo: valorMaximoSchema.nullish().optional(),
    dataReferencia: dataSchema,
    observacoes: observacoesSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualização da nota',
  })
  .refine(
    (data) =>
      data.titulo !== undefined ? (data.tipo === 'PROVA' ? true : !!data.titulo?.trim()) : true,
    {
      path: ['titulo'],
      message: 'Título não pode ser vazio para notas que não são de prova',
    },
  )
  .refine(
    (data) =>
      tipoExigeTitulo(data.tipo) ? data.titulo === undefined || !!data.titulo?.trim() : true,
    {
      path: ['titulo'],
      message: 'Forneça um título válido ao alterar o tipo da nota',
    },
  )
  .refine((data) => (data.tipo === 'PROVA' ? data.provaId !== null : true), {
    path: ['provaId'],
    message: 'provaId não pode ser nulo para notas de prova',
  });

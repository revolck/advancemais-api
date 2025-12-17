import { CursosTipoQuestao } from '@prisma/client';
import { z } from 'zod';

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .gt(0, 'Peso deve ser maior que zero')
  .max(1000, 'Peso deve ser menor ou igual a 1000');

const ordemSchema = z
  .number({ invalid_type_error: 'Ordem deve ser um número' })
  .int('Ordem deve ser inteiro')
  .min(0, 'Ordem deve ser maior ou igual a zero');

const alternativaSchema = z.object({
  texto: z
    .string({ invalid_type_error: 'Texto da alternativa deve ser um texto' })
    .trim()
    .min(1, 'Texto da alternativa não pode estar vazio')
    .max(1000, 'Texto da alternativa deve ter no máximo 1000 caracteres'),
  ordem: ordemSchema.optional(),
  correta: z.boolean().optional().default(false),
});

const questaoBaseSchema = z.object({
  enunciado: z
    .string({ invalid_type_error: 'Enunciado deve ser um texto' })
    .trim()
    .min(1, 'Enunciado não pode estar vazio')
    .max(2000, 'Enunciado deve ter no máximo 2000 caracteres'),
  tipo: z.nativeEnum(CursosTipoQuestao, {
    errorMap: () => ({ message: 'Tipo de questão inválido' }),
  }),
  ordem: ordemSchema.optional(),
  peso: pesoSchema.optional(),
  obrigatoria: z.boolean().optional().default(true),
});

export const createQuestaoSchema = questaoBaseSchema
  .extend({
    alternativas: z.array(alternativaSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA) {
      if (!data.alternativas || data.alternativas.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Questões de múltipla escolha devem ter pelo menos 2 alternativas',
          path: ['alternativas'],
        });
        return;
      }
      const corretas = data.alternativas.filter((alt) => alt.correta).length;
      if (corretas !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Questões de múltipla escolha devem ter exatamente 1 alternativa correta',
          path: ['alternativas'],
        });
      }
    }
  });

export const updateQuestaoSchema = questaoBaseSchema.partial().extend({
  alternativas: z
    .array(alternativaSchema.extend({ id: z.string().uuid().optional() }))
    .optional(),
});

export const createAlternativaSchema = z.object({
  texto: z
    .string({ invalid_type_error: 'Texto da alternativa deve ser um texto' })
    .trim()
    .min(1, 'Texto da alternativa não pode estar vazio')
    .max(1000, 'Texto da alternativa deve ter no máximo 1000 caracteres'),
  ordem: ordemSchema.optional(),
  correta: z.boolean().optional().default(false),
});

export const updateAlternativaSchema = createAlternativaSchema.partial();

export const responderQuestaoSchema = z.object({
  respostaTexto: z
    .string({ invalid_type_error: 'Resposta deve ser um texto' })
    .trim()
    .max(10000)
    .optional(),
  alternativaId: z.string().uuid('Identificador de alternativa inválido').optional(),
  anexoUrl: z
    .string({ invalid_type_error: 'URL do anexo deve ser um texto' })
    .url('URL do anexo inválida')
    .max(500)
    .optional(),
  anexoNome: z
    .string({ invalid_type_error: 'Nome do anexo deve ser um texto' })
    .trim()
    .max(255)
    .optional(),
});

export const corrigirRespostaSchema = z.object({
  nota: z
    .number({ invalid_type_error: 'Nota deve ser um número' })
    .min(0, 'Nota mínima é 0')
    .max(10, 'Nota máxima é 10')
    .optional(),
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(1000)
    .optional(),
  corrigida: z.boolean().optional(),
});


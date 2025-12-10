import {
  Jornadas,
  ModalidadesDeVagas,
  RegimesDeTrabalhos,
  Senioridade,
  StatusDeVagas,
} from '@prisma/client';
import { z } from 'zod';

const slugField = z
  .string({
    required_error: 'O slug é obrigatório',
    invalid_type_error: 'O slug deve ser um texto',
  })
  .trim()
  .min(3, 'O slug deve ter pelo menos 3 caracteres')
  .max(120, 'O slug deve ter no máximo 120 caracteres')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'O slug deve conter apenas letras minúsculas, números e hífens',
  );

const descricaoOpcional = z
  .string({ invalid_type_error: 'A descrição deve ser um texto' })
  .trim()
  .min(1, 'A descrição deve ter pelo menos 1 caractere')
  .max(8000, 'A descrição deve ter no máximo 8000 caracteres')
  .optional();

const stringArrayField = (field: string) =>
  z
    .array(
      z
        .string({ invalid_type_error: `${field} deve ser um texto` })
        .trim()
        .min(1, `${field} deve ter pelo menos 1 caractere`)
        .max(255, `${field} deve ter no máximo 255 caracteres`),
      { invalid_type_error: `${field} deve ser uma lista de textos` },
    )
    .max(50, `${field} deve conter no máximo 50 itens`);

const requisitosSchema = z.object({
  obrigatorios: stringArrayField('Cada requisito obrigatório').min(
    1,
    'Informe pelo menos um requisito obrigatório',
  ),
  desejaveis: stringArrayField('Cada requisito desejável').optional().default([]),
});

const atividadesSchema = z.object({
  principais: stringArrayField('Cada atividade principal').min(
    1,
    'Informe pelo menos uma atividade principal',
  ),
  extras: stringArrayField('Cada atividade extra').optional().default([]),
});

const beneficiosSchema = z
  .object({
    lista: stringArrayField('Cada benefício').optional().default([]),
    observacoes: z
      .string({ invalid_type_error: 'As observações devem ser um texto' })
      .trim()
      .max(2000, 'As observações devem ter no máximo 2000 caracteres')
      .optional(),
  })
  .optional();

const localizacaoSchema = z
  .object({
    logradouro: z
      .string({ invalid_type_error: 'O logradouro deve ser um texto' })
      .trim()
      .min(1, 'O logradouro deve ter pelo menos 1 caractere')
      .max(255, 'O logradouro deve ter no máximo 255 caracteres')
      .optional(),
    numero: z
      .string({ invalid_type_error: 'O número deve ser um texto' })
      .trim()
      .min(1, 'O número deve ter pelo menos 1 caractere')
      .max(50, 'O número deve ter no máximo 50 caracteres')
      .optional(),
    bairro: z
      .string({ invalid_type_error: 'O bairro deve ser um texto' })
      .trim()
      .min(1, 'O bairro deve ter pelo menos 1 caractere')
      .max(255, 'O bairro deve ter no máximo 255 caracteres')
      .optional(),
    cidade: z
      .string({ invalid_type_error: 'A cidade deve ser um texto' })
      .trim()
      .min(1, 'A cidade deve ter pelo menos 1 caractere')
      .max(255, 'A cidade deve ter no máximo 255 caracteres')
      .optional(),
    estado: z
      .string({ invalid_type_error: 'O estado deve ser um texto' })
      .trim()
      .min(2, 'O estado deve ter pelo menos 2 caracteres')
      .max(50, 'O estado deve ter no máximo 50 caracteres')
      .optional(),
    cep: z
      .string({ invalid_type_error: 'O CEP deve ser um texto' })
      .trim()
      .min(5, 'O CEP deve ter pelo menos 5 caracteres')
      .max(20, 'O CEP deve ter no máximo 20 caracteres')
      .optional(),
    complemento: z
      .string({ invalid_type_error: 'O complemento deve ser um texto' })
      .trim()
      .max(255, 'O complemento deve ter no máximo 255 caracteres')
      .optional(),
    referencia: z
      .string({ invalid_type_error: 'A referência deve ser um texto' })
      .trim()
      .max(255, 'A referência deve ter no máximo 255 caracteres')
      .optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined && field !== null), {
    message: 'Informe ao menos um campo de localização ou omita o objeto por completo',
  })
  .optional();

const decimalField = (field: string) =>
  z
    .union([
      z
        .string({ invalid_type_error: `${field} deve ser um texto` })
        .trim()
        .regex(/^(\d+)([\.,]\d{1,2})?$/, `${field} deve estar no formato 9999.99`),
      z
        .number({ invalid_type_error: `${field} deve ser um número` })
        .finite(`${field} deve ser um número finito`)
        .nonnegative(`${field} deve ser maior ou igual a zero`),
    ])
    .transform((value) => {
      if (typeof value === 'number') {
        return value.toFixed(2);
      }

      return value.replace(',', '.');
    });

const optionalLongTextField = (field: string) =>
  z
    .string({ invalid_type_error: `${field} deve ser um texto` })
    .trim()
    .max(5000, `${field} deve ter no máximo 5000 caracteres`)
    .optional();

const dateField = (field: string) =>
  z.coerce.date({
    invalid_type_error: `${field} deve ser uma data válida`,
    required_error: `${field} é obrigatório`,
  });

const baseVagaSchemaRaw = z.object({
  usuarioId: z
    .string({
      required_error: 'O ID do usuário é obrigatório',
      invalid_type_error: 'O ID do usuário deve ser uma string',
    })
    .uuid('O ID do usuário deve ser um UUID válido'),
  // Aceitar UUID OU INT no areaInteresseId (frontend envia UUID de categorias aqui)
  areaInteresseId: z.union([z.string().uuid(), z.coerce.number().int().positive()]).optional(),
  subareaInteresseId: z.union([z.string().uuid(), z.coerce.number().int().positive()]).optional(),
  // Categorias de vagas (UUID) - opcional
  categoriaVagaId: z.string().uuid().optional(),
  subcategoriaVagaId: z.string().uuid().optional(),
  slug: slugField,
  modoAnonimo: z
    .boolean({ invalid_type_error: 'modoAnonimo deve ser verdadeiro ou falso' })
    .optional(),
  regimeDeTrabalho: z.nativeEnum(RegimesDeTrabalhos, {
    required_error: 'O regime de trabalho é obrigatório',
    invalid_type_error: 'regimeDeTrabalho inválido',
  }),
  modalidade: z.nativeEnum(ModalidadesDeVagas, {
    required_error: 'A modalidade da vaga é obrigatória',
    invalid_type_error: 'modalidade inválida',
  }),
  titulo: z
    .string({
      required_error: 'O título da vaga é obrigatório',
      invalid_type_error: 'O título da vaga deve ser um texto',
    })
    .trim()
    .min(3, 'O título da vaga deve ter pelo menos 3 caracteres')
    .max(255, 'O título da vaga deve ter no máximo 255 caracteres'),
  paraPcd: z.boolean({ invalid_type_error: 'paraPcd deve ser verdadeiro ou falso' }).optional(),
  vagaEmDestaque: z
    .boolean({ invalid_type_error: 'vagaEmDestaque deve ser verdadeiro ou falso' })
    .optional(),
  numeroVagas: z.coerce
    .number({ invalid_type_error: 'O número de vagas deve ser um número' })
    .int('O número de vagas deve ser um inteiro')
    .positive('O número de vagas deve ser maior que zero')
    .max(9999, 'O número de vagas deve ser menor que 10000')
    .optional(),
  descricao: descricaoOpcional,
  requisitos: requisitosSchema,
  atividades: atividadesSchema,
  beneficios: beneficiosSchema,
  observacoes: optionalLongTextField('As observações da vaga'),
  jornada: z.nativeEnum(Jornadas, {
    required_error: 'A jornada é obrigatória',
    invalid_type_error: 'jornada inválida',
  }),
  senioridade: z
    .nativeEnum(Senioridade, {
      invalid_type_error: 'senioridade inválida',
    })
    .optional(),
  inscricoesAte: dateField('A data limite de inscrições').optional(),
  inseridaEm: dateField('A data de publicação da vaga').optional(),
  localizacao: localizacaoSchema,
  salarioMin: decimalField('O salário mínimo').optional(),
  salarioMax: decimalField('O salário máximo').optional(),
  salarioConfidencial: z
    .boolean({ invalid_type_error: 'O campo salarioConfidencial deve ser verdadeiro ou falso' })
    .optional(),
});

export const createVagaSchema = baseVagaSchemaRaw.superRefine((data, ctx) => {
  // Validação: salarioMin é obrigatório se salarioConfidencial = false
  if (data.salarioConfidencial === false) {
    if (!data.salarioMin || Number(data.salarioMin) <= 0) {
      ctx.addIssue({
        path: ['salarioMin'],
        code: z.ZodIssueCode.custom,
        message: 'O salário mínimo é obrigatório quando o salário não é confidencial',
      });
    }
  }

  // Validação: salarioMax deve ser maior que salarioMin
  if (data.salarioMin && data.salarioMax) {
    const min = Number(data.salarioMin);
    const max = Number(data.salarioMax);
    if (!Number.isNaN(min) && !Number.isNaN(max) && max < min) {
      ctx.addIssue({
        path: ['salarioMax'],
        code: z.ZodIssueCode.custom,
        message: 'O salário máximo deve ser maior ou igual ao salário mínimo',
      });
    }
  }
});

export const updateVagaSchema = baseVagaSchemaRaw
  .partial()
  .extend({
    descricao: descricaoOpcional.or(z.null()).optional(),
    requisitos: requisitosSchema.or(z.null()).optional(),
    atividades: atividadesSchema.or(z.null()).optional(),
    beneficios: beneficiosSchema.or(z.null()).optional(),
    observacoes: optionalLongTextField('As observações da vaga').or(z.null()).optional(),
    inscricoesAte: z.union([dateField('A data limite de inscrições'), z.null()]).optional(),
    inseridaEm: dateField('A data de publicação da vaga').optional(),
    status: z
      .nativeEnum(StatusDeVagas, {
        invalid_type_error: 'status inválido',
        required_error: 'O status da vaga é obrigatório',
      })
      .optional(),
    localizacao: localizacaoSchema.or(z.null()).optional(),
    salarioMin: decimalField('O salário mínimo').or(z.null()).optional(),
    salarioMax: decimalField('O salário máximo').or(z.null()).optional(),
    salarioConfidencial: z
      .boolean({ invalid_type_error: 'O campo salarioConfidencial deve ser verdadeiro ou falso' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const areaProvided = Object.prototype.hasOwnProperty.call(data, 'areaInteresseId');
    const subareaProvided = Object.prototype.hasOwnProperty.call(data, 'subareaInteresseId');

    if (areaProvided && !subareaProvided) {
      ctx.addIssue({
        path: ['subareaInteresseId'],
        code: z.ZodIssueCode.custom,
        message: 'Informe a subárea de interesse ao alterar a área.',
      });
    }
  });

export type CreateVagaInput = z.infer<typeof createVagaSchema>;
export type UpdateVagaInput = z.infer<typeof updateVagaSchema>;

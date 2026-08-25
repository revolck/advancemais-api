import { z } from 'zod';

const modalidadeEnum = z.enum(['ONLINE', 'PRESENCIAL', 'AO_VIVO', 'SEMIPRESENCIAL']);
const tipoAvaliacaoEnum = z.enum(['PROVA', 'ATIVIDADE']);
const tipoAtividadeEnum = z.enum(['QUESTOES', 'TEXTO', 'PERGUNTA_RESPOSTA', 'ENVIO_MATERIAL']);

const dataYmdSchema = z
  .preprocess(
    (value) => {
      if (!value || value === '') return undefined;
      const strValue = value instanceof Date ? value.toISOString() : String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) return strValue;
      const dateMatch = strValue.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
      const date = new Date(strValue);
      return Number.isNaN(date.getTime()) ? strValue : date.toISOString().split('T')[0];
    },
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD')
      .optional(),
  )
  .optional();

const horaHmSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM')
  .optional();

const ordemSchema = z
  .number({ invalid_type_error: 'Ordem deve ser um número' })
  .int('Ordem deve ser inteiro')
  .min(0, 'Ordem deve ser maior ou igual a zero');

/**
 * Schema de validação para query de listagem de provas/atividades
 */
export const listProvasQuerySchema = z.object({
  search: z
    .string({ invalid_type_error: 'Busca deve ser um texto' })
    .trim()
    .min(1, 'Busca deve ter pelo menos 1 caractere')
    .optional(),
  turmaId: z
    .string({ invalid_type_error: 'ID da turma deve ser um texto' })
    .uuid('ID da turma deve ser um UUID válido')
    .optional(),
  status: z
    .enum(['ATIVO', 'INATIVO'], {
      errorMap: () => ({ message: 'Status deve ser ATIVO ou INATIVO' }),
    })
    .optional(),
  tipo: z
    .enum(['PROVA', 'ATIVIDADE'], {
      errorMap: () => ({ message: 'Tipo deve ser PROVA ou ATIVIDADE' }),
    })
    .optional(),
});

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .gt(0, 'Peso deve ser maior que zero')
  .max(1000, 'Peso deve ser menor ou igual a 1000');

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

const provaBaseSchema = z.object({
  titulo: z.string().trim().min(3).max(255),
  etiqueta: z.string().trim().min(1).max(30),
  tipo: tipoAvaliacaoEnum.optional().default('PROVA'),
  tipoAtividade: tipoAtividadeEnum.optional().nullable(),
  descricao: z
    .string({ invalid_type_error: 'Descrição deve ser um texto' })
    .trim()
    .max(2000)
    .nullish(),
  peso: pesoSchema,
  valePonto: z.boolean().optional().default(true),
  moduloId: z
    .string({ invalid_type_error: 'Identificador do módulo deve ser um texto' })
    .uuid('Identificador de módulo inválido')
    .nullish(),
  ativo: z.boolean().optional(),
  ordem: ordemSchema.optional(),
  // Instrutor responsável e agendamento — usados apenas quando modalidade === 'AO_VIVO'
  // para criar a sala do Google Meet (ver meetOrchestrationService.ensureMeetParaProvaOuAtividade)
  instrutorId: z
    .string({ invalid_type_error: 'Identificador do instrutor deve ser um texto' })
    .uuid('Identificador de instrutor inválido')
    .nullish(),
  modalidade: modalidadeEnum.optional(),
  dataInicio: dataYmdSchema,
  dataFim: dataYmdSchema,
  horaInicio: horaHmSchema,
  // O frontend envia "horaFim" (não "horaTermino") no payload desta rota — mapeado para
  // a coluna `horaTermino` do Prisma dentro de provas.service.ts.
  horaFim: horaHmSchema,
});

export const createProvaSchema = provaBaseSchema;

export const updateProvaSchema = provaBaseSchema.partial({ peso: true });

export const registrarNotaSchema = z.object({
  inscricaoId: z.string().uuid('Identificador da inscrição inválido'),
  nota: z
    .number({ invalid_type_error: 'Nota deve ser um número' })
    .min(0, 'Nota mínima é 0')
    .max(10, 'Nota máxima é 10'),
  pesoTotal: pesoSchema.nullish(),
  realizadoEm: dataSchema,
  observacoes: z
    .string({ invalid_type_error: 'Observações devem ser um texto' })
    .trim()
    .max(1000)
    .nullish(),
});

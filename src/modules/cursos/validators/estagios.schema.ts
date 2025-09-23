import { CursosEstagioDiaSemana, CursosEstagioStatus } from '@prisma/client';
import { z } from 'zod';

const isoTimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const nullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null));

const nullableEmail = z
  .string()
  .trim()
  .email('Informe um email válido')
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const cepSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/u, 'CEP deve estar no formato 00000-000')
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const horarioSchema = z
  .string()
  .trim()
  .regex(isoTimeRegex, 'Horário deve estar no formato HH:mm')
  .nullish()
  .transform((value) => (value && value.length > 0 ? value : null));

const diasSemanaSchema = z
  .array(z.nativeEnum(CursosEstagioDiaSemana))
  .min(1, 'Selecione ao menos um dia da semana')
  .optional();

const dataCoercion = z.coerce.date({ invalid_type_error: 'Informe uma data válida' });

const estagioLocalSchema = z.object({
  titulo: nullableString(120),
  empresaNome: z.string().trim().min(2).max(255),
  empresaDocumento: nullableString(20),
  contatoNome: nullableString(120),
  contatoEmail: nullableEmail,
  contatoTelefone: nullableString(30),
  dataInicio: dataCoercion.optional(),
  dataFim: dataCoercion.optional(),
  horarioInicio: horarioSchema,
  horarioFim: horarioSchema,
  diasSemana: diasSemanaSchema,
  cargaHorariaSemanal: z.coerce.number().int().positive().optional(),
  cep: cepSchema,
  logradouro: nullableString(255),
  numero: nullableString(20),
  bairro: nullableString(120),
  cidade: nullableString(120),
  estado: nullableString(2),
  complemento: nullableString(120),
  pontoReferencia: nullableString(255),
  observacoes: nullableString(500),
}).superRefine((value, ctx) => {
  if (value.dataInicio && value.dataFim && value.dataFim < value.dataInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data final não pode ser anterior à data inicial',
      path: ['dataFim'],
    });
  }
});

const estagioBaseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  descricao: nullableString(2000),
  dataInicio: dataCoercion,
  dataFim: dataCoercion,
  cargaHoraria: z.coerce.number().int().positive().optional(),
  empresaPrincipal: nullableString(255),
  obrigatorio: z.coerce.boolean().optional(),
  observacoes: nullableString(2000),
  locais: z.array(estagioLocalSchema).min(1, 'Informe ao menos um local para o estágio'),
});

export const createEstagioSchema = estagioBaseSchema.refine(
  (value) => value.dataFim >= value.dataInicio,
  {
    message: 'Data de término deve ser posterior à data de início',
    path: ['dataFim'],
  },
);

export const updateEstagioSchema = estagioBaseSchema.partial().superRefine((value, ctx) => {
  if (value.dataInicio && value.dataFim && value.dataFim < value.dataInicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data de término deve ser posterior à data de início',
      path: ['dataFim'],
    });
  }
});

export const updateEstagioStatusSchema = z
  .object({
    status: z.nativeEnum(CursosEstagioStatus),
    reprovadoMotivo: nullableString(2000),
    concluidoEm: dataCoercion.optional(),
    observacoes: nullableString(2000),
  })
  .superRefine((value, ctx) => {
    if (value.status === CursosEstagioStatus.REPROVADO && !value.reprovadoMotivo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o motivo do não aproveitamento do estágio',
        path: ['reprovadoMotivo'],
      });
    }

    if (value.status === CursosEstagioStatus.CONCLUIDO && !value.concluidoEm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a data de conclusão do estágio',
        path: ['concluidoEm'],
      });
    }
  });

export const confirmarEstagioSchema = z.object({
  ip: optionalString(45),
  deviceTipo: optionalString(50),
  deviceDescricao: optionalString(120),
  deviceId: optionalString(120),
  sistemaOperacional: optionalString(120),
  navegador: optionalString(120),
  localizacao: optionalString(255),
});

export const reenviarConfirmacaoSchema = z.object({
  destinatarioAlternativo: optionalString(255),
});

export type EstagioCreateInput = z.infer<typeof createEstagioSchema>;
export type EstagioUpdateInput = z.infer<typeof updateEstagioSchema>;
export type EstagioStatusInput = z.infer<typeof updateEstagioStatusSchema>;
export type EstagioConfirmacaoInput = z.infer<typeof confirmarEstagioSchema>;
export type EstagioLocalInput = z.infer<typeof estagioLocalSchema>;

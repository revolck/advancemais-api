import { Jornadas, ModalidadesDeVagas, RegimesDeTrabalhos, Senioridade, StatusDeVagas } from '@prisma/client';
import { z } from 'zod';

const longTextField = (field: string) =>
  z
    .string({ required_error: `${field} é obrigatório`, invalid_type_error: `${field} deve ser um texto` })
    .trim()
    .min(1, `${field} é obrigatório`)
    .max(5000, `${field} deve ter no máximo 5000 caracteres`);

const optionalLongTextField = (field: string) =>
  z
    .string({ invalid_type_error: `${field} deve ser um texto` })
    .trim()
    .max(5000, `${field} deve ter no máximo 5000 caracteres`)
    .optional();

const dateField = (field: string) =>
  z.coerce.date({ invalid_type_error: `${field} deve ser uma data válida`, required_error: `${field} é obrigatório` });

const baseVagaSchema = z.object({
  usuarioId: z
    .string({ required_error: 'O ID do usuário é obrigatório', invalid_type_error: 'O ID do usuário deve ser uma string' })
    .uuid('O ID do usuário deve ser um UUID válido'),
  modoAnonimo: z.boolean({ invalid_type_error: 'modoAnonimo deve ser verdadeiro ou falso' }).optional(),
  regimeDeTrabalho: z.nativeEnum(RegimesDeTrabalhos, {
    required_error: 'O regime de trabalho é obrigatório',
    invalid_type_error: 'regimeDeTrabalho inválido',
  }),
  modalidade: z.nativeEnum(ModalidadesDeVagas, {
    required_error: 'A modalidade da vaga é obrigatória',
    invalid_type_error: 'modalidade inválida',
  }),
  titulo: z
    .string({ required_error: 'O título da vaga é obrigatório', invalid_type_error: 'O título da vaga deve ser um texto' })
    .trim()
    .min(3, 'O título da vaga deve ter pelo menos 3 caracteres')
    .max(255, 'O título da vaga deve ter no máximo 255 caracteres'),
  paraPcd: z.boolean({ invalid_type_error: 'paraPcd deve ser verdadeiro ou falso' }).optional(),
  requisitos: longTextField('Os requisitos da vaga'),
  atividades: longTextField('As atividades da vaga'),
  beneficios: longTextField('Os benefícios da vaga'),
  observacoes: optionalLongTextField('As observações da vaga'),
  jornada: z.nativeEnum(Jornadas, {
    required_error: 'A jornada é obrigatória',
    invalid_type_error: 'jornada inválida',
  }),
  senioridade: z.nativeEnum(Senioridade, {
    required_error: 'A senioridade da vaga é obrigatória',
    invalid_type_error: 'senioridade inválida',
  }),
  inscricoesAte: dateField('A data limite de inscrições').optional(),
  inseridaEm: dateField('A data de publicação da vaga').optional(),
});

export const createVagaSchema = baseVagaSchema;

export const updateVagaSchema = baseVagaSchema.partial().extend({
  inscricoesAte: z
    .union([
      dateField('A data limite de inscrições'),
      z.null(),
    ])
    .optional(),
  inseridaEm: dateField('A data de publicação da vaga').optional(),
  status: z
    .nativeEnum(StatusDeVagas, {
      invalid_type_error: 'status inválido',
      required_error: 'O status da vaga é obrigatório',
    })
    .optional(),
});

export type CreateVagaInput = z.infer<typeof createVagaSchema>;
export type UpdateVagaInput = z.infer<typeof updateVagaSchema>;

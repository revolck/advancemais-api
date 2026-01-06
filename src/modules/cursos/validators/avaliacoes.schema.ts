import {
  CursosAvaliacaoTipo,
  CursosAtividadeTipo,
  CursosMetodos,
  CursosAulaStatus,
} from '@prisma/client';
import { z } from 'zod';

import { createQuestaoSchema } from './questoes.schema';

const uuid = z.string().uuid('Identificador inválido');

const ordemSchema = z
  .number({ invalid_type_error: 'Ordem deve ser um número' })
  .int('Ordem deve ser inteiro')
  .min(0, 'Ordem deve ser maior ou igual a zero');

const pesoSchema = z
  .number({ invalid_type_error: 'Peso deve ser um número' })
  .min(0, 'Peso não pode ser negativo')
  .max(10, 'Peso máximo é 10');

const parseBooleanQuery = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
};

const parseUuidQuery = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      trimmed === '' ||
      trimmed.toLowerCase() === 'nan' ||
      trimmed === 'null' ||
      trimmed === 'undefined'
    ) {
      return undefined;
    }
    return trimmed;
  }
  return value;
};

export const listAvaliacoesQuerySchema = z.object({
  cursoId: z.preprocess(parseUuidQuery, uuid.optional()),
  turmaId: z.preprocess(parseUuidQuery, uuid.optional()),
  tipo: z.nativeEnum(CursosAvaliacaoTipo).optional(),
  status: z.enum(['ATIVO', 'INATIVO']).optional(),
  semTurma: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  orderBy: z.enum(['criadoEm', 'titulo', 'ordem']).optional().default('criadoEm'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Helper para validar horário no formato HH:mm
const horarioSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido. Use o formato HH:mm (ex: 14:30)');

export const createAvaliacaoSchema = z
  .object({
    // Campos básicos
    cursoId: uuid.optional().nullable(), // ✅ Tornado opcional para permitir avaliações sem curso
    turmaId: uuid.optional().nullable(),
    instrutorId: uuid.optional().nullable(),
    tipo: z.nativeEnum(CursosAvaliacaoTipo),
    titulo: z.string().trim().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
    etiqueta: z.string().trim().optional(),
    descricao: z.string().trim().max(2000).optional().nullable(),

    // Campos de configuração
    recuperacaoFinal: z.boolean().optional().default(false),
    valePonto: z.boolean().optional().default(true),
    peso: pesoSchema,
    obrigatoria: z.boolean().optional().default(true),
    modalidade: z.nativeEnum(CursosMetodos).optional(),
    // status é definido automaticamente como RASCUNHO (não deve ser enviado na criação)

    // Tipo de atividade (apenas para ATIVIDADE)
    tipoAtividade: z.nativeEnum(CursosAtividadeTipo).optional().nullable(),

    // Período e horários
    dataInicio: z.coerce.date({
      required_error: 'Data de início é obrigatória',
      invalid_type_error: 'Data de início inválida',
    }),
    dataFim: z.coerce.date({
      required_error: 'Data de término é obrigatória',
      invalid_type_error: 'Data de término inválida',
    }),
    horaInicio: horarioSchema,
    horaTermino: horarioSchema,

    // Questões (para PROVA ou ATIVIDADE tipo QUESTOES)
    questoes: z.array(createQuestaoSchema).optional(),

    // Outros
    ordem: ordemSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Regra 1.1: Se recuperacaoFinal = true, então valePonto deve ser true
    if (data.recuperacaoFinal && !data.valePonto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prova de recuperação final deve valer ponto',
        path: ['valePonto'],
      });
    }

    // Validação de dataFim >= dataInicio
    if (data.dataInicio && data.dataFim && data.dataFim < data.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de término deve ser posterior ou igual à data de início',
        path: ['dataFim'],
      });
    }

    // Validação: Data início deve ser hoje ou futura
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (data.dataInicio && data.dataInicio < hoje) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de início deve ser hoje ou uma data futura',
        path: ['dataInicio'],
      });
    }

    // Validação de horário: horaTermino > horaInicio (quando dataInicio === dataFim)
    if (
      data.dataInicio &&
      data.dataFim &&
      data.horaInicio &&
      data.horaTermino &&
      data.dataInicio.toDateString() === data.dataFim.toDateString()
    ) {
      const [hI, mI] = data.horaInicio.split(':').map(Number);
      const [hT, mT] = data.horaTermino.split(':').map(Number);
      const minutosInicio = hI * 60 + mI;
      const minutosTermino = hT * 60 + mT;

      if (minutosTermino <= minutosInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Horário de término deve ser posterior ao horário de início',
          path: ['horaTermino'],
        });
      }
    }

    // Validação específica para PROVA
    if (data.tipo === CursosAvaliacaoTipo.PROVA) {
      // Provas devem ter questões
      if (!data.questoes || data.questoes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provas devem ter pelo menos 1 questão',
          path: ['questoes'],
        });
      }

      // Provas podem ter no máximo 10 questões
      if (data.questoes && data.questoes.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provas podem ter no máximo 10 questões',
          path: ['questoes'],
        });
      }

      // tipoAtividade não deve ser informado para PROVA
      if (data.tipoAtividade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tipo de atividade não deve ser informado para provas',
          path: ['tipoAtividade'],
        });
      }
    }

    // Validação específica para ATIVIDADE
    if (data.tipo === CursosAvaliacaoTipo.ATIVIDADE) {
      // tipoAtividade é obrigatório
      if (!data.tipoAtividade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tipo de atividade é obrigatório',
          path: ['tipoAtividade'],
        });
      }

      // Se tipoAtividade === QUESTOES, deve ter questões
      if (data.tipoAtividade === CursosAtividadeTipo.QUESTOES) {
        if (!data.questoes || data.questoes.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Atividades do tipo QUESTOES devem ter pelo menos 1 questão',
            path: ['questoes'],
          });
        }

        if (data.questoes && data.questoes.length > 10) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Atividades podem ter no máximo 10 questões',
            path: ['questoes'],
          });
        }
      }

      // Se tipoAtividade === PERGUNTA_RESPOSTA, não deve ter questões
      if (data.tipoAtividade === CursosAtividadeTipo.PERGUNTA_RESPOSTA) {
        if (data.questoes && data.questoes.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Atividades do tipo PERGUNTA_RESPOSTA não devem ter questões estruturadas',
            path: ['questoes'],
          });
        }

        // Descrição é obrigatória e deve ter até 500 caracteres
        if (!data.descricao || data.descricao.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Pergunta é obrigatória para atividades do tipo PERGUNTA_RESPOSTA',
            path: ['descricao'],
          });
        }

        if (data.descricao && data.descricao.length > 500) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Pergunta deve ter no máximo 500 caracteres',
            path: ['descricao'],
          });
        }
      }

      // Recuperação final não se aplica a atividades
      if (data.recuperacaoFinal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recuperação final só se aplica a provas',
          path: ['recuperacaoFinal'],
        });
      }
    }
  });

export const updateAvaliacaoSchema = z
  .object({
    tipo: z.nativeEnum(CursosAvaliacaoTipo).optional(),
    tipoAtividade: z.nativeEnum(CursosAtividadeTipo).optional().nullable(),
    recuperacaoFinal: z.boolean().optional(),
    titulo: z.string().trim().min(3).max(255).optional(),
    etiqueta: z.string().trim().min(1).max(30).optional(),
    descricao: z.string().trim().max(2000).nullable().optional(),
    peso: pesoSchema.optional(),
    valePonto: z.boolean().optional(),
    ativo: z.boolean().optional(),
    status: z.nativeEnum(CursosAulaStatus).optional(),
    modalidade: z.nativeEnum(CursosMetodos).optional(),
    obrigatoria: z.boolean().optional(),
    instrutorId: uuid.optional().nullable(),
    turmaId: uuid.optional().nullable(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    horaInicio: horarioSchema.optional(),
    horaTermino: horarioSchema.optional(),
    ordem: ordemSchema.optional(),
    questoes: z.array(createQuestaoSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // Mesmas validações do create, mas apenas para campos informados
    if (data.recuperacaoFinal !== undefined && data.valePonto !== undefined) {
      if (data.recuperacaoFinal && !data.valePonto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Prova de recuperação final deve valer ponto',
          path: ['valePonto'],
        });
      }
    }

    if (data.dataInicio && data.dataFim && data.dataFim < data.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de término deve ser posterior ou igual à data de início',
        path: ['dataFim'],
      });
    }
  });

export const clonarAvaliacaoSchema = z.object({
  templateId: uuid,
  moduloId: uuid.nullish(),
  ordem: ordemSchema.optional(),
  etiqueta: z.string().trim().min(1).max(30).optional(),
});

export type ListAvaliacoesQuery = z.infer<typeof listAvaliacoesQuerySchema>;
export type CreateAvaliacaoInput = z.infer<typeof createAvaliacaoSchema>;
export type UpdateAvaliacaoInput = z.infer<typeof updateAvaliacaoSchema>;
export type ClonarAvaliacaoInput = z.infer<typeof clonarAvaliacaoSchema>;

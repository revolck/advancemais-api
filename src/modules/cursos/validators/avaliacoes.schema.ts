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
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalized)) return false;
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

const parseCsvOrArray = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.join(',');
  return value;
};

const preprocessDateQuery = (value: unknown, mode: 'start' | 'end') => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T${mode === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`);
    }
  }
  return value;
};

const parseModalidadeQuery = (value: unknown) => {
  const raw = parseCsvOrArray(value);
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return raw;
  return raw
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .map((m) => (m === 'AO_VIVO' ? 'LIVE' : m))
    .filter(Boolean)
    .join(',');
};

export const listAvaliacoesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(10),
    // filtros por id
    cursoId: z.preprocess(parseUuidQuery, uuid.optional()),
    turmaId: z.preprocess(parseUuidQuery, uuid.optional()),
    instrutorId: z.preprocess(parseUuidQuery, uuid.optional()),
    includeSemCurso: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    // filtros por texto (telas com busca)
    curso: z.string().trim().min(1).max(255).optional(),
    turma: z.string().trim().min(1).max(255).optional(),
    instrutor: z.string().trim().min(1).max(255).optional(),
    // filtros principais
    tipo: z.nativeEnum(CursosAvaliacaoTipo).optional(),
    tipoAtividade: z.nativeEnum(CursosAtividadeTipo).optional(),
    modalidade: z.preprocess(parseModalidadeQuery, z.string().optional()), // CSV com ONLINE,PRESENCIAL,LIVE,SEMIPRESENCIAL
    // status: compatibilidade
    // - "ATIVO|INATIVO" filtra por `ativo`
    // - "RASCUNHO|PUBLICADA|..." filtra por `status` (CSV)
    status: z.preprocess(parseCsvOrArray, z.string().optional()),
    obrigatoria: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    semTurma: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    search: z.string().trim().min(1).optional(),
    titulo: z.string().trim().min(1).optional(),
    // período
    periodo: z.string().trim().min(1).optional(),
    periodoInicio: z.preprocess((v) => preprocessDateQuery(v, 'start'), z.coerce.date().optional()),
    periodoFim: z.preprocess((v) => preprocessDateQuery(v, 'end'), z.coerce.date().optional()),
    dataInicio: z.preprocess((v) => preprocessDateQuery(v, 'start'), z.coerce.date().optional()),
    dataFim: z.preprocess((v) => preprocessDateQuery(v, 'end'), z.coerce.date().optional()),
    orderBy: z.enum(['criadoEm', 'titulo', 'ordem', 'dataInicio']).optional().default('criadoEm'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .superRefine((data, ctx) => {
    if (!data.status) return;

    const allowed = new Set<string>([
      'ATIVO',
      'INATIVO',
      ...Object.values(CursosAulaStatus).map((s) => String(s).toUpperCase()),
    ]);

    const tokens = String(data.status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const invalid = tokens.filter((t) => !allowed.has(t));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Status inválido: ${invalid.join(', ')}`,
        path: ['status'],
      });
    }
  });

// Helper para validar horário no formato HH:mm
const horarioSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Horário inválido. Use o formato HH:mm (ex: 14:30)');

const parseBooleanBody = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalized)) return false;
  }
  return value;
};

const modalidadeBodySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized === 'AO_VIVO' ? 'LIVE' : normalized;
  }
  return value;
}, z.nativeEnum(CursosMetodos));

export const createAvaliacaoSchema = z
  .object({
    // Campos básicos
    cursoId: uuid.optional().nullable(),
    turmaId: uuid.optional().nullable(),
    instrutorId: uuid.optional().nullable(),
    tipo: z.nativeEnum(CursosAvaliacaoTipo),
    titulo: z.string().trim().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
    etiqueta: z.string().trim().max(30).optional(),
    descricao: z.string().trim().max(5000).optional().nullable(),

    // Campos de configuração
    recuperacaoFinal: z.preprocess(parseBooleanBody, z.boolean()).optional().default(false),
    valePonto: z.preprocess(parseBooleanBody, z.boolean()).optional().default(true),
    peso: z
      .preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(0).max(10))
      .optional(),
    obrigatoria: z.preprocess(parseBooleanBody, z.boolean()).optional().default(true),
    modalidade: modalidadeBodySchema,
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
    // Vale nota/peso
    if (data.valePonto) {
      if (data.peso === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Peso é obrigatório quando vale nota',
          path: ['peso'],
        });
      }
    }

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

        // Pergunta é obrigatória (usa o campo descricao) e deve ter até 5000 caracteres
        if (!data.descricao || data.descricao.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Pergunta é obrigatória para atividades do tipo PERGUNTA_RESPOSTA',
            path: ['descricao'],
          });
        }

        if (data.descricao && data.descricao.length > 5000) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Pergunta deve ter no máximo 5000 caracteres',
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
    cursoId: uuid.optional().nullable(),
    tipo: z.nativeEnum(CursosAvaliacaoTipo).optional(),
    tipoAtividade: z.nativeEnum(CursosAtividadeTipo).optional().nullable(),
    recuperacaoFinal: z.preprocess(parseBooleanBody, z.boolean()).optional(),
    titulo: z.string().trim().min(3).max(255).optional(),
    etiqueta: z.string().trim().min(1).max(30).optional(),
    descricao: z.string().trim().max(5000).nullable().optional(),
    peso: z.coerce.number().min(0).max(10).optional(),
    valePonto: z.preprocess(parseBooleanBody, z.boolean()).optional(),
    ativo: z.boolean().optional(),
    status: z.nativeEnum(CursosAulaStatus).optional(),
    modalidade: modalidadeBodySchema.optional(),
    obrigatoria: z.preprocess(parseBooleanBody, z.boolean()).optional(),
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

export const putUpdateAvaliacaoSchema = z
  .object({
    // Campos principais (obrigatórios)
    tipo: z.nativeEnum(CursosAvaliacaoTipo),
    titulo: z.string().trim().min(3).max(255),
    modalidade: modalidadeBodySchema,
    obrigatoria: z.preprocess(parseBooleanBody, z.boolean()),
    valePonto: z.preprocess(parseBooleanBody, z.boolean()),
    peso: z
      .preprocess((v) => (v === '' ? undefined : v), z.coerce.number().min(0).max(10))
      .optional(),
    // Status segue a mesma regra da aula (se não tiver turma, backend força RASCUNHO)
    status: z.nativeEnum(CursosAulaStatus).optional(),
    // Vinculações
    cursoId: uuid.optional().nullable(),
    turmaId: uuid.optional().nullable(),
    instrutorId: uuid.optional().nullable(),
    // Campos específicos
    tipoAtividade: z.nativeEnum(CursosAtividadeTipo).optional().nullable(),
    recuperacaoFinal: z.preprocess(parseBooleanBody, z.boolean()).optional().default(false),
    etiqueta: z.string().trim().max(30).optional(),
    descricao: z.string().trim().max(5000).optional().nullable(),
    // Período e horários (obrigatórios)
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
    // Questões
    questoes: z.array(createQuestaoSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.valePonto) {
      if (data.peso === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Peso é obrigatório quando vale nota',
          path: ['peso'],
        });
      }
    }

    if (data.dataFim < data.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de término deve ser posterior ou igual à data de início',
        path: ['dataFim'],
      });
    }

    if (data.tipo === CursosAvaliacaoTipo.PROVA) {
      if (!data.questoes || data.questoes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provas devem ter pelo menos 1 questão',
          path: ['questoes'],
        });
      }
      if (data.questoes && data.questoes.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provas podem ter no máximo 10 questões',
          path: ['questoes'],
        });
      }
      if (data.tipoAtividade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tipo de atividade não deve ser informado para provas',
          path: ['tipoAtividade'],
        });
      }
    }

    if (data.tipo === CursosAvaliacaoTipo.ATIVIDADE) {
      if (!data.tipoAtividade) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Tipo de atividade é obrigatório',
          path: ['tipoAtividade'],
        });
      }

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

      if (data.tipoAtividade === CursosAtividadeTipo.PERGUNTA_RESPOSTA) {
        if (data.questoes && data.questoes.length > 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Atividades do tipo PERGUNTA_RESPOSTA não devem ter questões estruturadas',
            path: ['questoes'],
          });
        }
        if (!data.descricao || data.descricao.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Pergunta é obrigatória para atividades do tipo PERGUNTA_RESPOSTA',
            path: ['descricao'],
          });
        }
      }

      if (data.recuperacaoFinal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Recuperação final só se aplica a provas',
          path: ['recuperacaoFinal'],
        });
      }
    }
  });

export const clonarAvaliacaoSchema = z.object({
  templateId: uuid,
  moduloId: uuid.nullish(),
  ordem: ordemSchema.optional(),
  etiqueta: z.string().trim().min(1).max(30).optional(),
});

export const publicarAvaliacaoSchema = z.object({
  publicar: z.preprocess(parseBooleanBody, z.boolean()),
});

export type ListAvaliacoesQuery = z.infer<typeof listAvaliacoesQuerySchema>;
export type CreateAvaliacaoInput = z.infer<typeof createAvaliacaoSchema>;
export type UpdateAvaliacaoInput = z.infer<typeof updateAvaliacaoSchema>;
export type PutUpdateAvaliacaoInput = z.infer<typeof putUpdateAvaliacaoSchema>;
export type ClonarAvaliacaoInput = z.infer<typeof clonarAvaliacaoSchema>;
export type PublicarAvaliacaoInput = z.infer<typeof publicarAvaliacaoSchema>;

import {
  CursosEstagioDiaSemana,
  CursosEstagioEmpresaVinculoModo,
  CursosEstagioFrequenciaStatus,
  CursosEstagioGrupoTurno,
  CursosEstagioModoAlocacao,
  CursosEstagioParticipanteStatus,
  CursosEstagioPeriodicidade,
  CursosEstagioProgramaStatus,
  CursosEstagioStatus,
  CursosEstagioTipoParticipacao,
} from '@prisma/client';
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

const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/u, 'Estado deve estar no formato UF (ex: AL, SP)')
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
const frequenciaStatusFiltroSchema = z.enum([
  CursosEstagioFrequenciaStatus.PRESENTE,
  CursosEstagioFrequenciaStatus.AUSENTE,
  'PENDENTE',
]);

const dateOnlySafeSchema = z.preprocess(
  (value) => {
    if (value == null || value === '') return value;
    if (value instanceof Date) return value;

    if (typeof value === 'string') {
      const raw = value.trim();
      const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
      if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]);
        const day = Number(dateOnlyMatch[3]);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      }

      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return value;
  },
  z.date({ invalid_type_error: 'Informe uma data válida' }),
);

const estagioLocalSchema = z
  .object({
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
  })
  .superRefine((value, ctx) => {
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
    status: z.union([z.nativeEnum(CursosEstagioStatus), z.nativeEnum(CursosEstagioProgramaStatus)]),
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

export const listEstagiosQuerySchema = z.object({
  cursoId: z.string().uuid('cursoId deve ser um UUID válido'),
  turmaId: z.string().uuid('turmaId deve ser um UUID válido').optional(),
  status: z.nativeEnum(CursosEstagioStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

export type EstagioCreateInput = z.infer<typeof createEstagioSchema>;
export type EstagioUpdateInput = z.infer<typeof updateEstagioSchema>;
export type EstagioStatusInput = z.infer<typeof updateEstagioStatusSchema>;
export type EstagioConfirmacaoInput = z.infer<typeof confirmarEstagioSchema>;
export type EstagioLocalInput = z.infer<typeof estagioLocalSchema>;
export type ListEstagiosQuery = z.infer<typeof listEstagiosQuerySchema>;

const diaSemanaCodigoSchema = z.enum(['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']);

const periodoProgramaSchema = z
  .object({
    periodicidade: z.nativeEnum(CursosEstagioPeriodicidade),
    diasSemana: z.array(diaSemanaCodigoSchema).optional(),
    dataInicio: dateOnlySafeSchema,
    dataFim: dateOnlySafeSchema,
    incluirSabados: z.coerce.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.dataFim < value.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data final não pode ser anterior à data inicial',
        path: ['dataFim'],
      });
    }

    if (value.periodicidade === CursosEstagioPeriodicidade.DIAS_SEMANA) {
      if (!value.diasSemana || value.diasSemana.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe ao menos um dia da semana',
          path: ['diasSemana'],
        });
      }
    }
  });

const grupoProgramaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  turno: z
    .enum([
      CursosEstagioGrupoTurno.MANHA,
      CursosEstagioGrupoTurno.TARDE,
      CursosEstagioGrupoTurno.NOITE,
    ])
    .default(CursosEstagioGrupoTurno.MANHA),
  capacidade: z.coerce.number().int().positive().optional(),
  horaInicio: z
    .string()
    .trim()
    .regex(isoTimeRegex, 'Hora de início deve estar no formato HH:mm')
    .optional(),
  horaFim: z
    .string()
    .trim()
    .regex(isoTimeRegex, 'Hora de fim deve estar no formato HH:mm')
    .optional(),
  empresaId: z.string().uuid().optional(),
  empresaNome: nullableString(255),
  supervisorNome: nullableString(120),
  contatoSupervisor: nullableString(120),
});

const horarioPadraoSchema = z.object({
  horaInicio: z.string().trim().regex(isoTimeRegex, 'Hora de início deve estar no formato HH:mm'),
  horaFim: z.string().trim().regex(isoTimeRegex, 'Hora de fim deve estar no formato HH:mm'),
});

const empresaEstagioSchema = z
  .object({
    vinculoModo: z.nativeEnum(CursosEstagioEmpresaVinculoModo).optional(),
    empresaId: z.string().uuid().optional(),
    nome: nullableString(255),
    cnpj: nullableString(20),
    telefone: nullableString(20),
    email: nullableEmail,
    endereco: z
      .object({
        rua: nullableString(255),
        cep: cepSchema,
        cidade: nullableString(120),
        estado: ufSchema,
        numero: nullableString(20),
        complemento: nullableString(120),
      })
      .optional(),
  })
  .optional();

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((v) => Number(v));
  return h * 60 + m;
};

export const listEstagiosProgramasQuerySchema = z.object({
  cursoId: z.string().uuid('cursoId deve ser UUID').optional(),
  turmaIds: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined,
    ),
  status: z.nativeEnum(CursosEstagioProgramaStatus).optional(),
  search: z.string().trim().optional(),
  orderBy: z.enum(['atualizadoEm', 'titulo', 'status']).default('atualizadoEm'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(10),
});

export const createEstagioProgramaSchema = z
  .object({
    titulo: z.string().trim().min(3).max(255),
    descricao: z.string().trim().min(1, 'Descrição é obrigatória').max(2000),
    cursoId: z.string().uuid('cursoId deve ser UUID'),
    turmaId: z.string().uuid('turmaId deve ser UUID'),
    obrigatorio: z.coerce.boolean().optional().default(false),
    modoAlocacao: z.nativeEnum(CursosEstagioModoAlocacao).default(CursosEstagioModoAlocacao.TODOS),
    usarGrupos: z.coerce.boolean().optional().default(false),
    periodo: periodoProgramaSchema,
    horarioPadrao: horarioPadraoSchema.optional(),
    status: z.nativeEnum(CursosEstagioProgramaStatus).optional(),
    grupos: z
      .array(grupoProgramaSchema)
      .max(5, 'Máximo de 5 grupos por estágio')
      .optional()
      .default([]),
    empresa: empresaEstagioSchema,
  })
  .superRefine((value, ctx) => {
    if (value.empresa?.vinculoModo === CursosEstagioEmpresaVinculoModo.CADASTRADA) {
      if (!value.empresa?.empresaId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'empresaId é obrigatório quando vinculoModo=CADASTRADA',
          path: ['empresa', 'empresaId'],
        });
      }
    }

    if (value.empresa?.vinculoModo === CursosEstagioEmpresaVinculoModo.MANUAL) {
      if (!value.empresa?.nome) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nome da empresa é obrigatório quando vinculoModo=MANUAL',
          path: ['empresa', 'nome'],
        });
      }
    }

    if (value.empresa?.vinculoModo) {
      const endereco = value.empresa.endereco;
      if (!endereco) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Endereço da empresa é obrigatório',
          path: ['empresa', 'endereco'],
        });
      } else {
        const requiredAddressFields: (keyof typeof endereco)[] = [
          'rua',
          'cep',
          'cidade',
          'estado',
          'numero',
          'complemento',
        ];

        for (const field of requiredAddressFields) {
          if (!endereco[field]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Campo obrigatório no endereço: ${field}`,
              path: ['empresa', 'endereco', field],
            });
          }
        }
      }
    }

    if (value.usarGrupos) {
      if (!value.grupos || value.grupos.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe ao menos um grupo quando usarGrupos=true',
          path: ['grupos'],
        });
      }

      const capacidadeTotal = (value.grupos ?? []).reduce(
        (acc, grupo) => acc + (grupo.capacidade ?? 0),
        0,
      );
      if (capacidadeTotal <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe capacidade dos grupos quando usarGrupos=true',
          path: ['grupos'],
        });
      }

      for (const [index, grupo] of (value.grupos ?? []).entries()) {
        if (!grupo.capacidade || grupo.capacidade <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Capacidade do grupo é obrigatória e deve ser maior que zero',
            path: ['grupos', index, 'capacidade'],
          });
        }

        if (!grupo.horaInicio || !grupo.horaFim) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Grupo precisa de horaInicio e horaFim',
            path: ['grupos', index],
          });
          continue;
        }

        if (hhmmToMinutes(grupo.horaFim) <= hhmmToMinutes(grupo.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'horaFim deve ser maior que horaInicio no grupo',
            path: ['grupos', index, 'horaFim'],
          });
        }
      }
    } else {
      if (!value.horarioPadrao?.horaInicio || !value.horarioPadrao?.horaFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'horarioPadrao é obrigatório quando usarGrupos=false',
          path: ['horarioPadrao'],
        });
      } else if (
        hhmmToMinutes(value.horarioPadrao.horaFim) <= hhmmToMinutes(value.horarioPadrao.horaInicio)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'horaFim deve ser maior que horaInicio',
          path: ['horarioPadrao', 'horaFim'],
        });
      }
    }
  });

export const updateEstagioProgramaSchema = z
  .object({
    titulo: z.string().trim().min(3).max(255).optional(),
    descricao: nullableString(2000).optional(),
    cursoId: z.string().uuid('cursoId deve ser UUID').optional(),
    turmaId: z.string().uuid('turmaId deve ser UUID').optional(),
    obrigatorio: z.coerce.boolean().optional(),
    modoAlocacao: z.nativeEnum(CursosEstagioModoAlocacao).optional(),
    usarGrupos: z.coerce.boolean().optional(),
    periodo: z
      .object({
        periodicidade: z.nativeEnum(CursosEstagioPeriodicidade).optional(),
        diasSemana: z.array(diaSemanaCodigoSchema).optional(),
        dataInicio: dateOnlySafeSchema.optional(),
        dataFim: dateOnlySafeSchema.optional(),
        incluirSabados: z.coerce.boolean().optional(),
      })
      .optional(),
    horarioPadrao: horarioPadraoSchema.optional(),
    status: z.nativeEnum(CursosEstagioProgramaStatus).optional(),
    grupos: z.array(grupoProgramaSchema).max(5, 'Máximo de 5 grupos por estágio').optional(),
    empresa: empresaEstagioSchema,
  })
  .superRefine((value, ctx) => {
    if (value.horarioPadrao?.horaInicio && value.horarioPadrao?.horaFim) {
      if (
        hhmmToMinutes(value.horarioPadrao.horaFim) <= hhmmToMinutes(value.horarioPadrao.horaInicio)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'horaFim deve ser maior que horaInicio',
          path: ['horarioPadrao', 'horaFim'],
        });
      }
    }

    for (const [index, grupo] of (value.grupos ?? []).entries()) {
      if ((grupo.horaInicio && !grupo.horaFim) || (!grupo.horaInicio && grupo.horaFim)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Grupo precisa de horaInicio e horaFim',
          path: ['grupos', index],
        });
      } else if (grupo.horaInicio && grupo.horaFim) {
        if (hhmmToMinutes(grupo.horaFim) <= hhmmToMinutes(grupo.horaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'horaFim deve ser maior que horaInicio no grupo',
            path: ['grupos', index, 'horaFim'],
          });
        }
      }
    }
  });

export const vincularAlunosEstagioSchema = z
  .object({
    modo: z.nativeEnum(CursosEstagioModoAlocacao),
    inscricaoIds: z.array(z.string().uuid()).optional().default([]),
    grupoIdDefault: z.string().uuid().nullable().optional(),
    tipoParticipacao: z
      .nativeEnum(CursosEstagioTipoParticipacao)
      .optional()
      .default(CursosEstagioTipoParticipacao.INICIAL),
  })
  .superRefine((value, ctx) => {
    if (value.modo === CursosEstagioModoAlocacao.ESPECIFICOS && value.inscricaoIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe ao menos uma inscrição para o modo ESPECIFICOS',
        path: ['inscricaoIds'],
      });
    }
  });

export const alocarAlunoGrupoEstagioSchema = z.object({
  grupoId: z.string().uuid().nullable(),
});

export const listFrequenciasEstagioQuerySchema = z.object({
  data: dateOnlySafeSchema.optional(),
  status: frequenciaStatusFiltroSchema.optional(),
  grupoId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(10),
});

export const listFrequenciasEstagioPeriodoQuerySchema = z
  .object({
    dataInicio: dateOnlySafeSchema.optional(),
    dataFim: dateOnlySafeSchema.optional(),
    status: frequenciaStatusFiltroSchema.optional(),
    grupoId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(10),
  })
  .superRefine((value, ctx) => {
    if (value.dataInicio && value.dataFim && value.dataFim < value.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dataFim não pode ser anterior a dataInicio',
        path: ['dataFim'],
      });
    }
  });

export const upsertFrequenciaEstagioSchema = z
  .object({
    estagioAlunoId: z.string().uuid(),
    dataReferencia: dateOnlySafeSchema,
    status: z.nativeEnum(CursosEstagioFrequenciaStatus),
    motivo: nullableString(500),
  })
  .superRefine((value, ctx) => {
    if (value.status === CursosEstagioFrequenciaStatus.AUSENTE) {
      if (!value.motivo || value.motivo.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Motivo é obrigatório para ausência',
          path: ['motivo'],
        });
      }
    }
  });

export const listFrequenciaHistoricoEstagioQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(20).default(5),
});

export const listEstagiosAlunoQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['ATIVO', 'CONCLUIDO', 'CANCELADO']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

export const listFrequenciasEstagioAlunoQuerySchema = z.object({
  data: dateOnlySafeSchema.optional(),
  status: frequenciaStatusFiltroSchema.optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

export const listFrequenciasEstagioAlunoPeriodoQuerySchema = z
  .object({
    dataInicio: dateOnlySafeSchema.optional(),
    dataFim: dateOnlySafeSchema.optional(),
    status: frequenciaStatusFiltroSchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(10),
  })
  .superRefine((value, ctx) => {
    if (value.dataInicio && value.dataFim && value.dataFim < value.dataInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'dataFim não pode ser anterior a dataInicio',
        path: ['dataFim'],
      });
    }
  });

export const concluirEstagioAlunoSchema = z.object({
  observacoes: nullableString(500).optional(),
});

export type ListEstagiosProgramasQuery = z.infer<typeof listEstagiosProgramasQuerySchema>;
export type CreateEstagioProgramaInput = z.infer<typeof createEstagioProgramaSchema>;
export type UpdateEstagioProgramaInput = z.infer<typeof updateEstagioProgramaSchema>;
export type VincularAlunosEstagioInput = z.infer<typeof vincularAlunosEstagioSchema>;
export type AlocarAlunoGrupoEstagioInput = z.infer<typeof alocarAlunoGrupoEstagioSchema>;
export type ListFrequenciasEstagioQuery = z.infer<typeof listFrequenciasEstagioQuerySchema>;
export type ListFrequenciasEstagioPeriodoQuery = z.infer<
  typeof listFrequenciasEstagioPeriodoQuerySchema
>;
export type UpsertFrequenciaEstagioInput = z.infer<typeof upsertFrequenciaEstagioSchema>;
export type ListFrequenciaHistoricoEstagioQuery = z.infer<
  typeof listFrequenciaHistoricoEstagioQuerySchema
>;
export type ListEstagiosAlunoQuery = z.infer<typeof listEstagiosAlunoQuerySchema>;
export type ListFrequenciasEstagioAlunoQuery = z.infer<
  typeof listFrequenciasEstagioAlunoQuerySchema
>;
export type ListFrequenciasEstagioAlunoPeriodoQuery = z.infer<
  typeof listFrequenciasEstagioAlunoPeriodoQuerySchema
>;
export type ConcluirEstagioAlunoInput = z.infer<typeof concluirEstagioAlunoSchema>;
export type EstagioParticipanteStatusType = CursosEstagioParticipanteStatus;

import { CursoStatus, CursosMetodos, CursosTurnos, StatusInscricao } from '@prisma/client';
import { z } from 'zod';

const uuid = z.string().uuid('Identificador inválido');

const parseBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalized)) return false;
  }
  return value;
};

const booleanOptional = z.preprocess(parseBoolean, z.boolean().optional());

const positiveInt = z.coerce
  .number({ invalid_type_error: 'Informe um número válido' })
  .int('Valor deve ser um número inteiro')
  .positive('Valor deve ser maior que zero');

const optionalDate = z
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
    z.date({ invalid_type_error: 'Informe uma data válida' }),
  )
  .optional();

const requiredDate = z.preprocess(
  (value) => {
    if (value instanceof Date) return value;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  },
  z.date({ invalid_type_error: 'Informe uma data válida' }),
);

const turmaBaseSchema = z.object({
  nome: z.string().trim().min(3).max(255),
  instrutorId: uuid.optional(),
  instrutorIds: z.array(uuid).max(50).optional(),
  estruturaTipo: z.enum(['MODULAR', 'DINAMICA', 'PADRAO']).optional(),
  turno: z.nativeEnum(CursosTurnos).optional(),
  metodo: z.nativeEnum(CursosMetodos).optional(),
  dataInicio: optionalDate,
  dataFim: optionalDate,
  dataInscricaoInicio: optionalDate,
  dataInscricaoFim: optionalDate,
  vagasIlimitadas: z.preprocess(parseBoolean, z.boolean()).optional(),
  vagasTotais: positiveInt.optional(),
  vagasDisponiveis: positiveInt.optional(),
  // Entrada do usuário: apenas RASCUNHO/PUBLICADO.
  // Demais status são definidos automaticamente com base nos períodos (inscrições e turma).
  status: z.enum(['RASCUNHO', 'PUBLICADO']).optional(),
});

const turmaEstruturaItemSchema = z.object({
  type: z.enum(['AULA', 'PROVA', 'ATIVIDADE']),
  title: z.string().trim().min(1).max(255),
  templateId: uuid,
  strategy: z.enum(['CLONE', 'REFERENCE']).optional().default('CLONE'),
  startDate: optionalDate.optional(),
  endDate: optionalDate.optional(),
  instructorId: uuid.optional(),
  instructorIds: z.array(uuid).optional(),
  obrigatoria: booleanOptional,
  // Apenas para PROVA (opcional no front para diferenciar prova normal x recuperação final)
  recuperacaoFinal: booleanOptional,
  ordem: z.coerce.number().int().min(0).optional(),
});

const turmaEstruturaModuleSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(1).max(255),
  ordem: z.coerce.number().int().min(0).optional(),
  startDate: optionalDate.optional(),
  endDate: optionalDate.optional(),
  instructorId: uuid.optional(),
  instructorIds: z.array(uuid).optional(),
  items: z.array(turmaEstruturaItemSchema).default([]),
});

const turmaEstruturaSchema = z.object({
  modules: z.array(turmaEstruturaModuleSchema).default([]),
  standaloneItems: z.array(turmaEstruturaItemSchema).default([]),
});

const applyDateValidations = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  schema.superRefine((value, ctx) => {
    const dataInicio = (value as z.infer<typeof turmaBaseSchema>).dataInicio;
    const dataFim = (value as z.infer<typeof turmaBaseSchema>).dataFim;
    const dataInscricaoInicio = (value as z.infer<typeof turmaBaseSchema>).dataInscricaoInicio;
    const dataInscricaoFim = (value as z.infer<typeof turmaBaseSchema>).dataInscricaoFim;

    if (dataInicio && dataFim && dataInicio > dataFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFim'],
        message: 'Data de fim deve ser posterior à data de início',
      });
    }

    if (dataInscricaoInicio && dataInscricaoFim && dataInscricaoInicio > dataInscricaoFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataInscricaoFim'],
        message: 'Data final de inscrição deve ser posterior à data inicial',
      });
    }

    // Regra: o período da turma (início) não pode ser menor que o final das inscrições
    // Ou seja: dataInicio deve ser >= dataInscricaoFim (quando ambas existirem)
    if (dataInicio && dataInscricaoFim && dataInicio < dataInscricaoFim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataInicio'],
        message: 'Data de início da turma não pode ser anterior à data final das inscrições',
      });
    }
  });

export const createTurmaSchema = applyDateValidations(
  turmaBaseSchema.extend({
    // Campos obrigatórios conforme tela do frontend
    estruturaTipo: z.enum(['MODULAR', 'DINAMICA', 'PADRAO']),
    turno: z.nativeEnum(CursosTurnos),
    metodo: z.nativeEnum(CursosMetodos),
    dataInicio: requiredDate,
    dataFim: requiredDate,
    dataInscricaoInicio: requiredDate,
    dataInscricaoFim: requiredDate,
    vagasIlimitadas: z.preprocess(parseBoolean, z.boolean()),
    estrutura: turmaEstruturaSchema,
  }),
).superRefine((value, ctx) => {
  // Vagas (ilimitadas vs limitadas)
  const vagasIlimitadas = (value as any).vagasIlimitadas as boolean;
  const vagasTotais = (value as any).vagasTotais as number | undefined;

  if (!vagasIlimitadas && (vagasTotais === undefined || Number.isNaN(vagasTotais))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vagasTotais'],
      message: 'Informe o total de vagas (ou marque como ilimitadas)',
    });
  }

  // Se usuário enviou instrutorIds, manter compatibilidade com instrutorId
  const instrutorId = (value as any).instrutorId as string | undefined;
  const instrutorIds = (value as any).instrutorIds as string[] | undefined;
  if (instrutorIds?.length && instrutorId && !instrutorIds.includes(instrutorId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['instrutorId'],
      message: 'instrutorId deve estar contido em instrutorIds quando ambos forem enviados',
    });
  }

  const estrutura = (value as any).estrutura as z.infer<typeof turmaEstruturaSchema> | undefined;
  const estruturaTipo = (value as any).estruturaTipo as 'MODULAR' | 'DINAMICA' | 'PADRAO';
  const modules = estrutura?.modules ?? [];
  const standaloneItems = estrutura?.standaloneItems ?? [];
  const allItems = [...modules.flatMap((m) => m.items ?? []), ...standaloneItems];

  // Validação por item (ex: recuperacaoFinal apenas em PROVA)
  for (const item of allItems) {
    if (item.type !== 'PROVA' && item.recuperacaoFinal !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura'],
        message: 'recuperacaoFinal só pode ser usado em itens do tipo PROVA',
      });
    }
  }

  if (estruturaTipo === 'MODULAR') {
    if (modules.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura', 'modules'],
        message: 'Estrutura MODULAR exige ao menos 1 módulo',
      });
    }
    if (standaloneItems.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura', 'standaloneItems'],
        message: 'Estrutura MODULAR não aceita itens avulsos (standaloneItems)',
      });
    }
  }

  if (estruturaTipo === 'PADRAO') {
    if (modules.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura', 'modules'],
        message: 'Estrutura PADRAO não utiliza módulos (modules deve ser vazio)',
      });
    }
    if (standaloneItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura', 'standaloneItems'],
        message: 'Estrutura PADRAO exige ao menos 1 item avulso',
      });
    }
  }

  const aulasCount = allItems.filter((item) => item.type === 'AULA').length;
  const avaliacoesCount = allItems.filter(
    (item) => item.type === 'PROVA' || item.type === 'ATIVIDADE',
  ).length;

  if (aulasCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura'],
      message: 'A estrutura da turma deve conter ao menos 1 item do tipo AULA',
    });
  }

  if (avaliacoesCount < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura'],
      message: 'A estrutura da turma deve conter ao menos 1 item do tipo PROVA ou ATIVIDADE',
    });
  }

  // Regra: ordem única por módulo e por lista de itens
  const moduleOrders = modules.map((module, index) => module.ordem ?? index + 1);
  const moduleOrderSet = new Set<number>();
  const duplicatedModuleOrders: number[] = [];
  moduleOrders.forEach((ordem) => {
    if (moduleOrderSet.has(ordem)) duplicatedModuleOrders.push(ordem);
    moduleOrderSet.add(ordem);
  });
  if (duplicatedModuleOrders.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura', 'modules'],
      message: 'Existem módulos com ordem duplicada. Ajuste a ordenação dos módulos.',
    });
  }

  modules.forEach((module, moduleIndex) => {
    const orders = (module.items ?? []).map((item, index) => item.ordem ?? index + 1);
    const orderSet = new Set<number>();
    const duplicatedOrders: number[] = [];
    orders.forEach((ordem) => {
      if (orderSet.has(ordem)) duplicatedOrders.push(ordem);
      orderSet.add(ordem);
    });
    if (duplicatedOrders.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estrutura', 'modules', moduleIndex, 'items'],
        message: 'Existem itens com ordem duplicada neste módulo. Ajuste a ordenação dos itens.',
      });
    }
  });

  const standaloneOrders = standaloneItems.map((item, index) => item.ordem ?? index + 1);
  const standaloneOrderSet = new Set<number>();
  const duplicatedStandaloneOrders: number[] = [];
  standaloneOrders.forEach((ordem) => {
    if (standaloneOrderSet.has(ordem)) duplicatedStandaloneOrders.push(ordem);
    standaloneOrderSet.add(ordem);
  });
  if (duplicatedStandaloneOrders.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estrutura', 'standaloneItems'],
      message: 'Existem itens avulsos com ordem duplicada. Ajuste a ordenação.',
    });
  }

  // Regra: datas de módulos/itens devem estar dentro do período da turma
  const turmaInicio = (value as any).dataInicio as Date | undefined;
  const turmaFim = (value as any).dataFim as Date | undefined;
  if (turmaInicio && turmaFim) {
    const isBefore = (a?: Date, b?: Date) =>
      a !== undefined && b !== undefined ? a.getTime() < b.getTime() : false;
    const isAfter = (a?: Date, b?: Date) =>
      a !== undefined && b !== undefined ? a.getTime() > b.getTime() : false;

    modules.forEach((module, moduleIndex) => {
      const moduleStart = module.startDate;
      const moduleEnd = module.endDate;

      if (moduleStart && isBefore(moduleStart, turmaInicio)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'modules', moduleIndex, 'startDate'],
          message: 'Data de início do módulo deve estar dentro do período da turma',
        });
      }

      if (moduleEnd && isAfter(moduleEnd, turmaFim)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'modules', moduleIndex, 'endDate'],
          message: 'Data de fim do módulo deve estar dentro do período da turma',
        });
      }

      if (moduleStart && moduleEnd && isAfter(moduleStart, moduleEnd)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'modules', moduleIndex, 'endDate'],
          message: 'Data de fim do módulo deve ser posterior à data de início',
        });
      }

      (module.items ?? []).forEach((item, itemIndex) => {
        const effectiveStart = item.startDate ?? moduleStart;
        const effectiveEnd = item.endDate ?? moduleEnd;

        if (effectiveStart && isBefore(effectiveStart, turmaInicio)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['estrutura', 'modules', moduleIndex, 'items', itemIndex, 'startDate'],
            message: 'Data de início da aula/atividade/prova deve estar dentro do período da turma',
          });
        }

        if (effectiveEnd && isAfter(effectiveEnd, turmaFim)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['estrutura', 'modules', moduleIndex, 'items', itemIndex, 'endDate'],
            message: 'Data de fim da aula/atividade/prova deve estar dentro do período da turma',
          });
        }

        if (effectiveStart && effectiveEnd && isAfter(effectiveStart, effectiveEnd)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['estrutura', 'modules', moduleIndex, 'items', itemIndex, 'endDate'],
            message: 'Data de fim da aula/atividade/prova deve ser posterior à data de início',
          });
        }
      });
    });

    standaloneItems.forEach((item, itemIndex) => {
      const effectiveStart = item.startDate;
      const effectiveEnd = item.endDate;

      if (effectiveStart && isBefore(effectiveStart, turmaInicio)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'standaloneItems', itemIndex, 'startDate'],
          message: 'Data de início da aula/atividade/prova deve estar dentro do período da turma',
        });
      }

      if (effectiveEnd && isAfter(effectiveEnd, turmaFim)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'standaloneItems', itemIndex, 'endDate'],
          message: 'Data de fim da aula/atividade/prova deve estar dentro do período da turma',
        });
      }

      if (effectiveStart && effectiveEnd && isAfter(effectiveStart, effectiveEnd)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estrutura', 'standaloneItems', itemIndex, 'endDate'],
          message: 'Data de fim da aula/atividade/prova deve ser posterior à data de início',
        });
      }
    });
  }
});

/**
 * Schema para atualização de turma
 * IMPORTANTE: Após a criação da turma, modalidade (metodo) e estruturaTipo NÃO podem ser alterados
 */
export const updateTurmaSchema = applyDateValidations(
  turmaBaseSchema
    .omit({
      // Campos que NÃO podem ser editados após criação
      estruturaTipo: true, // Estrutura do curso não pode mudar após criação
    })
    .partial(),
);

export const turmaInscricaoSchema = z.object({
  alunoId: z.string().uuid(),
  prazoAdaptacaoDias: z.number().int().min(1).max(90).optional(),
});

export const updateInscricaoStatusSchema = z.object({
  status: z.nativeEnum(StatusInscricao, {
    errorMap: () => ({ message: 'Status inválido' }),
  }),
});

export const listTurmasQuerySchema = z.object({
  page: positiveInt.min(1).default(1),
  pageSize: positiveInt.min(1).max(200).default(10),
  status: z.nativeEnum(CursoStatus).optional(),
  turno: z.nativeEnum(CursosTurnos).optional(),
  metodo: z.nativeEnum(CursosMetodos).optional(),
  instrutorId: z.string().uuid().optional(),
});

/**
 * Schema para publicar/despublicar turma
 * Controla a visibilidade da turma no site
 */
export const publicarTurmaSchema = z.object({
  publicar: z.boolean({
    required_error: 'Campo "publicar" é obrigatório',
    invalid_type_error: 'Campo "publicar" deve ser true ou false',
  }),
});

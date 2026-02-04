import { z } from 'zod';

// Enums
const modalidadeEnum = z.enum(['ONLINE', 'PRESENCIAL', 'AO_VIVO', 'SEMIPRESENCIAL']);
const tipoLinkEnum = z.enum(['YOUTUBE', 'MEET']);
const statusEnum = z.enum(['RASCUNHO', 'PUBLICADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']);

const materiaisInputItemSchema = z.union([
  z.string().url('URL do material inválida'),
  z.object({
    url: z.string().url('URL do material inválida'),
    titulo: z.string().min(1).max(255).optional(),
  }),
]);

const materiaisInputSchema = z.array(materiaisInputItemSchema).max(3, 'Máximo de 3 materiais');

const coerceBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no'].includes(normalized)) return false;
  }
  return value;
};

const requiredBooleanSchema = z.preprocess(
  (value) => coerceBoolean(value),
  z.boolean({ required_error: 'Campo obrigatório' }),
);

const optionalBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return coerceBoolean(value);
}, z.boolean().optional());

/**
 * Schema para criar aula
 */
export const createAulaSchema = z
  .object({
    cursoId: z.string().uuid('cursoId deve ser um UUID válido').optional(),
    titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
    descricao: z.string().min(1, 'Descrição é obrigatória').max(5000, 'Máximo de 5000 caracteres'),
    modalidade: modalidadeEnum,
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url('URL do YouTube inválida').optional(),
    obrigatoria: requiredBooleanSchema,
    duracaoMinutos: z.coerce
      .number({ required_error: 'Campo "duracaoMinutos" é obrigatório' })
      .int()
      .positive('Duração deve ser maior que 0'),
    // ✅ IMPORTANTE: Aulas devem ser criadas sempre como RASCUNHO
    // Publicação deve ser feita via endpoint específico PATCH /api/v1/cursos/aulas/{id}/publicar
    status: z.enum(['RASCUNHO']).optional().default('RASCUNHO'), // ✅ Apenas RASCUNHO permitido na criação
    gravarAula: z.boolean().optional().default(true),
    // Vinculação (TODOS OPCIONAIS)
    turmaId: z.string().uuid('turmaId deve ser um UUID válido').optional(),
    instrutorId: z.string().uuid('instrutorId deve ser um UUID válido').optional(),
    moduloId: z.string().uuid().optional(),
    sala: z.string().max(100).optional(),
    // Materiais complementares (front envia URLs do blob)
    materiais: materiaisInputSchema.optional(),
    // Data e Hora (SEPARADOS - Arquitetura Ideal)
    // Aceita múltiplos formatos e converte para YYYY-MM-DD
    dataInicio: z
      .preprocess(
        (value) => {
          if (!value || value === '') return undefined;
          // Converte para string primeiro
          let strValue: string;
          if (value instanceof Date) {
            strValue = value.toISOString();
          } else {
            strValue = String(value);
          }
          // Se já está no formato YYYY-MM-DD, retorna como está
          if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) return strValue;
          // Se é ISO string, extrai apenas a data (YYYY-MM-DD)
          const dateMatch = strValue.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) return dateMatch[1];
          // Tenta parsear como Date e converter
          const date = new Date(strValue);
          if (!Number.isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          // Se não conseguiu converter, retorna o valor original para o Zod mostrar erro
          return strValue;
        },
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD')
          .optional(),
      )
      .optional(),
    dataFim: z
      .preprocess(
        (value) => {
          if (!value || value === '') return undefined;
          // Converte para string primeiro
          let strValue: string;
          if (value instanceof Date) {
            strValue = value.toISOString();
          } else {
            strValue = String(value);
          }
          // Se já está no formato YYYY-MM-DD, retorna como está
          if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) return strValue;
          // Se é ISO string, extrai apenas a data (YYYY-MM-DD)
          const dateMatch = strValue.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) return dateMatch[1];
          // Tenta parsear como Date e converter
          const date = new Date(strValue);
          if (!Number.isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          // Se não conseguiu converter, retorna o valor original para o Zod mostrar erro
          return strValue;
        },
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD')
          .optional(),
      )
      .optional(),
    horaInicio: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM')
      .optional(),
    horaFim: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato: HH:MM')
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Regra de vínculo:
    // - Usuário pode salvar como rascunho sem curso e sem turma
    // - Se enviar cursoId, deve obrigatoriamente enviar turmaId
    if (data.cursoId && !data.turmaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turmaId'],
        message: 'Quando cursoId for informado, turmaId é obrigatório',
      });
    }

    // Validar dataFim > dataInicio (apenas se dataFim foi informado)
    if (data.dataInicio && data.dataFim) {
      if (data.dataFim < data.dataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'Data de término deve ser posterior ou igual à data de início',
        });
      }

      // Validar MESMO DIA apenas para AO_VIVO (aulas ao vivo devem ser no mesmo dia)
      // PRESENCIAL pode ter período de X a Y (dias diferentes)
      if (
        data.modalidade === 'AO_VIVO' ||
        (data.modalidade === 'SEMIPRESENCIAL' && data.tipoLink === 'MEET')
      ) {
        const diaInicio = data.dataInicio; // Já está no formato YYYY-MM-DD
        const diaFim = data.dataFim; // Já está no formato YYYY-MM-DD

        if (diaInicio !== diaFim) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataFim'],
            message: `Aulas ${data.modalidade === 'AO_VIVO' ? 'ao vivo' : 'semipresenciais com Meet'} devem acontecer no mesmo dia. Início: ${diaInicio}, Fim: ${diaFim}`,
          });
        }
      }
      // Para PRESENCIAL: permite período de X a Y (dias diferentes)
      // Se dataFim não for informado, aula acontece apenas no dataInicio
    }
  });

/**
 * Schema para atualizar aula
 */
export const updateAulaSchema = z
  .object({
    cursoId: z.string().uuid('cursoId deve ser um UUID válido').nullable().optional(),
    titulo: z.string().min(3).max(255).optional(),
    descricao: z.string().max(5000).optional(),
    modalidade: modalidadeEnum.optional(),
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url().optional(),
    obrigatoria: optionalBooleanSchema,
    duracaoMinutos: z.coerce.number().int().positive().optional(),
    status: statusEnum.optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    horaInicio: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    horaFim: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    // ✅ Vinculação (TODOS OPCIONAIS - podem ser enviados para atualizar ou null para remover)
    turmaId: z.string().uuid('turmaId deve ser um UUID válido').nullable().optional(),
    instrutorId: z.string().uuid('instrutorId deve ser um UUID válido').nullable().optional(),
    moduloId: z.string().uuid('moduloId deve ser um UUID válido').nullable().optional(),
    // Materiais complementares (URLs do blob) - quando enviado, substitui a lista atual
    materiais: materiaisInputSchema.optional(),
  })
  .partial();

/**
 * Schema para PUT /api/v1/cursos/aulas/:id
 * Tela do frontend envia um payload completo (campos principais obrigatórios).
 */
export const putUpdateAulaSchema = z
  .object({
    status: statusEnum.optional(),
    titulo: z.string().min(3).max(255),
    descricao: z.string().min(1, 'Descrição é obrigatória').max(5000, 'Máximo de 5000 caracteres'),
    modalidade: modalidadeEnum,
    duracaoMinutos: z.coerce.number().int().positive('Duração deve ser maior que 0'),
    obrigatoria: requiredBooleanSchema,
    // Vinculações
    cursoId: z.string().uuid('cursoId deve ser um UUID válido').nullable().optional(),
    turmaId: z.string().uuid('turmaId deve ser um UUID válido').nullable().optional(),
    instrutorId: z.string().uuid('instrutorId deve ser um UUID válido').nullable().optional(),
    moduloId: z.string().uuid('moduloId deve ser um UUID válido').nullable().optional(),
    // Demais campos suportados
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url('URL inválida').optional(),
    sala: z.string().max(100).optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    horaInicio: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    horaFim: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    materiais: materiaisInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Se cursoId vier preenchido, turmaId é obrigatório
    if (data.cursoId && !data.turmaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turmaId'],
        message: 'Se cursoId for informado, turmaId é obrigatório',
      });
    }
  });

/**
 * Schema para listar aulas
 */
export const listAulasQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(10),
    cursoId: z.string().uuid().optional(),
    // filtros por nome/código (para telas com busca por texto)
    curso: z.string().min(1).max(255).optional(),
    semTurma: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
      }
      return value;
    }, z.boolean().optional()),
    includeSemCurso: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
      }
      return value;
    }, z.boolean().optional()),
    turmaId: z.string().uuid().optional(),
    turma: z.string().min(1).max(255).optional(),
    moduloId: z.string().uuid().optional(),
    instrutorId: z.string().uuid().optional(),
    instrutor: z.string().min(1).max(255).optional(),
    modalidade: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (Array.isArray(value)) return value.join(',');
      return value;
    }, z.string().optional()), // ONLINE,AO_VIVO (CSV ou array)
    status: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (Array.isArray(value)) return value.join(',');
      return value;
    }, z.string().optional()), // PUBLICADA,CONCLUIDA (CSV ou array)
    obrigatoria: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
      }
      return value;
    }, z.boolean().optional()),
    // aliases de período (frontend)
    periodo: z.string().optional(), // ex: "2026-02-01,2026-02-28" ou ISO/ISO
    periodoInicio: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return new Date(`${trimmed}T00:00:00.000Z`);
        }
      }
      return value;
    }, z.coerce.date().optional()),
    periodoFim: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return new Date(`${trimmed}T23:59:59.999Z`);
        }
      }
      return value;
    }, z.coerce.date().optional()),
    dataInicio: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          // date-only → início do dia (UTC)
          return new Date(`${trimmed}T00:00:00.000Z`);
        }
      }
      return value;
    }, z.coerce.date().optional()),
    dataFim: z.preprocess((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      if (value instanceof Date) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          // date-only → fim do dia (UTC)
          return new Date(`${trimmed}T23:59:59.999Z`);
        }
      }
      return value;
    }, z.coerce.date().optional()),
    // search (compat) e titulo (telas que enviam "titulo" ao invés de "search")
    search: z.string().optional(),
    titulo: z.string().optional(),
    orderBy: z.enum(['criadoEm', 'titulo', 'ordem', 'dataInicio']).optional().default('ordem'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
  })
  .superRefine((query, ctx) => {
    if (query.semTurma === true && query.turmaId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['turmaId'],
        message: 'Não informe turmaId quando semTurma=true',
      });
    }
  });

/**
 * Schema para atualizar progresso
 */
export const updateProgressoSchema = z.object({
  inscricaoId: z.string().uuid(),
  percentualAssistido: z.number().min(0).max(100),
  tempoAssistidoSegundos: z.number().int().min(0),
  ultimaPosicao: z.number().int().min(0).optional(),
});

/**
 * Schema para registrar presença
 */
export const registrarPresencaSchema = z.object({
  inscricaoId: z.string().uuid(),
  tipo: z.enum(['entrada', 'saida']),
});

// Tipos exportados
export type CreateAulaInput = z.infer<typeof createAulaSchema>;
export type UpdateAulaInput = z.infer<typeof updateAulaSchema>;
export type PutUpdateAulaInput = z.infer<typeof putUpdateAulaSchema>;
export type ListAulasQuery = z.infer<typeof listAulasQuerySchema>;
export type UpdateProgressoInput = z.infer<typeof updateProgressoSchema>;
export type RegistrarPresencaInput = z.infer<typeof registrarPresencaSchema>;

import { z } from 'zod';

// Enums
const modalidadeEnum = z.enum(['ONLINE', 'PRESENCIAL', 'AO_VIVO', 'SEMIPRESENCIAL']);
const tipoLinkEnum = z.enum(['YOUTUBE', 'MEET']);
const statusEnum = z.enum(['RASCUNHO', 'PUBLICADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']);

/**
 * Schema para criar aula
 */
export const createAulaSchema = z
  .object({
    cursoId: z.string().uuid('cursoId deve ser um UUID válido').optional(),
    titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
    descricao: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres'),
    modalidade: modalidadeEnum,
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url('URL do YouTube inválida').optional(),
    obrigatoria: z.boolean().optional().default(true),
    duracaoMinutos: z.number().int().positive('Duração deve ser maior que 0'),
    // ✅ IMPORTANTE: Aulas devem ser criadas sempre como RASCUNHO
    // Publicação deve ser feita via endpoint específico PATCH /api/v1/cursos/aulas/{id}/publicar
    status: z.enum(['RASCUNHO']).optional().default('RASCUNHO'), // ✅ Apenas RASCUNHO permitido na criação
    gravarAula: z.boolean().optional().default(true),
    // Vinculação (TODOS OPCIONAIS)
    turmaId: z.string().uuid('turmaId deve ser um UUID válido').optional(),
    instrutorId: z.string().uuid('instrutorId deve ser um UUID válido').optional(),
    moduloId: z.string().uuid().optional(),
    sala: z.string().max(100).optional(),
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
    if (!data.turmaId && !data.cursoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cursoId'],
        message: 'cursoId é obrigatório quando turmaId não for informado (aula template)',
      });
    }

    // Validar ONLINE (não precisa de período)
    if (data.modalidade === 'ONLINE') {
      if (!data.youtubeUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['youtubeUrl'],
          message: 'Link do YouTube é obrigatório para aulas online',
        });
      }
      // ONLINE não usa período - será ignorado
    }

    // Validar PRESENCIAL (precisa de dataInicio, dataFim é opcional)
    if (data.modalidade === 'PRESENCIAL') {
      if (!data.dataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Data de início é obrigatória para aulas presenciais',
        });
      }
      // dataFim é opcional - se não informado, aula acontece apenas no dataInicio
      // Se informado, aula acontece de dataInicio a dataFim
    }

    // Validar AO_VIVO (precisa de dataInicio, dataFim é opcional)
    if (data.modalidade === 'AO_VIVO') {
      if (!data.dataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Data de início é obrigatória para aulas ao vivo',
        });
      }
      // Validar futuro
      if (data.dataInicio && new Date(data.dataInicio) < new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Aula ao vivo deve ser agendada para o futuro',
        });
      }
      // dataFim é opcional - será calculado automaticamente se não informado
    }

    // Validar SEMIPRESENCIAL (usa YouTube OU Meet)
    if (data.modalidade === 'SEMIPRESENCIAL') {
      // Precisa ter YouTube URL OU dataInicio (para Meet)
      const temYoutube = !!data.youtubeUrl;
      const temDataInicio = !!data.dataInicio;

      if (!temYoutube && !temDataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['youtubeUrl'],
          message: 'Aula semipresencial requer YouTube URL ou data de início (para Meet)',
        });
      }

      // Se tem dataInicio (para Meet), validar futuro
      if (temDataInicio && data.dataInicio && new Date(data.dataInicio) < new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Aula semipresencial com Meet deve ser agendada para o futuro',
        });
      }
      // dataFim é opcional - será calculado automaticamente se não informado
    }

    // Validar YouTube URL
    if (data.youtubeUrl) {
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//;
      if (!youtubeRegex.test(data.youtubeUrl)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['youtubeUrl'],
          message: 'URL do YouTube inválida',
        });
      }
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
    titulo: z.string().min(3).max(255).optional(),
    descricao: z.string().optional(),
    modalidade: modalidadeEnum.optional(),
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url().optional(),
    obrigatoria: z.boolean().optional(),
    duracaoMinutos: z.number().int().positive().optional(),
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
  })
  .partial();

/**
 * Schema para listar aulas
 */
export const listAulasQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
    cursoId: z.string().uuid().optional(),
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
    turmaId: z.string().uuid().optional(),
    moduloId: z.string().uuid().optional(),
    instrutorId: z.string().uuid().optional(),
    modalidade: z.string().optional(), // ONLINE,AO_VIVO (CSV)
    status: z.string().optional(), // PUBLICADA,CONCLUIDA (CSV)
    obrigatoria: z.coerce.boolean().optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim: z.coerce.date().optional(),
    search: z.string().optional(),
    orderBy: z.enum(['criadoEm', 'titulo', 'ordem', 'dataInicio']).optional().default('ordem'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
  })
  .superRefine((query, ctx) => {
    if (query.semTurma === true && !query.cursoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cursoId'],
        message: 'cursoId é obrigatório quando semTurma=true',
      });
    }

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
export type ListAulasQuery = z.infer<typeof listAulasQuerySchema>;
export type UpdateProgressoInput = z.infer<typeof updateProgressoSchema>;
export type RegistrarPresencaInput = z.infer<typeof registrarPresencaSchema>;

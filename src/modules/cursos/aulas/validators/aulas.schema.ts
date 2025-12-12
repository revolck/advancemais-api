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
    titulo: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(255),
    descricao: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres'),
    modalidade: modalidadeEnum,
    tipoLink: tipoLinkEnum.optional(),
    youtubeUrl: z.string().url('URL do YouTube inválida').optional(),
    obrigatoria: z.boolean().optional().default(true),
    duracaoMinutos: z.number().int().positive('Duração deve ser maior que 0'),
    status: z.enum(['RASCUNHO', 'PUBLICADA']).optional().default('RASCUNHO'),
    gravarAula: z.boolean().optional().default(true),
    // Vinculação (TODOS OPCIONAIS)
    turmaId: z.string().uuid('turmaId deve ser um UUID válido').optional(),
    instrutorId: z.string().uuid('instrutorId deve ser um UUID válido').optional(),
    moduloId: z.string().uuid().optional(),
    sala: z.string().max(100).optional(),
    // Data e Hora (SEPARADOS - Arquitetura Ideal)
    dataInicio: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD')
      .optional(),
    dataFim: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD')
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

    // Validar PRESENCIAL (precisa de período)
    if (data.modalidade === 'PRESENCIAL') {
      if (!data.dataInicio || !data.dataFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Período (dataInicio e dataFim) é obrigatório para aulas presenciais',
        });
      }
    }

    // Validar AO_VIVO (precisa de período no futuro)
    if (data.modalidade === 'AO_VIVO') {
      if (!data.dataInicio || !data.dataFim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Período (dataInicio e dataFim) é obrigatório para aulas ao vivo',
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
    }

    // Validar SEMIPRESENCIAL (usa YouTube OU Meet)
    if (data.modalidade === 'SEMIPRESENCIAL') {
      // Precisa ter YouTube URL OU período (para Meet)
      const temYoutube = !!data.youtubeUrl;
      const temPeriodo = !!(data.dataInicio && data.dataFim);

      if (!temYoutube && !temPeriodo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['youtubeUrl'],
          message: 'Aula semipresencial requer YouTube URL ou período (para Meet)',
        });
      }

      // Se tem período, validar futuro
      if (temPeriodo && data.dataInicio && new Date(data.dataInicio) < new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataInicio'],
          message: 'Aula ao vivo deve ser agendada para o futuro',
        });
      }
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

    // Validar dataFim > dataInicio
    if (data.dataInicio && data.dataFim) {
      if (data.dataFim <= data.dataInicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'Horário de término deve ser após horário de início',
        });
      }

      // Validar MESMO DIA para PRESENCIAL e AO_VIVO
      if (
        data.modalidade === 'PRESENCIAL' ||
        data.modalidade === 'AO_VIVO' ||
        (data.modalidade === 'SEMIPRESENCIAL' && data.tipoLink === 'MEET')
      ) {
        const diaInicio = data.dataInicio; // Já está no formato YYYY-MM-DD
        const diaFim = data.dataFim; // Já está no formato YYYY-MM-DD

        if (diaInicio !== diaFim) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['dataFim'],
            message: `Aulas ${data.modalidade === 'PRESENCIAL' ? 'presenciais' : 'ao vivo'} devem acontecer no mesmo dia. Início: ${diaInicio}, Fim: ${diaFim}`,
          });
        }
      }
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
  })
  .partial();

/**
 * Schema para listar aulas
 */
export const listAulasQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
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

/**
 * Validadores para o módulo de auditoria
 * @module auditoria/validators
 */

import { z } from 'zod';
import { AuditoriaCategoria, Roles, ScriptTipo, TransacaoTipo } from '@prisma/client';

const parseCsv = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const auditoriaLogInputSchema = z.object({
  categoria: z.nativeEnum(AuditoriaCategoria),
  tipo: z.string().min(1).max(50),
  acao: z.string().min(1).max(100),
  usuarioId: z.string().uuid().optional(),
  entidadeId: z.string().optional(),
  entidadeTipo: z.string().optional(),
  descricao: z.string().min(1).max(500),
  dadosAnteriores: z.record(z.any()).optional(),
  dadosNovos: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  ip: z.string().ip().optional(),
  userAgent: z.string().max(500).optional(),
});

export const auditoriaFiltersSchema = z.object({
  categoria: z.nativeEnum(AuditoriaCategoria).optional(),
  tipo: z.string().optional(),
  usuarioId: z.string().uuid().optional(),
  entidadeId: z.string().optional(),
  entidadeTipo: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const auditoriaDashboardFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().min(1).max(200).optional(),
    categorias: z.preprocess(parseCsv, z.array(z.nativeEnum(AuditoriaCategoria)).default([])),
    tipos: z.preprocess(parseCsv, z.array(z.string().min(1).max(120)).default([])),
    atorId: z.string().uuid().optional(),
    atorRole: z.union([z.nativeEnum(Roles), z.literal('SISTEMA')]).optional(),
    entidadeTipo: z.string().trim().min(1).max(120).optional(),
    entidadeId: z.string().trim().min(1).max(191).optional(),
    dataInicio: z.string().datetime().optional(),
    dataFim: z.string().datetime().optional(),
    sortBy: z.enum(['dataHora', 'categoria', 'tipo', 'acao']).default('dataHora'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((value, ctx) => {
    if (value.dataInicio && value.dataFim) {
      const start = new Date(value.dataInicio);
      const end = new Date(value.dataFim);
      if (start.getTime() > end.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dataFim'],
          message: 'dataFim deve ser maior ou igual a dataInicio',
        });
      }
    }
  });

export const auditoriaScriptInputSchema = z.object({
  nome: z.string().min(1).max(255),
  descricao: z.string().max(500).optional(),
  tipo: z.nativeEnum(ScriptTipo),
  parametros: z.record(z.any()).optional(),
});

export const auditoriaTransacaoInputSchema = z.object({
  tipo: z.nativeEnum(TransacaoTipo),
  valor: z.number().positive(),
  moeda: z.string().length(3).default('BRL'),
  referencia: z.string().max(100).optional(),
  gateway: z.string().max(50).optional(),
  gatewayId: z.string().max(100).optional(),
  usuarioId: z.string().uuid().optional(),
  empresaId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

export const auditoriaStatsFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  categoria: z.nativeEnum(AuditoriaCategoria).optional(),
  usuarioId: z.string().uuid().optional(),
});

export type AuditoriaLogInput = z.infer<typeof auditoriaLogInputSchema>;
export type AuditoriaFilters = z.infer<typeof auditoriaFiltersSchema>;
export type AuditoriaDashboardFilters = z.infer<typeof auditoriaDashboardFiltersSchema>;
export type AuditoriaScriptInput = z.infer<typeof auditoriaScriptInputSchema>;
export type AuditoriaTransacaoInput = z.infer<typeof auditoriaTransacaoInputSchema>;
export type AuditoriaStatsFilters = z.infer<typeof auditoriaStatsFiltersSchema>;

/**
 * Tipos para o módulo de auditoria
 * @module auditoria/types
 */

import type {
  Roles,
  AuditoriaCategoria,
  ScriptTipo,
  ScriptStatus,
  TransacaoTipo,
  TransacaoStatus,
} from '@prisma/client';

// Re-exportar enums do Prisma
export { AuditoriaCategoria, ScriptTipo, ScriptStatus, TransacaoTipo, TransacaoStatus };

export interface AuditoriaLogInput {
  categoria: AuditoriaCategoria;
  tipo: string;
  acao: string;
  usuarioId?: string;
  entidadeId?: string;
  entidadeTipo?: string;
  descricao: string;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export interface AuditoriaLogResponse {
  id: string;
  categoria: AuditoriaCategoria;
  tipo: string;
  acao: string;
  usuarioId?: string;
  entidadeId?: string;
  entidadeTipo?: string;
  descricao: string;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  criadoEm: Date;
  usuario?: {
    id: string;
    nomeCompleto: string;
    email: string;
    role: Roles;
  };
}

export interface AuditoriaFilters {
  categoria?: AuditoriaCategoria;
  tipo?: string;
  usuarioId?: string;
  entidadeId?: string;
  entidadeTipo?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AuditoriaScriptInput {
  nome: string;
  descricao?: string;
  tipo: ScriptTipo;
  parametros?: Record<string, any>;
}

export interface AuditoriaScriptResponse {
  id: string;
  nome: string;
  descricao?: string;
  tipo: ScriptTipo;
  status: ScriptStatus;
  executadoPor: string;
  parametros?: Record<string, any>;
  resultado?: Record<string, any>;
  erro?: string;
  duracaoMs?: number;
  criadoEm: Date;
  executadoEm?: Date;
  Usuarios: {
    id: string;
    nomeCompleto: string;
    email: string;
    role: Roles;
  };
}

export interface AuditoriaTransacaoInput {
  tipo: TransacaoTipo;
  valor: number;
  moeda?: string;
  referencia?: string;
  gateway?: string;
  gatewayId?: string;
  usuarioId?: string;
  empresaId?: string;
  metadata?: Record<string, any>;
}

export interface AuditoriaTransacaoResponse {
  id: string;
  tipo: TransacaoTipo;
  status: TransacaoStatus;
  valor: number;
  moeda: string;
  referencia?: string;
  gateway?: string;
  gatewayId?: string;
  usuarioId?: string;
  empresaId?: string;
  metadata?: Record<string, any>;
  criadoEm: Date;
  processadoEm?: Date;
  usuario?: {
    id: string;
    nomeCompleto: string;
    email: string;
    role: Roles;
  };
  empresa?: {
    id: string;
    nomeCompleto: string;
    email: string;
    role: Roles;
  };
}

export interface AuditoriaStats {
  totalLogs: number;
  logsPorCategoria: Record<AuditoriaCategoria, number>;
  logsPorTipo: Record<string, number>;
  logsPorUsuario: {
    usuarioId: string;
    nomeCompleto: string;
    total: number;
  }[];
  logsPorPeriodo: {
    data: string;
    total: number;
  }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

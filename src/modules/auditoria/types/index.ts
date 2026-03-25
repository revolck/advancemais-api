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

export interface AuditoriaDashboardActor {
  id: string | null;
  nome: string;
  role: string | null;
  roleLabel: string;
  avatarUrl: string | null;
}

export interface AuditoriaDashboardEntity {
  id: string;
  tipo: string;
  codigo: string | null;
  nomeExibicao: string | null;
}

export interface AuditoriaDashboardContexto {
  ip: string | null;
  userAgent: string | null;
  origem: string | null;
}

export interface AuditoriaDashboardItem {
  id: string;
  categoria: AuditoriaCategoria;
  tipo: string;
  acao: string;
  descricao: string;
  dataHora: string;
  ator: AuditoriaDashboardActor;
  entidade: AuditoriaDashboardEntity | null;
  contexto: AuditoriaDashboardContexto;
  dadosAnteriores: unknown | null;
  dadosNovos: unknown | null;
  meta: Record<string, unknown> | null;
}

export interface AuditoriaDashboardFilters {
  categorias: AuditoriaCategoria[];
  tipos: string[];
  page: number;
  pageSize: number;
  search?: string;
  atorId?: string;
  atorRole?: Roles | 'SISTEMA';
  entidadeTipo?: string;
  entidadeId?: string;
  dataInicio?: string;
  dataFim?: string;
  sortBy: 'dataHora' | 'categoria' | 'tipo' | 'acao';
  sortDir: 'asc' | 'desc';
}

export interface AuditoriaDashboardListResponse {
  items: AuditoriaDashboardItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  resumo: {
    total: number;
    ultimoEventoEm: string | null;
  };
  filtrosDisponiveis: {
    categorias: {
      value: AuditoriaCategoria;
      label: string;
      count: number;
    }[];
    tipos: {
      value: string;
      label: string;
      count: number;
    }[];
  };
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

export interface AuditoriaTransacaoDashboardUsuario {
  id: string;
  nome: string;
  email: string | null;
  codigo: string | null;
}

export interface AuditoriaTransacaoDashboardEmpresa {
  id: string;
  nomeExibicao: string;
  codigo: string | null;
}

export interface AuditoriaTransacaoDashboardContexto {
  cursoNome: string | null;
  cursoId: string | null;
  planoNome: string | null;
  planoId: string | null;
  origem: string | null;
  metodoPagamento: string | null;
}

export interface AuditoriaTransacaoDashboardItem {
  id: string;
  codigoExibicao: string;
  tipo: TransacaoTipo;
  tipoLabel: string;
  status: TransacaoStatus;
  statusLabel: string;
  valor: number;
  moeda: string;
  valorFormatado: string;
  gateway: string | null;
  gatewayLabel: string | null;
  gatewayReferencia: string | null;
  descricao: string;
  usuario: AuditoriaTransacaoDashboardUsuario | null;
  empresa: AuditoriaTransacaoDashboardEmpresa | null;
  contexto: AuditoriaTransacaoDashboardContexto;
  meta: Record<string, unknown> | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AuditoriaTransacoesDashboardFilters {
  page: number;
  pageSize: number;
  search?: string;
  tipos: TransacaoTipo[];
  status: TransacaoStatus[];
  usuarioId?: string;
  empresaId?: string;
  gateway?: string;
  dataInicio?: string;
  dataFim?: string;
  sortBy: 'criadoEm' | 'tipo' | 'status' | 'valor' | 'gateway';
  sortDir: 'asc' | 'desc';
}

export interface AuditoriaTransacoesDashboardListResponse {
  items: AuditoriaTransacaoDashboardItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  resumo: {
    total: number;
    valorTotal: number;
    ultimoEventoEm: string | null;
  };
  filtrosDisponiveis: {
    tipos: {
      value: TransacaoTipo;
      label: string;
      count: number;
    }[];
    status: {
      value: TransacaoStatus;
      label: string;
      count: number;
    }[];
    gateways: {
      value: string;
      label: string;
      count: number;
    }[];
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

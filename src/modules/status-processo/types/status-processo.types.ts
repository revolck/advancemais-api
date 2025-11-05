export interface StatusProcesso {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  isDefault: boolean;
  criadoPor: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreateStatusProcessoInput {
  nome: string;
  descricao?: string;
  ativo?: boolean;
  isDefault?: boolean;
}

export interface UpdateStatusProcessoInput {
  nome?: string;
  descricao?: string;
  ativo?: boolean;
  isDefault?: boolean;
}

export interface StatusProcessoFilters {
  ativo?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'nome' | 'criadoEm' | 'atualizadoEm';
  sortOrder?: 'asc' | 'desc';
}

export interface StatusProcessoResponse {
  id: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  isDefault: boolean;
  criadoPor: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface StatusProcessoListResponse {
  data: StatusProcessoResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

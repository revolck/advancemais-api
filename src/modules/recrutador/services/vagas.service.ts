import { ModalidadesDeVagas, Prisma, StatusDeVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { syncExpiredPublishedVagas } from '@/modules/empresas/vagas/services/status-sync.service';
import { getVagaStatusLabel } from '@/modules/entrevistas/utils/presentation';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

import type { RecrutadorVagasListQuery } from '../validators/vagas.schema';

const DEFAULT_RECRUITER_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
];

const STATUS_FILTER_ORDER: StatusDeVagas[] = [
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.EM_ANALISE,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
];

const MODALIDADE_LABELS: Record<ModalidadesDeVagas, string> = {
  REMOTO: 'Remoto',
  PRESENCIAL: 'Presencial',
  HIBRIDO: 'Híbrido',
};

const recruiterVagaListSelect = {
  id: true,
  titulo: true,
  codigo: true,
  status: true,
  usuarioId: true,
  modalidade: true,
  numeroVagas: true,
  inscricoesAte: true,
  inseridaEm: true,
  atualizadoEm: true,
  localizacao: true,
  Usuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      codUsuario: true,
      cnpj: true,
      UsuariosInformation: {
        select: {
          avatarUrl: true,
        },
      },
    },
  },
} satisfies Prisma.EmpresasVagasSelect;

type RecruiterVagaListRecord = Prisma.EmpresasVagasGetPayload<{
  select: typeof recruiterVagaListSelect;
}>;

type RecruiterVagaListItem = {
  id: string;
  titulo: string;
  codigo: string;
  status: StatusDeVagas;
  statusLabel: string;
  empresaUsuarioId: string;
  empresa: {
    id: string | null;
    nome: string | null;
    nomeExibicao: string | null;
    codUsuario: string | null;
    cnpj: string | null;
    avatarUrl: string | null;
  };
  localizacao: {
    cidade: string | null;
    estado: string | null;
    modalidadeLabel: string;
    label: string;
  };
  numeroVagas: number;
  inscricoesAte: Date | null;
  inseridaEm: Date;
  atualizadoEm: Date;
  escopo: {
    tipoAcesso: 'EMPRESA' | 'VAGA';
    empresaVinculadaDiretamente: boolean;
  };
};

const normalizeStatusFilter = (status: RecrutadorVagasListQuery['status']): StatusDeVagas[] => {
  if (!status || status.length === 0) {
    return DEFAULT_RECRUITER_STATUSES;
  }

  if (status.some((value) => value === 'ALL' || value === 'TODAS' || value === 'TODOS')) {
    return DEFAULT_RECRUITER_STATUSES;
  }

  return status as StatusDeVagas[];
};

const parseStringField = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildLocationSummary = (vaga: RecruiterVagaListRecord) => {
  const raw =
    vaga.localizacao && typeof vaga.localizacao === 'object' && !Array.isArray(vaga.localizacao)
      ? (vaga.localizacao as Record<string, unknown>)
      : null;

  const cidade = parseStringField(raw?.cidade);
  const estado = parseStringField(raw?.estado);
  const modalidadeLabel = MODALIDADE_LABELS[vaga.modalidade] ?? String(vaga.modalidade);

  let label = modalidadeLabel;
  if (cidade && estado) {
    label = `${cidade}, ${estado}`;
  } else if (cidade) {
    label = cidade;
  } else if (estado) {
    label = estado;
  }

  return {
    cidade,
    estado,
    modalidadeLabel,
    label,
  };
};

const mapRecruiterVagaItem = (
  vaga: RecruiterVagaListRecord,
  directEmpresaIds: Set<string>,
): RecruiterVagaListItem => {
  const empresaVinculadaDiretamente = directEmpresaIds.has(vaga.usuarioId);

  return {
    id: vaga.id,
    titulo: vaga.titulo,
    codigo: vaga.codigo,
    status: vaga.status,
    statusLabel: getVagaStatusLabel(vaga.status),
    empresaUsuarioId: vaga.usuarioId,
    empresa: {
      id: vaga.Usuarios?.id ?? null,
      nome: vaga.Usuarios?.nomeCompleto ?? null,
      nomeExibicao: vaga.Usuarios?.nomeCompleto ?? null,
      codUsuario: vaga.Usuarios?.codUsuario ?? null,
      cnpj: vaga.Usuarios?.cnpj ?? null,
      avatarUrl: vaga.Usuarios?.UsuariosInformation?.avatarUrl ?? null,
    },
    localizacao: buildLocationSummary(vaga),
    numeroVagas: vaga.numeroVagas,
    inscricoesAte: vaga.inscricoesAte ?? null,
    inseridaEm: vaga.inseridaEm,
    atualizadoEm: vaga.atualizadoEm,
    escopo: {
      tipoAcesso: empresaVinculadaDiretamente ? 'EMPRESA' : 'VAGA',
      empresaVinculadaDiretamente,
    },
  };
};

const compareText = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '', 'pt-BR', { sensitivity: 'base' });

const compareNullableDate = (left: Date | null, right: Date | null, direction: 'asc' | 'desc') => {
  const leftValue = left ? left.getTime() : null;
  const rightValue = right ? right.getTime() : null;

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
};

const sortItems = (items: RecruiterVagaListItem[], query: RecrutadorVagasListQuery) => {
  const direction = query.sortDir === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    let result = 0;

    switch (query.sortBy) {
      case 'titulo':
        result = compareText(left.titulo, right.titulo);
        break;
      case 'empresaNome':
        result = compareText(left.empresa.nomeExibicao, right.empresa.nomeExibicao);
        break;
      case 'numeroVagas':
        result = left.numeroVagas - right.numeroVagas;
        break;
      case 'inscricoesAte':
        result = compareNullableDate(left.inscricoesAte, right.inscricoesAte, query.sortDir);
        break;
      case 'inseridaEm':
      default:
        result =
          query.sortDir === 'asc'
            ? left.inseridaEm.getTime() - right.inseridaEm.getTime()
            : right.inseridaEm.getTime() - left.inseridaEm.getTime();
        break;
    }

    if (result === 0) {
      result = compareText(left.titulo, right.titulo);
    }

    return query.sortBy === 'inscricoesAte' || query.sortBy === 'inseridaEm'
      ? result
      : result * direction;
  });
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
});

const buildFilters = (items: RecruiterVagaListItem[]) => {
  const statusCounts = new Map<StatusDeVagas, number>();
  const companyCounts = new Map<string, { label: string; count: number }>();
  const locationCounts = new Map<string, { label: string; count: number }>();

  items.forEach((item) => {
    statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);

    if (item.empresa.id) {
      const current = companyCounts.get(item.empresa.id);
      companyCounts.set(item.empresa.id, {
        label: item.empresa.nomeExibicao ?? item.empresa.nome ?? item.empresa.id,
        count: (current?.count ?? 0) + 1,
      });
    }

    const locationKey = item.localizacao.label;
    const currentLocation = locationCounts.get(locationKey);
    locationCounts.set(locationKey, {
      label: item.localizacao.label,
      count: (currentLocation?.count ?? 0) + 1,
    });
  });

  return {
    status: STATUS_FILTER_ORDER.filter((status) => statusCounts.has(status)).map((status) => ({
      value: status,
      label: getVagaStatusLabel(status),
      count: statusCounts.get(status) ?? 0,
    })),
    empresas: Array.from(companyCounts.entries())
      .sort((left, right) => compareText(left[1].label, right[1].label))
      .map(([id, value]) => ({
        id,
        label: value.label,
        count: value.count,
      })),
    localizacoes: Array.from(locationCounts.entries())
      .sort((left, right) => compareText(left[1].label, right[1].label))
      .map(([value, item]) => ({
        value,
        label: item.label,
        count: item.count,
      })),
  };
};

const matchesLocationFilter = (item: RecruiterVagaListItem, location?: string) => {
  if (!location) return true;
  return item.localizacao.label.toLowerCase().includes(location.toLowerCase());
};

export const recrutadorVagasDashboardService = {
  getStatusesOrFail(query: RecrutadorVagasListQuery) {
    const statuses = normalizeStatusFilter(query.status);

    if (statuses.includes(StatusDeVagas.RASCUNHO)) {
      throw Object.assign(new Error('Recrutador não pode consultar vagas em RASCUNHO'), {
        status: 403,
        code: 'RECRUTADOR_RASCUNHO_FORBIDDEN',
      });
    }

    return statuses;
  },

  async list(recrutadorId: string, query: RecrutadorVagasListQuery) {
    const statuses = this.getStatusesOrFail(query);

    if (query.empresaUsuarioId) {
      await recrutadorEmpresasService.getForDashboard(recrutadorId, query.empresaUsuarioId);
    }

    const [scopedVagaIds, directEmpresaIds] = await Promise.all([
      query.empresaUsuarioId
        ? recrutadorVagasService.listVagaIdsByEmpresa(recrutadorId, query.empresaUsuarioId)
        : recrutadorVagasService.listVagaIds(recrutadorId),
      recrutadorEmpresasService.listDirectEmpresaUsuarioIds(recrutadorId),
    ]);

    if (scopedVagaIds.length === 0) {
      return {
        data: [] as RecruiterVagaListItem[],
        pagination: buildPagination(query.page, query.pageSize, 0),
        filtrosDisponiveis: {
          status: [],
          empresas: [],
          localizacoes: [],
        },
      };
    }

    await syncExpiredPublishedVagas({ vagaIds: scopedVagaIds });

    const vagas = await prisma.empresasVagas.findMany({
      where: {
        id: { in: scopedVagaIds },
        status: { in: statuses },
        ...(query.empresaUsuarioId ? { usuarioId: query.empresaUsuarioId } : {}),
        ...(query.search
          ? {
              OR: [
                { titulo: { contains: query.search, mode: 'insensitive' } },
                { codigo: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: recruiterVagaListSelect,
    });

    const directEmpresaSet = new Set(directEmpresaIds);
    const mappedItems = vagas
      .map((vaga) => mapRecruiterVagaItem(vaga, directEmpresaSet))
      .filter((item) => matchesLocationFilter(item, query.localizacao));

    const sortedItems = sortItems(mappedItems, query);
    const total = sortedItems.length;
    const skip = (query.page - 1) * query.pageSize;

    return {
      data: sortedItems.slice(skip, skip + query.pageSize),
      pagination: buildPagination(query.page, query.pageSize, total),
      filtrosDisponiveis: buildFilters(sortedItems),
    };
  },
};

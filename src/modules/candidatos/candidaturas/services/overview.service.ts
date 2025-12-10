import { Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  buildCandidatoSelect,
  mapCandidatoDetalhe,
} from '@/modules/candidatos/candidaturas/utils/candidatos-overview-mapper';

import type { CandidaturasOverviewQuery } from '../validators/overview.schema';

const GLOBAL_ROLES = new Set<Roles>([
  Roles.ADMIN,
  Roles.MODERADOR,
  Roles.SETOR_DE_VAGAS,
  Roles.RECRUTADOR,
]);

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
};

const buildSearchWhere = (search?: string): Prisma.UsuariosWhereInput | undefined => {
  if (!search) {
    return undefined;
  }

  const trimmedSearch = search.trim();

  // Se for um UUID válido, buscar diretamente por ID
  if (isValidUUID(trimmedSearch)) {
    return {
      id: trimmedSearch,
    } satisfies Prisma.UsuariosWhereInput;
  }

  // Caso contrário, buscar por nome, email, CPF ou código
  return {
    OR: [
      { nomeCompleto: { contains: trimmedSearch, mode: 'insensitive' } },
      { email: { contains: trimmedSearch, mode: 'insensitive' } },
      { cpf: { contains: trimmedSearch, mode: 'insensitive' } },
      { codUsuario: { contains: trimmedSearch, mode: 'insensitive' } },
    ],
  } satisfies Prisma.UsuariosWhereInput;
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

interface OverviewParams extends CandidaturasOverviewQuery {
  viewerId: string;
  viewerRole: Roles;
}

interface FiltersResult {
  usuariosWhere: Prisma.UsuariosWhereInput;
  candidaturasSelectWhere?: Prisma.EmpresasCandidatosWhereInput;
  candidaturasMetricsWhere?: Prisma.EmpresasCandidatosWhereInput;
  scope: 'GLOBAL' | 'EMPRESA';
  effectiveEmpresaUsuarioId: string | null;
  appliedFilters: {
    vagaId: string | null;
    status: string[];
    search: string | null;
    onlyWithCandidaturas: boolean;
    aplicadaDe: string | null;
    aplicadaAte: string | null;
  };
}

const buildFilters = ({
  viewerId,
  viewerRole,
  onlyWithCandidaturas,
  status,
  vagaId,
  empresaUsuarioId,
  search,
  aplicadaDe,
  aplicadaAte,
}: OverviewParams): FiltersResult => {
  const isGlobalViewer = GLOBAL_ROLES.has(viewerRole);
  const effectiveEmpresaUsuarioId = isGlobalViewer ? (empresaUsuarioId ?? null) : viewerId;

  const searchWhere = buildSearchWhere(search);
  const isSearchingByUserId = search && isValidUUID(search.trim());

  const usuariosWhere: Prisma.UsuariosWhereInput = {
    role: Roles.ALUNO_CANDIDATO,
    UsuariosCurriculos: { some: {} },
  };

  if (searchWhere) {
    const currentAnd = Array.isArray(usuariosWhere.AND)
      ? usuariosWhere.AND
      : usuariosWhere.AND
        ? [usuariosWhere.AND]
        : [];

    usuariosWhere.AND = [...currentAnd, searchWhere];
  }

  const candidaturasWhereBase: Prisma.EmpresasCandidatosWhereInput = {};

  // Se está buscando por userId específico, não filtrar por empresa
  // para retornar todas as candidaturas desse candidato
  if (!isSearchingByUserId && effectiveEmpresaUsuarioId) {
    candidaturasWhereBase.empresaUsuarioId = effectiveEmpresaUsuarioId;
  }

  if (vagaId) {
    candidaturasWhereBase.vagaId = vagaId;
  }

  if (status && status.length > 0) {
    candidaturasWhereBase.statusId = { in: status };
  }

  // Filtros de data de candidatura (aplicadaEm)
  if (aplicadaDe || aplicadaAte) {
    candidaturasWhereBase.aplicadaEm = {};
    if (aplicadaDe) {
      // Início do dia
      const startOfDay = new Date(aplicadaDe);
      startOfDay.setHours(0, 0, 0, 0);
      candidaturasWhereBase.aplicadaEm.gte = startOfDay;
    }
    if (aplicadaAte) {
      // Fim do dia
      const endOfDay = new Date(aplicadaAte);
      endOfDay.setHours(23, 59, 59, 999);
      candidaturasWhereBase.aplicadaEm.lte = endOfDay;
    }
  }

  // Se está buscando por userId, adicionar o filtro de candidatoId
  if (isSearchingByUserId && searchWhere?.id) {
    candidaturasWhereBase.candidatoId = searchWhere.id as string;
  }

  const hasCandidaturaFilters = Object.keys(candidaturasWhereBase).length > 0;
  const shouldRequireCandidaturas =
    !isGlobalViewer ||
    Boolean(onlyWithCandidaturas) ||
    hasCandidaturaFilters ||
    isSearchingByUserId;

  if (shouldRequireCandidaturas) {
    usuariosWhere.EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios = {
      some: hasCandidaturaFilters ? candidaturasWhereBase : {},
    };
  }

  // Quando busca por userId, sempre retornar todas as candidaturas desse candidato
  // independente de filtros de empresa
  const candidaturasSelectWhere = isSearchingByUserId
    ? searchWhere?.id
      ? { candidatoId: searchWhere.id as string }
      : undefined
    : hasCandidaturaFilters
      ? candidaturasWhereBase
      : undefined;

  const candidaturasMetricsWhere: Prisma.EmpresasCandidatosWhereInput | undefined = (() => {
    if (!hasCandidaturaFilters && !searchWhere) {
      return undefined;
    }

    const metricsWhere: Prisma.EmpresasCandidatosWhereInput = { ...candidaturasWhereBase };

    if (searchWhere && searchWhere.id) {
      metricsWhere.candidatoId = searchWhere.id as string;
    }

    return metricsWhere;
  })();

  return {
    usuariosWhere,
    candidaturasSelectWhere,
    candidaturasMetricsWhere,
    scope: isGlobalViewer && !effectiveEmpresaUsuarioId ? 'GLOBAL' : 'EMPRESA',
    effectiveEmpresaUsuarioId,
    appliedFilters: {
      vagaId: vagaId ?? null,
      status: status ?? [],
      search: search ?? null,
      onlyWithCandidaturas: Boolean(shouldRequireCandidaturas),
      aplicadaDe: aplicadaDe?.toISOString() ?? null,
      aplicadaAte: aplicadaAte?.toISOString() ?? null,
    },
  } satisfies FiltersResult;
};

export const candidaturasOverviewService = {
  list: async (params: OverviewParams) => {
    const { page, pageSize, viewerRole } = params;
    const skip = (page - 1) * pageSize;

    const {
      usuariosWhere,
      candidaturasSelectWhere,
      candidaturasMetricsWhere,
      scope,
      effectiveEmpresaUsuarioId,
      appliedFilters,
    } = buildFilters(params);

    const [total, candidatos, totalCurriculos, totalCandidaturas] = await prisma.$transaction([
      prisma.usuarios.count({ where: usuariosWhere }),
      prisma.usuarios.findMany({
        where: usuariosWhere,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: buildCandidatoSelect(candidaturasSelectWhere),
      }),
      prisma.usuariosCurriculos.count({
        where: {
          Usuarios: usuariosWhere,
        },
      }),
      prisma.empresasCandidatos.count({
        where: candidaturasMetricsWhere ?? {},
      }),
    ]);

    const data = candidatos
      .map((candidato) => mapCandidatoDetalhe(candidato))
      .filter((item): item is NonNullable<ReturnType<typeof mapCandidatoDetalhe>> => item !== null);

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
      summary: {
        candidatos: total,
        UsuariosCurriculos: totalCurriculos,
        candidaturas: totalCandidaturas,
      },
      filters: {
        ...appliedFilters,
        scope,
        empresaUsuarioId: effectiveEmpresaUsuarioId,
        viewerRole,
      },
    };
  },
};

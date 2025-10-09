import { Prisma, Roles, StatusProcesso } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  buildCandidatoSelect,
  mapCandidatoDetalhe,
} from '@/modules/candidatos/candidaturas/utils/candidatos-overview-mapper';

import type { CandidaturasOverviewQuery } from '../validators/overview.schema';

const GLOBAL_ROLES = new Set<Roles>([
  Roles.ADMIN,
  Roles.MODERADOR,
  Roles.RECRUTADOR,
  Roles.PSICOLOGO,
]);

const buildSearchWhere = (search?: string): Prisma.UsuariosWhereInput | undefined => {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search, mode: 'insensitive' } },
      { codUsuario: { contains: search, mode: 'insensitive' } },
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
    status: StatusProcesso[];
    search: string | null;
    onlyWithCandidaturas: boolean;
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
}: OverviewParams): FiltersResult => {
  const isGlobalViewer = GLOBAL_ROLES.has(viewerRole);
  const effectiveEmpresaUsuarioId = isGlobalViewer ? empresaUsuarioId ?? null : viewerId;

  const searchWhere = buildSearchWhere(search);

  const usuariosWhere: Prisma.UsuariosWhereInput = {
    role: Roles.ALUNO_CANDIDATO,
    curriculos: { some: {} },
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

  if (effectiveEmpresaUsuarioId) {
    candidaturasWhereBase.empresaUsuarioId = effectiveEmpresaUsuarioId;
  }

  if (vagaId) {
    candidaturasWhereBase.vagaId = vagaId;
  }

  if (status && status.length > 0) {
    candidaturasWhereBase.status = { in: status };
  }

  const hasCandidaturaFilters = Object.keys(candidaturasWhereBase).length > 0;
  const shouldRequireCandidaturas =
    !isGlobalViewer || Boolean(onlyWithCandidaturas) || hasCandidaturaFilters;

  if (shouldRequireCandidaturas) {
    usuariosWhere.candidaturasFeitas = {
      some: hasCandidaturaFilters ? candidaturasWhereBase : {},
    };
  }

  const candidaturasSelectWhere = hasCandidaturaFilters ? candidaturasWhereBase : undefined;

  const candidaturasMetricsWhere: Prisma.EmpresasCandidatosWhereInput | undefined = (() => {
    if (!hasCandidaturaFilters && !searchWhere) {
      return undefined;
    }

    const metricsWhere: Prisma.EmpresasCandidatosWhereInput = { ...candidaturasWhereBase };

    if (searchWhere) {
      metricsWhere.candidato = { is: searchWhere };
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
          usuario: { is: usuariosWhere },
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
        curriculos: totalCurriculos,
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

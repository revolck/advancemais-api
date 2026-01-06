import { Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  buildCandidatoSelect,
  mapCandidatoDetalhe,
} from '@/modules/candidatos/candidaturas/utils/candidatos-overview-mapper';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

import type { CandidaturasOverviewQuery } from '../validators/overview.schema';

const GLOBAL_ROLES = new Set<Roles>([Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS]);

export class CandidaturasOverviewForbiddenError extends Error {
  status = 403 as const;
  code = 'FORBIDDEN_EMPRESA_SCOPE' as const;
}

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
  effectiveEmpresaUsuarioIds: string[] | null;
  effectiveVagaIds: string[] | null;
  appliedFilters: {
    vagaId: string | null;
    status: string[];
    search: string | null;
    onlyWithCandidaturas: boolean;
    aplicadaDe: string | null;
    aplicadaAte: string | null;
    empresaUsuarioIds: string[];
    vagaIds: string[];
  };
}

const buildFilters = async ({
  viewerId,
  viewerRole,
  onlyWithCandidaturas,
  status,
  vagaId,
  empresaUsuarioId,
  search,
  aplicadaDe,
  aplicadaAte,
}: OverviewParams): Promise<FiltersResult> => {
  const isGlobalViewer = GLOBAL_ROLES.has(viewerRole);
  const isEmpresa = viewerRole === Roles.EMPRESA;
  const isRecruiter = viewerRole === Roles.RECRUTADOR;

  const effectiveEmpresaUsuarioIds: string[] | null = (() => {
    if (isEmpresa) return [viewerId];
    if (isGlobalViewer) return empresaUsuarioId ? [empresaUsuarioId] : null;
    return null;
  })();

  const allowedVagaIds = isRecruiter ? await recrutadorVagasService.listVagaIds(viewerId) : null;

  const effectiveVagaIds: string[] | null = isRecruiter
    ? await (async () => {
        if (!allowedVagaIds || allowedVagaIds.length === 0) return [];

        if (empresaUsuarioId) {
          const vagaIdsByEmpresa = await recrutadorVagasService.listVagaIdsByEmpresa(
            viewerId,
            empresaUsuarioId,
          );

          if (vagaIdsByEmpresa.length === 0) {
            throw new CandidaturasOverviewForbiddenError(
              'Acesso negado: empresaUsuarioId sem vagas vinculadas ao recrutador',
            );
          }

          if (vagaId) {
            if (!vagaIdsByEmpresa.includes(vagaId)) {
              throw new CandidaturasOverviewForbiddenError(
                'Acesso negado: vagaId não pertence à empresaUsuarioId informada',
              );
            }
            return [vagaId];
          }

          return vagaIdsByEmpresa;
        }

        if (vagaId) {
          if (!allowedVagaIds.includes(vagaId)) {
            throw new CandidaturasOverviewForbiddenError(
              'Acesso negado: vagaId fora do vínculo do recrutador',
            );
          }
          return [vagaId];
        }

        return allowedVagaIds;
      })()
    : null;

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

  if (effectiveEmpresaUsuarioIds !== null) {
    candidaturasWhereBase.empresaUsuarioId = {
      in: effectiveEmpresaUsuarioIds,
    };
  }

  if (effectiveVagaIds !== null) {
    candidaturasWhereBase.vagaId = { in: effectiveVagaIds };
  } else if (vagaId) {
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
  // (admins podem ver tudo; recrutadores ficam restritos ao escopo de empresas)
  const candidaturasSelectWhere =
    isSearchingByUserId && searchWhere?.id
      ? effectiveEmpresaUsuarioIds === null && effectiveVagaIds === null
        ? { candidatoId: searchWhere.id as string }
        : {
            candidatoId: searchWhere.id as string,
            ...(effectiveEmpresaUsuarioIds
              ? { empresaUsuarioId: { in: effectiveEmpresaUsuarioIds } }
              : {}),
            ...(effectiveVagaIds ? { vagaId: { in: effectiveVagaIds } } : {}),
          }
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
    scope: effectiveEmpresaUsuarioIds === null && effectiveVagaIds === null ? 'GLOBAL' : 'EMPRESA',
    effectiveEmpresaUsuarioIds,
    effectiveVagaIds,
    appliedFilters: {
      vagaId: vagaId ?? null,
      status: status ?? [],
      search: search ?? null,
      onlyWithCandidaturas: Boolean(shouldRequireCandidaturas),
      aplicadaDe: aplicadaDe?.toISOString() ?? null,
      aplicadaAte: aplicadaAte?.toISOString() ?? null,
      empresaUsuarioIds: effectiveEmpresaUsuarioIds ?? [],
      vagaIds: effectiveVagaIds ?? [],
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
      effectiveEmpresaUsuarioIds,
      effectiveVagaIds,
      appliedFilters,
    } = await buildFilters(params);

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
        empresaUsuarioId:
          effectiveEmpresaUsuarioIds?.length === 1 ? effectiveEmpresaUsuarioIds[0] : null,
        vagaId: effectiveVagaIds?.length === 1 ? effectiveVagaIds[0] : null,
        viewerRole,
      },
    };
  },
};

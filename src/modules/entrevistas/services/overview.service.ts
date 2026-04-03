import { EntrevistaStatus, Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { googleOAuthService } from '@/modules/cursos/aulas/services/google-oauth.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';

import {
  buildInterviewAgendaPayload,
  formatInterviewDateTime,
  getInterviewStatusLabel,
  parseInterviewChannel,
} from '../utils/presentation';
import type { EntrevistasOverviewQuery } from '../validators/overview.schema';

const GLOBAL_ROLES = new Set<Roles>([Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS]);
const DB_STATUS_VALUES = new Set<EntrevistaStatus>([
  EntrevistaStatus.AGENDADA,
  EntrevistaStatus.CANCELADA,
]);

export class EntrevistasOverviewForbiddenError extends Error {
  status = 403 as const;
  code = 'INSUFFICIENT_PERMISSIONS' as const;
}

const paginationFromTotal = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
});

const buildSearchWhere = (
  search?: string,
): Prisma.EmpresasVagasEntrevistasWhereInput | undefined => {
  if (!search) {
    return undefined;
  }

  const trimmed = search.trim();

  return {
    OR: [
      { titulo: { contains: trimmed, mode: 'insensitive' } },
      { descricao: { contains: trimmed, mode: 'insensitive' } },
      {
        candidato: {
          is: {
            OR: [
              { nomeCompleto: { contains: trimmed, mode: 'insensitive' } },
              { email: { contains: trimmed, mode: 'insensitive' } },
              { cpf: { contains: trimmed, mode: 'insensitive' } },
              { codUsuario: { contains: trimmed, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        EmpresasVagas: {
          is: {
            OR: [
              { titulo: { contains: trimmed, mode: 'insensitive' } },
              { codigo: { contains: trimmed, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        empresa: {
          is: {
            nomeCompleto: { contains: trimmed, mode: 'insensitive' },
          },
        },
      },
      {
        recrutador: {
          is: {
            nomeCompleto: { contains: trimmed, mode: 'insensitive' },
          },
        },
      },
    ],
  };
};

const emptyResponse = (page: number, pageSize: number) => ({
  items: [],
  pagination: paginationFromTotal(page, pageSize, 0),
  summary: {
    totalEntrevistas: 0,
    agendadas: 0,
    confirmadas: 0,
    realizadas: 0,
    canceladas: 0,
    naoCompareceram: 0,
  },
  filtrosDisponiveis: {
    statusEntrevista: [],
    modalidades: [],
  },
});

const buildCapabilities = (googleStatus: {
  conectado: boolean;
  expirado: boolean;
  calendarId: string | null;
  expiraEm: string | null;
}) => ({
  canCreate: true,
  canCreatePresencial: true,
  canCreateOnline: googleStatus.conectado,
  requiresGoogleForOnline: true,
  google: {
    connected: googleStatus.conectado,
    expired: googleStatus.expirado,
    calendarId: googleStatus.calendarId,
    expiraEm: googleStatus.expiraEm,
    connectEndpoint: '/api/v1/auth/google/connect',
    disconnectEndpoint: '/api/v1/auth/google/disconnect',
    statusEndpoint: '/api/v1/auth/google/status',
  },
});

interface ListParams extends EntrevistasOverviewQuery {
  viewerId: string;
  viewerRole: Roles;
}

const buildScopedWhere = async (
  params: ListParams,
): Promise<Prisma.EmpresasVagasEntrevistasWhereInput | null> => {
  const and: Prisma.EmpresasVagasEntrevistasWhereInput[] = [];

  if (GLOBAL_ROLES.has(params.viewerRole)) {
    if (params.empresaUsuarioId) {
      and.push({ empresaUsuarioId: params.empresaUsuarioId });
    }
    if (params.vagaId) {
      and.push({ vagaId: params.vagaId });
    }
    if (params.recrutadorId) {
      and.push({ recrutadorId: params.recrutadorId });
    }
  } else if (params.viewerRole === Roles.EMPRESA) {
    if (params.empresaUsuarioId && params.empresaUsuarioId !== params.viewerId) {
      throw new EntrevistasOverviewForbiddenError(
        'Sem permissão para acessar entrevistas dessa empresa.',
      );
    }

    and.push({ empresaUsuarioId: params.viewerId });

    if (params.vagaId) {
      and.push({ vagaId: params.vagaId });
    }

    if (params.recrutadorId) {
      and.push({ recrutadorId: params.recrutadorId });
    }
  } else if (params.viewerRole === Roles.RECRUTADOR) {
    const allowedVagaIds = await recrutadorVagasService.listVagaIds(params.viewerId);

    if (allowedVagaIds.length === 0) {
      return null;
    }

    let effectiveVagaIds = allowedVagaIds;

    if (params.empresaUsuarioId) {
      const vagaIdsByEmpresa = await recrutadorVagasService.listVagaIdsByEmpresa(
        params.viewerId,
        params.empresaUsuarioId,
      );

      if (vagaIdsByEmpresa.length === 0) {
        throw new EntrevistasOverviewForbiddenError(
          'Sem permissão para acessar entrevistas dessa empresa.',
        );
      }

      effectiveVagaIds = vagaIdsByEmpresa;
    }

    if (params.vagaId) {
      if (!effectiveVagaIds.includes(params.vagaId)) {
        throw new EntrevistasOverviewForbiddenError(
          'Sem permissão para acessar entrevistas dessa vaga.',
        );
      }

      effectiveVagaIds = [params.vagaId];
    }

    and.push({ vagaId: { in: effectiveVagaIds } });

    if (params.recrutadorId) {
      and.push({ recrutadorId: params.recrutadorId });
    }
  } else {
    throw new EntrevistasOverviewForbiddenError('Sem permissão para acessar as entrevistas.');
  }

  if (params.statusEntrevista.length > 0) {
    const dbStatuses = params.statusEntrevista.filter((value): value is EntrevistaStatus =>
      DB_STATUS_VALUES.has(value as EntrevistaStatus),
    );

    if (dbStatuses.length === 0) {
      return null;
    }

    and.push({ status: { in: dbStatuses } });
  }

  if (params.modalidades.length > 0) {
    const modalidadeConditions = params.modalidades
      .map((modalidade) => buildModalidadeCondition(modalidade))
      .filter((condition): condition is Prisma.EmpresasVagasEntrevistasWhereInput =>
        Boolean(condition),
      );

    if (modalidadeConditions.length === 0) {
      return null;
    }

    and.push({ OR: modalidadeConditions });
  }

  if (params.dataInicio || params.dataFim) {
    and.push({
      dataInicio: {
        ...(params.dataInicio ? { gte: new Date(params.dataInicio) } : {}),
        ...(params.dataFim ? { lte: new Date(params.dataFim) } : {}),
      },
    });
  }

  const searchWhere = buildSearchWhere(params.search);
  if (searchWhere) {
    and.push(searchWhere);
  }

  return and.length > 0 ? { AND: and } : {};
};

const buildOrderBy = (
  sortBy: EntrevistasOverviewQuery['sortBy'],
  sortDir: EntrevistasOverviewQuery['sortDir'],
): Prisma.EmpresasVagasEntrevistasOrderByWithRelationInput => {
  switch (sortBy) {
    case 'criadoEm':
      return { criadoEm: sortDir };
    case 'statusEntrevista':
      return { status: sortDir };
    case 'candidatoNome':
      return { candidato: { nomeCompleto: sortDir } };
    case 'vagaTitulo':
      return { EmpresasVagas: { titulo: sortDir } };
    case 'empresaNome':
      return { empresa: { nomeCompleto: sortDir } };
    case 'agendadaPara':
    default:
      return { dataInicio: sortDir };
  }
};

const buildStatusSummary = (grouped: { status: EntrevistaStatus; count: number }[]) => {
  const byStatus = new Map(grouped.map((item) => [item.status, item.count]));

  return {
    totalEntrevistas: grouped.reduce((acc, item) => acc + item.count, 0),
    agendadas: byStatus.get(EntrevistaStatus.AGENDADA) ?? 0,
    confirmadas: 0,
    realizadas: 0,
    canceladas: byStatus.get(EntrevistaStatus.CANCELADA) ?? 0,
    naoCompareceram: 0,
  };
};

const statusFiltersFromGroup = (grouped: { status: EntrevistaStatus; count: number }[]) =>
  grouped.map((item) => ({
    value: item.status,
    label: getInterviewStatusLabel(item.status),
    count: item.count,
  }));

const buildModalidadeCondition = (
  modalidade: EntrevistasOverviewQuery['modalidades'][number],
): Prisma.EmpresasVagasEntrevistasWhereInput | null => {
  switch (modalidade) {
    case 'ONLINE':
      return {
        OR: [
          { meetUrl: { startsWith: 'http' } },
          { meetUrl: { startsWith: 'https' } },
          { meetUrl: { startsWith: 'online://' } },
        ],
      };
    case 'PRESENCIAL':
      return {
        OR: [{ meetUrl: '' }, { meetUrl: { startsWith: 'presencial://' } }],
      };
    default:
      return null;
  }
};

const modalidadeFiltersFromRows = (rows: { meetUrl: string }[]) => {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const modalidade = parseInterviewChannel(row.meetUrl).modalidade;
    if (!['ONLINE', 'PRESENCIAL'].includes(modalidade)) {
      return acc;
    }
    acc[modalidade] = (acc[modalidade] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([value, count]) => ({
    value,
    label: parseInterviewChannel(`${value.toLowerCase()}://`).modalidadeLabel,
    count,
  }));
};

export const entrevistasOverviewService = {
  async list(params: ListParams) {
    const googleStatus = await googleOAuthService.getConnectionSnapshot(params.viewerId);
    const where = await buildScopedWhere(params);

    if (where === null) {
      return {
        ...emptyResponse(params.page, params.pageSize),
        capabilities: buildCapabilities(googleStatus),
      };
    }

    const [total, rawStatusGrouped, modalidadeRows, entrevistas] = await prisma.$transaction([
      prisma.empresasVagasEntrevistas.count({ where }),
      prisma.empresasVagasEntrevistas.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      prisma.empresasVagasEntrevistas.findMany({
        where,
        select: { meetUrl: true },
      }),
      prisma.empresasVagasEntrevistas.findMany({
        where,
        orderBy: buildOrderBy(params.sortBy, params.sortDir),
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          candidato: {
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              UsuariosInformation: { select: usuarioInformacoesSelect },
              UsuariosEnderecos: {
                orderBy: { criadoEm: 'asc' },
                select: {
                  id: true,
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                },
              },
            },
          },
          EmpresasVagas: {
            select: {
              id: true,
              codigo: true,
              titulo: true,
              status: true,
              modoAnonimo: true,
            },
          },
          empresa: {
            select: {
              id: true,
              nomeCompleto: true,
              UsuariosInformation: { select: usuarioInformacoesSelect },
            },
          },
          recrutador: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              googleCalendarId: true,
              UsuariosInformation: { select: usuarioInformacoesSelect },
            },
          },
        },
      }),
    ]);

    const statusGrouped = rawStatusGrouped.map((item) => ({
      status: item.status,
      count: typeof item._count === 'object' && item._count !== null ? (item._count._all ?? 0) : 0,
    }));

    if (entrevistas.length === 0) {
      return {
        items: [],
        pagination: paginationFromTotal(params.page, params.pageSize, total),
        summary: buildStatusSummary(statusGrouped),
        filtrosDisponiveis: {
          statusEntrevista: statusFiltersFromGroup(statusGrouped),
          modalidades: modalidadeFiltersFromRows(modalidadeRows),
        },
        capabilities: buildCapabilities(googleStatus),
      };
    }

    const candidaturas = await prisma.empresasCandidatos.findMany({
      where: {
        OR: entrevistas.map((entrevista) => ({
          vagaId: entrevista.vagaId,
          candidatoId: entrevista.candidatoId,
          empresaUsuarioId: entrevista.empresaUsuarioId,
        })),
      },
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        empresaUsuarioId: true,
      },
    });

    const candidaturaByKey = new Map<string, string>();
    for (const candidatura of candidaturas) {
      const key = `${candidatura.vagaId}:${candidatura.candidatoId}:${candidatura.empresaUsuarioId}`;
      if (!candidaturaByKey.has(key)) {
        candidaturaByKey.set(key, candidatura.id);
      }
    }

    const items = entrevistas.map((entrevista) => {
      const candidato =
        attachEnderecoResumo(mergeUsuarioInformacoes(entrevista.candidato)) ??
        attachEnderecoResumo(
          mergeUsuarioInformacoes({
            ...entrevista.candidato,
            UsuariosEnderecos: [],
          }),
        )!;
      const empresa = mergeUsuarioInformacoes(entrevista.empresa);
      const recrutador = mergeUsuarioInformacoes(entrevista.recrutador);
      const channel = parseInterviewChannel(entrevista.meetUrl);
      const agenda = buildInterviewAgendaPayload({
        entrevistaId: entrevista.id,
        modalidade: channel.modalidade,
        meetEventId: entrevista.meetEventId,
        meetUrl: channel.meetUrl,
        organizerSource:
          entrevista.meetEventId && entrevista.recrutador.googleCalendarId
            ? 'USER_OAUTH'
            : 'SYSTEM',
        organizerUserId:
          entrevista.meetEventId && entrevista.recrutador.googleCalendarId ? recrutador.id : null,
        organizerEmail:
          entrevista.meetEventId && entrevista.recrutador.googleCalendarId
            ? recrutador.email
            : null,
      });
      const candidaturaId =
        candidaturaByKey.get(
          `${entrevista.vagaId}:${entrevista.candidatoId}:${entrevista.empresaUsuarioId}`,
        ) ?? null;

      return {
        id: entrevista.id,
        candidaturaId,
        statusEntrevista: entrevista.status,
        statusEntrevistaLabel: getInterviewStatusLabel(entrevista.status),
        modalidade: channel.modalidade,
        modalidadeLabel: channel.modalidadeLabel,
        agendadaPara: entrevista.dataInicio.toISOString(),
        agendadaParaFormatada: formatInterviewDateTime(entrevista.dataInicio),
        dataInicio: entrevista.dataInicio.toISOString(),
        dataFim: entrevista.dataFim.toISOString(),
        descricao: entrevista.descricao ?? null,
        meetUrl: channel.meetUrl,
        local: channel.local,
        enderecoPresencial: channel.enderecoPresencial,
        agenda,
        candidato: {
          id: candidato.id,
          codigo: candidato.codUsuario,
          nome: candidato.nomeCompleto,
          email: candidato.email,
          cpf: candidato.cpf ?? null,
          telefone: candidato.telefone ?? null,
          avatarUrl: candidato.avatarUrl ?? null,
          cidade: candidato.cidade ?? null,
          estado: candidato.estado ?? null,
        },
        vaga: {
          id: entrevista.EmpresasVagas.id,
          codigo: entrevista.EmpresasVagas.codigo,
          titulo: entrevista.EmpresasVagas.titulo,
          status: entrevista.EmpresasVagas.status,
        },
        empresa: {
          id: empresa.id,
          nomeExibicao: empresa.nomeCompleto,
          anonima: Boolean(entrevista.EmpresasVagas.modoAnonimo),
          labelExibicao: entrevista.EmpresasVagas.modoAnonimo
            ? 'Empresa anônima'
            : (empresa.nomeCompleto ?? 'Empresa não informada'),
          logoUrl: entrevista.EmpresasVagas.modoAnonimo ? null : (empresa.avatarUrl ?? null),
        },
        recrutador: {
          id: recrutador.id,
          nome: recrutador.nomeCompleto,
          email: recrutador.email,
          avatarUrl: recrutador.avatarUrl ?? null,
        },
        meta: {
          origem: entrevista.meetEventId ? 'GOOGLE_MEET' : 'SISTEMA',
          calendarEventId: entrevista.meetEventId ?? null,
          observacoesInternas: null,
        },
        criadoEm: entrevista.criadoEm.toISOString(),
        atualizadoEm: entrevista.atualizadoEm.toISOString(),
      };
    });

    return {
      items,
      pagination: paginationFromTotal(params.page, params.pageSize, total),
      summary: buildStatusSummary(statusGrouped),
      filtrosDisponiveis: {
        statusEntrevista: statusFiltersFromGroup(statusGrouped),
        modalidades: modalidadeFiltersFromRows(modalidadeRows),
      },
      capabilities: buildCapabilities(googleStatus),
    };
  },
};

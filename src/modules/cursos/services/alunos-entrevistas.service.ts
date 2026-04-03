import { EntrevistaStatus, Prisma, Roles } from '@prisma/client';

import { prisma, retryOperation } from '@/config/prisma';
import { googleOAuthService } from '@/modules/cursos/aulas/services/google-oauth.service';
import { entrevistasManageService } from '@/modules/entrevistas/services/manage.service';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import {
  ACTIVE_INTERVIEW_STATUSES,
  buildInterviewAgendaPayload,
  formatInterviewDateTime,
  getInterviewStatusLabel,
  getVagaStatusLabel,
  humanizeStatusProcesso,
  normalizeInterviewEndereco,
  parseInterviewChannel,
  TERMINAL_CANDIDATURA_STATUS_NAMES,
} from '@/modules/entrevistas/utils/presentation';

import type { AlunoCriarEntrevistaInput, AlunoEntrevistasQuery } from '../validators/alunos.schema';

const DB_STATUS_VALUES = new Set<EntrevistaStatus>([
  EntrevistaStatus.AGENDADA,
  EntrevistaStatus.CANCELADA,
]);

const paginationFromTotal = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

const buildModalidadeCondition = (
  modalidade: AlunoEntrevistasQuery['modalidades'][number],
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

const buildOrderBy = (
  sortBy: AlunoEntrevistasQuery['sortBy'],
  sortDir: AlunoEntrevistasQuery['sortDir'],
): Prisma.EmpresasVagasEntrevistasOrderByWithRelationInput => {
  switch (sortBy) {
    case 'criadoEm':
      return { criadoEm: sortDir };
    case 'statusEntrevista':
      return { status: sortDir };
    case 'vagaTitulo':
      return { EmpresasVagas: { titulo: sortDir } };
    case 'empresaNome':
      return { empresa: { nomeCompleto: sortDir } };
    case 'agendadaPara':
    default:
      return { dataInicio: sortDir };
  }
};

const buildCompanyPayload = (params: {
  empresaId: string;
  empresaNome: string | null;
  modoAnonimo: boolean;
}) => {
  if (params.modoAnonimo) {
    return {
      id: params.empresaId,
      nomeExibicao: null,
      anonima: true,
      labelExibicao: 'Empresa anônima',
    };
  }

  const labelExibicao = params.empresaNome ?? 'Empresa não informada';

  return {
    id: params.empresaId,
    nomeExibicao: params.empresaNome,
    anonima: false,
    labelExibicao,
  };
};

const mapEnderecoPadraoEntrevista = (usuario: Record<string, any>) => {
  const withEndereco = attachEnderecoResumo(usuario);
  const enderecoPrincipal = withEndereco?.enderecoPrincipal;

  return normalizeInterviewEndereco({
    cep: enderecoPrincipal?.cep ?? null,
    logradouro: enderecoPrincipal?.logradouro ?? null,
    numero: enderecoPrincipal?.numero ?? null,
    complemento: (enderecoPrincipal as any)?.complemento ?? null,
    bairro: enderecoPrincipal?.bairro ?? null,
    cidade: enderecoPrincipal?.cidade ?? null,
    estado: enderecoPrincipal?.estado ?? null,
    pontoReferencia: null,
  });
};

export class AlunoNotFoundError extends Error {
  code = 'ALUNO_NOT_FOUND' as const;
}

const CREATOR_ROLES = new Set<Roles>([Roles.ADMIN, Roles.MODERADOR, Roles.RECRUTADOR]);

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

const forbiddenError = (message: string) =>
  Object.assign(new Error(message), {
    status: 403 as const,
    code: 'INSUFFICIENT_PERMISSIONS',
  });

const validationError = (code: string, message: string) =>
  Object.assign(new Error(message), {
    status: 400 as const,
    code,
  });

const getAllowedVagaIds = async (viewerId: string, viewerRole: Roles) => {
  if (viewerRole !== Roles.RECRUTADOR) {
    return null;
  }

  return recrutadorVagasService.listVagaIds(viewerId);
};

const ensureAlunoExists = async (alunoId: string) => {
  const aluno = await retryOperation(
    () =>
      prisma.usuarios.findFirst({
        where: {
          id: alunoId,
          role: Roles.ALUNO_CANDIDATO,
        },
        select: {
          id: true,
          codUsuario: true,
          nomeCompleto: true,
        },
      }),
    3,
    400,
    6000,
  );

  if (!aluno) {
    throw new AlunoNotFoundError('Aluno não encontrado');
  }

  return aluno;
};

const assertAlunoAccess = async (params: {
  alunoId: string;
  viewerId: string;
  viewerRole: Roles;
}) => {
  if (params.viewerRole === Roles.ALUNO_CANDIDATO && params.viewerId !== params.alunoId) {
    throw forbiddenError('Sem permissão para acessar dados de outro aluno.');
  }

  if (params.viewerRole !== Roles.RECRUTADOR) {
    return null;
  }

  const allowedVagaIds = await getAllowedVagaIds(params.viewerId, params.viewerRole);

  if (!allowedVagaIds || allowedVagaIds.length === 0) {
    throw forbiddenError('Sem permissão para acessar dados deste aluno.');
  }

  const scopedCandidatura = await retryOperation(
    () =>
      prisma.empresasCandidatos.findFirst({
        where: {
          candidatoId: params.alunoId,
          vagaId: { in: allowedVagaIds },
        },
        select: { id: true },
      }),
    3,
    400,
    6000,
  );

  if (!scopedCandidatura) {
    throw forbiddenError('Sem permissão para acessar dados deste aluno.');
  }

  return allowedVagaIds;
};

const buildInterviewWhere = async (params: {
  alunoId: string;
  viewerId: string;
  viewerRole: Roles;
  filters: AlunoEntrevistasQuery;
}) => {
  const allowedVagaIds = await assertAlunoAccess({
    alunoId: params.alunoId,
    viewerId: params.viewerId,
    viewerRole: params.viewerRole,
  });

  const and: Prisma.EmpresasVagasEntrevistasWhereInput[] = [{ candidatoId: params.alunoId }];

  if (allowedVagaIds && allowedVagaIds.length > 0) {
    and.push({ vagaId: { in: allowedVagaIds } });
  }

  if (params.filters.statusEntrevista.length > 0) {
    const dbStatuses = params.filters.statusEntrevista.filter((value): value is EntrevistaStatus =>
      DB_STATUS_VALUES.has(value as EntrevistaStatus),
    );

    if (dbStatuses.length === 0) {
      return {
        allowedVagaIds,
        empty: true,
        where: null,
      };
    }

    and.push({ status: { in: dbStatuses } });
  }

  if (params.filters.modalidades.length > 0) {
    const modalidadeConditions = params.filters.modalidades
      .map((modalidade) => buildModalidadeCondition(modalidade))
      .filter((condition): condition is Prisma.EmpresasVagasEntrevistasWhereInput =>
        Boolean(condition),
      );

    if (modalidadeConditions.length === 0) {
      return {
        allowedVagaIds,
        empty: true,
        where: null,
      };
    }

    and.push({ OR: modalidadeConditions });
  }

  if (params.filters.dataInicio || params.filters.dataFim) {
    and.push({
      dataInicio: {
        ...(params.filters.dataInicio ? { gte: new Date(params.filters.dataInicio) } : {}),
        ...(params.filters.dataFim ? { lte: new Date(params.filters.dataFim) } : {}),
      },
    });
  }

  return {
    allowedVagaIds,
    empty: false,
    where: { AND: and },
  };
};

export const alunosEntrevistasService = {
  async list(params: {
    alunoId: string;
    viewerId: string;
    viewerRole: Roles;
    filters: AlunoEntrevistasQuery;
  }) {
    await ensureAlunoExists(params.alunoId);

    const scoped = await buildInterviewWhere(params);

    if (scoped.empty || !scoped.where) {
      return {
        items: [],
        pagination: paginationFromTotal(params.filters.page, params.filters.pageSize, 0),
      };
    }

    const [total, entrevistas] = await retryOperation(
      () =>
        prisma.$transaction([
          prisma.empresasVagasEntrevistas.count({ where: scoped.where }),
          prisma.empresasVagasEntrevistas.findMany({
            where: scoped.where,
            orderBy: buildOrderBy(params.filters.sortBy, params.filters.sortDir),
            skip: (params.filters.page - 1) * params.filters.pageSize,
            take: params.filters.pageSize,
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
        ]),
      3,
      400,
      6000,
    );

    if (entrevistas.length === 0) {
      return {
        items: [],
        pagination: paginationFromTotal(params.filters.page, params.filters.pageSize, total),
      };
    }

    const candidaturas = await retryOperation(
      () =>
        prisma.empresasCandidatos.findMany({
          where: {
            candidatoId: params.alunoId,
            OR: entrevistas.map((entrevista) => ({
              vagaId: entrevista.vagaId,
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
        }),
      3,
      400,
      6000,
    );

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
        empresa: buildCompanyPayload({
          empresaId: empresa.id,
          empresaNome: empresa.nomeCompleto,
          modoAnonimo: entrevista.EmpresasVagas.modoAnonimo,
        }),
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
      pagination: paginationFromTotal(params.filters.page, params.filters.pageSize, total),
    };
  },

  async listCreateOptions(params: { alunoId: string; viewerId: string; viewerRole: Roles }) {
    if (!CREATOR_ROLES.has(params.viewerRole)) {
      throw forbiddenError('Sem permissão para criar entrevista para este aluno.');
    }

    const aluno = await ensureAlunoExists(params.alunoId);
    const allowedVagaIds = await assertAlunoAccess(params);
    const googleStatus = await googleOAuthService.getConnectionSnapshot(params.viewerId);

    const candidaturas = await retryOperation(
      () =>
        prisma.empresasCandidatos.findMany({
          where: {
            candidatoId: params.alunoId,
            ...(allowedVagaIds ? { vagaId: { in: allowedVagaIds } } : {}),
            status_processo: {
              nome: {
                notIn: [...TERMINAL_CANDIDATURA_STATUS_NAMES],
              },
            },
          },
          orderBy: [{ atualizadaEm: 'desc' }, { aplicadaEm: 'desc' }],
          select: {
            id: true,
            vagaId: true,
            candidatoId: true,
            empresaUsuarioId: true,
            status_processo: {
              select: {
                nome: true,
              },
            },
            Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios: {
              select: {
                id: true,
                nomeCompleto: true,
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
          },
        }),
      3,
      400,
      6000,
    );

    if (candidaturas.length === 0) {
      return {
        ...buildCapabilities(googleStatus),
        items: [],
      };
    }

    const activeInterviewMap = new Map(
      (
        await retryOperation(
          () =>
            prisma.empresasVagasEntrevistas.findMany({
              where: {
                candidatoId: params.alunoId,
                vagaId: { in: candidaturas.map((item) => item.vagaId) },
                empresaUsuarioId: { in: candidaturas.map((item) => item.empresaUsuarioId) },
                status: { in: ACTIVE_INTERVIEW_STATUSES },
              },
              select: {
                id: true,
                vagaId: true,
                candidatoId: true,
                empresaUsuarioId: true,
              },
            }),
          3,
          400,
          6000,
        )
      ).map((item) => [`${item.vagaId}:${item.candidatoId}:${item.empresaUsuarioId}`, item.id]),
    );

    return {
      ...buildCapabilities(googleStatus),
      items: candidaturas.map((candidatura) => {
        const interviewKey = `${candidatura.vagaId}:${candidatura.candidatoId}:${candidatura.empresaUsuarioId}`;
        const empresa =
          attachEnderecoResumo(
            mergeUsuarioInformacoes(
              candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios,
            ),
          ) ??
          attachEnderecoResumo(
            mergeUsuarioInformacoes({
              ...candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios,
              UsuariosEnderecos: [],
            }),
          )!;
        const entrevistaAtivaId = activeInterviewMap.get(interviewKey) ?? null;
        const empresaPayload = buildCompanyPayload({
          empresaId: empresa.id,
          empresaNome: empresa.nomeCompleto,
          modoAnonimo: candidatura.EmpresasVagas.modoAnonimo,
        });

        return {
          candidaturaId: candidatura.id,
          empresa: empresaPayload,
          vaga: {
            id: candidatura.EmpresasVagas.id,
            codigo: candidatura.EmpresasVagas.codigo,
            titulo: candidatura.EmpresasVagas.titulo,
            status: candidatura.EmpresasVagas.status,
            statusLabel: getVagaStatusLabel(candidatura.EmpresasVagas.status),
          },
          candidato: {
            id: aluno.id,
            codigo: aluno.codUsuario,
            nome: aluno.nomeCompleto,
          },
          statusCandidatura: candidatura.status_processo.nome,
          statusCandidaturaLabel: humanizeStatusProcesso(candidatura.status_processo.nome),
          entrevistaAtiva: Boolean(entrevistaAtivaId),
          entrevistaAtivaId,
          empresaAnonima: candidatura.EmpresasVagas.modoAnonimo,
          anonimatoBloqueado: true,
          enderecoPadraoEntrevista: mapEnderecoPadraoEntrevista(empresa),
        };
      }),
    };
  },

  async createForAluno(params: {
    alunoId: string;
    viewerId: string;
    viewerRole: Roles;
    payload: AlunoCriarEntrevistaInput;
    expectedEmpresaUsuarioId?: string;
    expectedVagaId?: string;
  }) {
    if (!CREATOR_ROLES.has(params.viewerRole)) {
      throw forbiddenError('Sem permissão para criar entrevista para este aluno.');
    }

    await ensureAlunoExists(params.alunoId);
    const allowedVagaIds = await assertAlunoAccess(params);

    const candidatura = await retryOperation(
      () =>
        prisma.empresasCandidatos.findUnique({
          where: { id: params.payload.candidaturaId },
          select: {
            id: true,
            candidatoId: true,
            vagaId: true,
            empresaUsuarioId: true,
            EmpresasVagas: {
              select: {
                id: true,
                modoAnonimo: true,
              },
            },
          },
        }),
      3,
      400,
      6000,
    );

    if (!candidatura) {
      throw Object.assign(new Error('Candidatura não encontrada.'), {
        status: 404 as const,
        code: 'CANDIDATURA_NOT_FOUND',
      });
    }

    if (candidatura.candidatoId !== params.alunoId) {
      throw validationError(
        'INTERVIEW_INVALID_PAYLOAD',
        'A candidatura informada não pertence ao aluno selecionado.',
      );
    }

    if (params.expectedVagaId && params.expectedVagaId !== candidatura.vagaId) {
      throw Object.assign(
        new Error('A vaga informada não corresponde à candidatura selecionada.'),
        {
          status: 409 as const,
          code: 'RECRUITER_SCOPE_CONFLICT',
        },
      );
    }

    if (
      params.expectedEmpresaUsuarioId &&
      params.expectedEmpresaUsuarioId !== candidatura.empresaUsuarioId
    ) {
      throw Object.assign(
        new Error('A empresa informada não corresponde à candidatura selecionada.'),
        {
          status: 409 as const,
          code: 'RECRUITER_SCOPE_CONFLICT',
        },
      );
    }

    if (allowedVagaIds && !allowedVagaIds.includes(candidatura.vagaId)) {
      throw forbiddenError('Sem permissão para criar entrevista para este aluno.');
    }

    const effectiveAnonimato = candidatura.EmpresasVagas.modoAnonimo;
    if (
      typeof params.payload.empresaAnonima === 'boolean' &&
      params.payload.empresaAnonima !== effectiveAnonimato
    ) {
      throw validationError(
        'INTERVIEW_INVALID_PAYLOAD',
        'empresaAnonima deve respeitar o anonimato configurado na vaga.',
      );
    }

    const result = await entrevistasManageService.create({
      viewerId: params.viewerId,
      viewerRole: params.viewerRole,
      empresaUsuarioId: candidatura.empresaUsuarioId,
      vagaId: candidatura.vagaId,
      candidaturaId: candidatura.id,
      candidatoId: params.alunoId,
      modalidade: params.payload.modalidade,
      dataInicio: params.payload.dataInicio,
      dataFim: params.payload.dataFim,
      descricao: params.payload.descricao,
      enderecoPresencial: params.payload.enderecoPresencial,
      gerarMeet: params.payload.gerarMeet,
    });

    return {
      ...result,
      empresa: buildCompanyPayload({
        empresaId: result.empresa.id,
        empresaNome: result.empresa.nomeExibicao ?? null,
        modoAnonimo: effectiveAnonimato,
      }),
    };
  },
};

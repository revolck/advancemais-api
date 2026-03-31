import { EntrevistaStatus, Roles, StatusDeVagas, type Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { prisma } from '@/config/prisma';
import { googleCalendarService } from '@/modules/cursos/aulas/services/google-calendar.service';
import { googleOAuthService } from '@/modules/cursos/aulas/services/google-oauth.service';
import { notificacoesHelper } from '@/modules/cursos/aulas/services/notificacoes-helper.service';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { logger } from '@/utils/logger';

import {
  ACTIVE_INTERVIEW_STATUSES,
  buildInterviewAgendaPayload,
  encodeInterviewChannel,
  formatInterviewDateTime,
  getInterviewStatusLabel,
  getVagaStatusLabel,
  humanizeStatusProcesso,
  isValidGoogleMeetUrl,
  normalizeInterviewEndereco,
  parseInterviewChannel,
  TERMINAL_CANDIDATURA_STATUS_NAMES,
} from '../utils/presentation';
import type {
  CreateEntrevistaInput,
  EntrevistasOpcoesCandidatosQuery,
  EntrevistasOpcoesVagasQuery,
} from '../validators/overview.schema';

const GLOBAL_ROLES = new Set<Roles>([Roles.ADMIN, Roles.MODERADOR, Roles.SETOR_DE_VAGAS]);
const entrevistasManageLogger = logger.child({ module: 'EntrevistasManageService' });

class EntrevistasManageForbiddenError extends Error {
  status = 403 as const;
  code = 'INSUFFICIENT_PERMISSIONS' as const;
}

const notFoundError = (code: string, message: string) =>
  Object.assign(new Error(message), {
    status: 404 as const,
    code,
  });

const conflictError = (code: string, message: string) =>
  Object.assign(new Error(message), {
    status: 409 as const,
    code,
  });

const validationError = (code: string, message: string) =>
  Object.assign(new Error(message), {
    status: 400 as const,
    code,
  });

const buildInterviewKey = (vagaId: string, candidatoId: string, empresaUsuarioId: string) =>
  `${vagaId}:${candidatoId}:${empresaUsuarioId}`;

const eligibleCandidaturasWhere: Prisma.EmpresasCandidatosWhereInput = {
  status_processo: {
    nome: {
      notIn: [...TERMINAL_CANDIDATURA_STATUS_NAMES],
    },
  },
};

const resolveScopedEmpresaIds = async (viewerId: string, viewerRole: Roles) => {
  if (GLOBAL_ROLES.has(viewerRole)) {
    return null;
  }

  if (viewerRole === Roles.EMPRESA) {
    return [viewerId];
  }

  if (viewerRole === Roles.RECRUTADOR) {
    return recrutadorEmpresasService.listEmpresaUsuarioIds(viewerId);
  }

  throw new EntrevistasManageForbiddenError('Sem permissão para criar entrevistas.');
};

const assertEmpresaAccess = async (
  viewerId: string,
  viewerRole: Roles,
  empresaUsuarioId: string,
) => {
  if (GLOBAL_ROLES.has(viewerRole)) {
    return;
  }

  if (viewerRole === Roles.EMPRESA) {
    if (viewerId !== empresaUsuarioId) {
      throw new EntrevistasManageForbiddenError(
        'Sem permissão para criar entrevistas para esta empresa.',
      );
    }
    return;
  }

  if (viewerRole === Roles.RECRUTADOR) {
    try {
      await recrutadorEmpresasService.assertVinculo(viewerId, empresaUsuarioId);
      return;
    } catch {
      throw new EntrevistasManageForbiddenError(
        'Sem permissão para criar entrevistas para esta empresa.',
      );
    }
  }

  throw new EntrevistasManageForbiddenError('Sem permissão para criar entrevistas.');
};

const assertVagaAccess = async (viewerId: string, viewerRole: Roles, vagaId: string) => {
  if (GLOBAL_ROLES.has(viewerRole)) {
    return;
  }

  if (viewerRole === Roles.EMPRESA) {
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: vagaId },
      select: { usuarioId: true },
    });

    if (!vaga || vaga.usuarioId !== viewerId) {
      throw new EntrevistasManageForbiddenError(
        'Sem permissão para criar entrevistas para esta vaga.',
      );
    }

    return;
  }

  if (viewerRole === Roles.RECRUTADOR) {
    try {
      await recrutadorVagasService.assertVinculo(viewerId, vagaId);
      return;
    } catch {
      throw new EntrevistasManageForbiddenError(
        'Sem permissão para criar entrevistas para esta vaga.',
      );
    }
  }

  throw new EntrevistasManageForbiddenError('Sem permissão para criar entrevistas.');
};

const mapCandidatePreview = (candidate: {
  id: string;
  codUsuario: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  UsuariosInformation: Prisma.UsuariosInformationGetPayload<{
    select: typeof usuarioInformacoesSelect;
  }> | null;
  UsuariosEnderecos: {
    id: string;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
  }[];
}) => {
  const merged =
    attachEnderecoResumo(mergeUsuarioInformacoes(candidate)) ??
    attachEnderecoResumo(
      mergeUsuarioInformacoes({
        ...candidate,
        UsuariosEnderecos: [],
      }),
    )!;

  return {
    id: merged.id,
    codigo: merged.codUsuario,
    nome: merged.nomeCompleto,
    email: merged.email,
    cpf: merged.cpf ?? null,
    telefone: merged.telefone ?? null,
    avatarUrl: merged.avatarUrl ?? null,
    cidade: merged.cidade ?? null,
    estado: merged.estado ?? null,
  };
};

const getActiveInterviewMap = async (where: Prisma.EmpresasVagasEntrevistasWhereInput) => {
  const interviews = await prisma.empresasVagasEntrevistas.findMany({
    where: {
      ...where,
      status: {
        in: ACTIVE_INTERVIEW_STATUSES,
      },
    },
    select: {
      id: true,
      vagaId: true,
      candidatoId: true,
      empresaUsuarioId: true,
    },
  });

  return new Map(
    interviews.map((item) => [
      buildInterviewKey(item.vagaId, item.candidatoId, item.empresaUsuarioId),
      item.id,
    ]),
  );
};

const buildDefaultDescricao = (vagaTitulo: string, candidatoNome: string, modalidade: string) =>
  `Entrevista ${modalidade.toLowerCase()} agendada para a vaga "${vagaTitulo}" com ${candidatoNome}.`;

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

const notifyInterviewCreated = async (params: {
  entrevistaId: string;
  empresaUsuarioId: string;
  empresaNome: string;
  vagaId: string;
  vagaTitulo: string;
  candidaturaId: string;
  candidatoId: string;
  candidatoNome: string;
  recrutadorId: string;
  recrutadorNome: string;
  modalidade: string;
  modalidadeLabel: string;
  dataInicio: Date;
  dataFim: Date;
  meetUrl: string | null;
  agenda: Record<string, any> | null;
  enderecoPresencial: Record<string, any> | null;
}) => {
  const dataInicioIso = params.dataInicio.toISOString();
  const dataFimIso = params.dataFim.toISOString();
  const agendadaParaFormatada = formatInterviewDateTime(params.dataInicio);
  const sharedData = {
    entrevistaId: params.entrevistaId,
    empresaUsuarioId: params.empresaUsuarioId,
    vagaId: params.vagaId,
    candidaturaId: params.candidaturaId,
    candidatoId: params.candidatoId,
    recrutadorId: params.recrutadorId,
    modalidade: params.modalidade,
    dataInicio: dataInicioIso,
    dataFim: dataFimIso,
    meetUrl: params.meetUrl,
    agenda: params.agenda,
    enderecoPresencial: params.enderecoPresencial,
  };

  const notifications = [
    {
      label: 'candidato',
      usuarioId: params.candidatoId,
      titulo: 'Entrevista agendada',
      mensagem: `Sua entrevista ${params.modalidadeLabel.toLowerCase()} para a vaga "${params.vagaTitulo}" na empresa "${params.empresaNome}" foi agendada para ${agendadaParaFormatada}.`,
      eventoId: `entrevista-criada-candidato-${params.entrevistaId}`,
      dados: sharedData,
    },
    {
      label: 'empresa',
      usuarioId: params.empresaUsuarioId,
      titulo: 'Entrevista marcada',
      mensagem: `Uma entrevista ${params.modalidadeLabel.toLowerCase()} com ${params.candidatoNome} para a vaga "${params.vagaTitulo}" foi agendada para ${agendadaParaFormatada} por ${params.recrutadorNome}.`,
      eventoId: `entrevista-criada-empresa-${params.entrevistaId}`,
      dados: sharedData,
    },
  ] as const;

  const results = await Promise.allSettled(
    notifications.map((notification) =>
      notificacoesHelper.criar({
        usuarioId: notification.usuarioId,
        tipo: 'SISTEMA',
        titulo: notification.titulo,
        mensagem: notification.mensagem,
        prioridade: 'ALTA',
        dados: notification.dados,
        eventoId: notification.eventoId,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      return;
    }

    entrevistasManageLogger.error('[ENTREVISTA_CREATE_NOTIFICATION_ERROR]', {
      entrevistaId: params.entrevistaId,
      target: notifications[index]?.label,
      usuarioId: notifications[index]?.usuarioId,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });
};

export const entrevistasManageService = {
  async listEmpresas(params: { viewerId: string; viewerRole: Roles }) {
    const scopedEmpresaIds = await resolveScopedEmpresaIds(params.viewerId, params.viewerRole);

    if (scopedEmpresaIds && scopedEmpresaIds.length === 0) {
      return { items: [] };
    }

    const companies = await prisma.usuarios.findMany({
      where: {
        role: Roles.EMPRESA,
        ...(scopedEmpresaIds ? { id: { in: scopedEmpresaIds } } : {}),
      },
      orderBy: { nomeCompleto: 'asc' },
      select: {
        id: true,
        codUsuario: true,
        cnpj: true,
        email: true,
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
    });

    if (companies.length === 0) {
      return { items: [] };
    }

    const vagas = await prisma.empresasVagas.findMany({
      where: {
        usuarioId: { in: companies.map((company) => company.id) },
        status: { not: StatusDeVagas.RASCUNHO },
      },
      select: {
        id: true,
        usuarioId: true,
      },
    });

    if (vagas.length === 0) {
      return { items: [] };
    }

    const candidaturas = await prisma.empresasCandidatos.findMany({
      where: {
        ...eligibleCandidaturasWhere,
        vagaId: { in: vagas.map((vaga) => vaga.id) },
      },
      select: {
        vagaId: true,
        candidatoId: true,
        empresaUsuarioId: true,
      },
    });

    const activeInterviewMap = await getActiveInterviewMap({
      vagaId: { in: vagas.map((vaga) => vaga.id) },
    });

    const empresaByVagaId = new Map(vagas.map((vaga) => [vaga.id, vaga.usuarioId]));
    const vagasElegiveisPorEmpresa = new Map<string, Set<string>>();

    for (const candidatura of candidaturas) {
      const key = buildInterviewKey(
        candidatura.vagaId,
        candidatura.candidatoId,
        candidatura.empresaUsuarioId,
      );

      if (activeInterviewMap.has(key)) {
        continue;
      }

      const empresaUsuarioId = empresaByVagaId.get(candidatura.vagaId);
      if (!empresaUsuarioId) continue;

      if (!vagasElegiveisPorEmpresa.has(empresaUsuarioId)) {
        vagasElegiveisPorEmpresa.set(empresaUsuarioId, new Set());
      }

      vagasElegiveisPorEmpresa.get(empresaUsuarioId)!.add(candidatura.vagaId);
    }

    const items = companies
      .map((company) => {
        const companyInfo =
          attachEnderecoResumo(mergeUsuarioInformacoes(company)) ??
          attachEnderecoResumo(
            mergeUsuarioInformacoes({
              ...company,
              UsuariosEnderecos: [],
            }),
          )!;
        const totalVagasElegiveis = vagasElegiveisPorEmpresa.get(company.id)?.size ?? 0;

        return {
          id: company.id,
          nomeExibicao: company.nomeCompleto,
          codigo: company.codUsuario,
          cnpj: company.cnpj ?? null,
          email: company.email ?? null,
          logoUrl: companyInfo.avatarUrl ?? null,
          totalVagasElegiveis,
          enderecoPadraoEntrevista: mapEnderecoPadraoEntrevista(companyInfo),
        };
      })
      .filter((item) => item.totalVagasElegiveis > 0);

    return { items };
  },

  async listVagas(params: { viewerId: string; viewerRole: Roles } & EntrevistasOpcoesVagasQuery) {
    const empresa = await prisma.usuarios.findFirst({
      where: {
        id: params.empresaUsuarioId,
        role: Roles.EMPRESA,
      },
      select: {
        id: true,
      },
    });

    if (!empresa) {
      throw notFoundError('EMPRESA_NOT_FOUND', 'Empresa não encontrada.');
    }

    await assertEmpresaAccess(params.viewerId, params.viewerRole, params.empresaUsuarioId);

    let scopedVagaIds: string[] | null = null;
    if (params.viewerRole === Roles.RECRUTADOR) {
      scopedVagaIds = await recrutadorVagasService.listVagaIdsByEmpresa(
        params.viewerId,
        params.empresaUsuarioId,
      );

      if (scopedVagaIds.length === 0) {
        return { items: [] };
      }
    }

    const vagas = await prisma.empresasVagas.findMany({
      where: {
        usuarioId: params.empresaUsuarioId,
        status: { not: StatusDeVagas.RASCUNHO },
        ...(scopedVagaIds ? { id: { in: scopedVagaIds } } : {}),
      },
      orderBy: [{ status: 'asc' }, { titulo: 'asc' }],
      select: {
        id: true,
        codigo: true,
        titulo: true,
        status: true,
        usuarioId: true,
      },
    });

    if (vagas.length === 0) {
      return { items: [] };
    }

    const candidaturas = await prisma.empresasCandidatos.findMany({
      where: {
        ...eligibleCandidaturasWhere,
        vagaId: { in: vagas.map((vaga) => vaga.id) },
      },
      select: {
        vagaId: true,
        candidatoId: true,
        empresaUsuarioId: true,
      },
    });

    const activeInterviewMap = await getActiveInterviewMap({
      vagaId: { in: vagas.map((vaga) => vaga.id) },
      empresaUsuarioId: params.empresaUsuarioId,
    });

    const candidatosElegiveisPorVaga = new Map<string, number>();
    for (const candidatura of candidaturas) {
      const key = buildInterviewKey(
        candidatura.vagaId,
        candidatura.candidatoId,
        candidatura.empresaUsuarioId,
      );

      if (activeInterviewMap.has(key)) {
        continue;
      }

      candidatosElegiveisPorVaga.set(
        candidatura.vagaId,
        (candidatosElegiveisPorVaga.get(candidatura.vagaId) ?? 0) + 1,
      );
    }

    const items = vagas
      .map((vaga) => ({
        id: vaga.id,
        codigo: vaga.codigo,
        titulo: vaga.titulo,
        status: vaga.status,
        statusLabel: getVagaStatusLabel(vaga.status),
        empresaUsuarioId: vaga.usuarioId,
        candidatosElegiveis: candidatosElegiveisPorVaga.get(vaga.id) ?? 0,
      }))
      .filter((item) => item.candidatosElegiveis > 0);

    return { items };
  },

  async listCandidatos(
    params: { viewerId: string; viewerRole: Roles } & EntrevistasOpcoesCandidatosQuery,
  ) {
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: params.vagaId },
      select: {
        id: true,
        usuarioId: true,
      },
    });

    if (!vaga) {
      throw notFoundError('VAGA_NOT_FOUND', 'Vaga não encontrada.');
    }

    await assertEmpresaAccess(params.viewerId, params.viewerRole, vaga.usuarioId);
    await assertVagaAccess(params.viewerId, params.viewerRole, params.vagaId);

    const candidaturas = await prisma.empresasCandidatos.findMany({
      where: {
        ...eligibleCandidaturasWhere,
        vagaId: params.vagaId,
      },
      orderBy: [{ atualizadaEm: 'desc' }, { aplicadaEm: 'desc' }],
      select: {
        id: true,
        vagaId: true,
        candidatoId: true,
        empresaUsuarioId: true,
        atualizadaEm: true,
        status_processo: {
          select: {
            nome: true,
          },
        },
        Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
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
      },
    });

    if (candidaturas.length === 0) {
      return { items: [] };
    }

    const activeInterviewMap = await getActiveInterviewMap({
      vagaId: params.vagaId,
      empresaUsuarioId: vaga.usuarioId,
    });

    return {
      items: candidaturas.map((candidatura) => {
        const interviewKey = buildInterviewKey(
          candidatura.vagaId,
          candidatura.candidatoId,
          candidatura.empresaUsuarioId,
        );
        const entrevistaAtivaId = activeInterviewMap.get(interviewKey) ?? null;

        return {
          candidaturaId: candidatura.id,
          candidato: mapCandidatePreview(
            candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios,
          ),
          statusCandidatura: candidatura.status_processo.nome,
          statusCandidaturaLabel: humanizeStatusProcesso(candidatura.status_processo.nome),
          ultimaAtualizacaoEm: candidatura.atualizadaEm.toISOString(),
          entrevistaAtiva: Boolean(entrevistaAtivaId),
          entrevistaAtivaId,
        };
      }),
    };
  },

  async create(
    params: {
      viewerId: string;
      viewerRole: Roles;
    } & CreateEntrevistaInput,
  ) {
    const empresa = await prisma.usuarios.findFirst({
      where: {
        id: params.empresaUsuarioId,
        role: Roles.EMPRESA,
      },
      select: {
        id: true,
        nomeCompleto: true,
      },
    });

    if (!empresa) {
      throw notFoundError('EMPRESA_NOT_FOUND', 'Empresa não encontrada.');
    }

    await assertEmpresaAccess(params.viewerId, params.viewerRole, params.empresaUsuarioId);

    const vaga = await prisma.empresasVagas.findFirst({
      where: {
        id: params.vagaId,
        usuarioId: params.empresaUsuarioId,
      },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        status: true,
        usuarioId: true,
      },
    });

    if (!vaga) {
      throw notFoundError('VAGA_NOT_FOUND', 'Vaga não encontrada.');
    }

    await assertVagaAccess(params.viewerId, params.viewerRole, params.vagaId);

    const candidatura = await prisma.empresasCandidatos.findUnique({
      where: { id: params.candidaturaId },
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
        Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
          select: {
            id: true,
            codUsuario: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!candidatura) {
      throw notFoundError('CANDIDATURA_NOT_FOUND', 'Candidatura não encontrada.');
    }

    if (
      candidatura.vagaId !== params.vagaId ||
      candidatura.empresaUsuarioId !== params.empresaUsuarioId
    ) {
      throw validationError(
        'INTERVIEW_INVALID_PAYLOAD',
        'A candidatura informada não pertence à vaga e empresa selecionadas.',
      );
    }

    if (params.candidatoId && params.candidatoId !== candidatura.candidatoId) {
      throw validationError(
        'INTERVIEW_INVALID_PAYLOAD',
        'O candidato informado não corresponde à candidatura selecionada.',
      );
    }

    if (TERMINAL_CANDIDATURA_STATUS_NAMES.includes(candidatura.status_processo.nome as any)) {
      throw validationError(
        'INTERVIEW_INVALID_PAYLOAD',
        'A candidatura informada não está elegível para entrevista.',
      );
    }

    const existingInterview = await prisma.empresasVagasEntrevistas.findFirst({
      where: {
        vagaId: params.vagaId,
        candidatoId: candidatura.candidatoId,
        empresaUsuarioId: params.empresaUsuarioId,
        status: {
          in: ACTIVE_INTERVIEW_STATUSES,
        },
      },
      select: { id: true },
    });

    if (existingInterview) {
      throw conflictError(
        'INTERVIEW_ALREADY_EXISTS',
        'Já existe uma entrevista ativa para esta candidatura.',
      );
    }

    const responsavel = await prisma.usuarios.findUnique({
      where: { id: params.viewerId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
      },
    });

    if (!responsavel) {
      throw notFoundError('USER_NOT_FOUND', 'Usuário responsável não encontrado.');
    }

    const creatorGoogleStatus = await googleOAuthService.getConnectionSnapshot(params.viewerId);
    const dataInicio = new Date(params.dataInicio);
    const dataFim = new Date(params.dataFim);
    const descricao =
      params.descricao?.trim() ||
      buildDefaultDescricao(
        vaga.titulo,
        candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.nomeCompleto,
        params.modalidade,
      );
    const titulo = `Entrevista ${candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.nomeCompleto} - ${vaga.titulo}`;
    const enderecoPresencial =
      params.modalidade === 'PRESENCIAL'
        ? normalizeInterviewEndereco(params.enderecoPresencial)
        : null;
    const shouldGenerateMeet = params.modalidade === 'ONLINE' ? params.gerarMeet !== false : false;

    if (shouldGenerateMeet && !creatorGoogleStatus.conectado) {
      throw validationError(
        'INTERVIEW_GOOGLE_NOT_CONNECTED',
        'Para criar entrevista ONLINE, conecte sua conta Google primeiro.',
      );
    }

    const entrevistaId = randomUUID();
    let generatedMeet: { eventId: string; meetUrl: string } | null = null;

    if (shouldGenerateMeet) {
      try {
        generatedMeet = await googleCalendarService.createMeetEvent({
          titulo,
          descricao,
          dataInicio,
          dataFim,
          instrutorId: params.viewerId,
          alunoEmails: candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.email
            ? [candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.email]
            : [],
          requestId: entrevistaId,
          externalReferenceId: entrevistaId,
        });

        if (!isValidGoogleMeetUrl(generatedMeet.meetUrl)) {
          throw new Error('Google retornou uma URL inválida do Meet para a entrevista criada.');
        }
      } catch (error: any) {
        throw Object.assign(
          new Error(
            error instanceof Error
              ? error.message
              : 'Não foi possível criar a sala do Google Meet para a entrevista.',
          ),
          {
            status: 500 as const,
            code: 'INTERVIEW_MEET_CREATE_ERROR',
          },
        );
      }
    }

    const initialMeetUrl =
      generatedMeet?.meetUrl?.trim() ||
      encodeInterviewChannel({
        modalidade: params.modalidade,
        enderecoPresencial,
      });

    let entrevista;
    try {
      entrevista = await prisma.empresasVagasEntrevistas.create({
        data: {
          id: entrevistaId,
          vagaId: params.vagaId,
          candidatoId: candidatura.candidatoId,
          empresaUsuarioId: params.empresaUsuarioId,
          recrutadorId: params.viewerId,
          titulo,
          descricao,
          dataInicio,
          dataFim,
          meetUrl: initialMeetUrl,
          meetEventId: generatedMeet?.eventId ?? null,
          status: EntrevistaStatus.AGENDADA,
        },
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          descricao: true,
          meetUrl: true,
          meetEventId: true,
          criadoEm: true,
        },
      });
    } catch (error) {
      if (generatedMeet?.eventId) {
        try {
          await googleCalendarService.deleteEvent(generatedMeet.eventId, params.viewerId);
        } catch (cleanupError: any) {
          entrevistasManageLogger.warn('[ENTREVISTA_MEET_EVENT_CLEANUP_ERROR]', {
            entrevistaId,
            eventId: generatedMeet.eventId,
            viewerId: params.viewerId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }
      }

      throw error;
    }

    if (entrevista.meetEventId) {
      try {
        setImmediate(async () => {
          try {
            await googleCalendarService.sincronizarEntrevista({
              entrevistaId: entrevista.id,
              recrutadorId: params.viewerId,
              candidatoId: candidatura.candidatoId,
            });
          } catch {
            // não falhar criação por sincronização em background
          }
        });
      } catch {
        // setImmediate não deve falhar a criação
      }
    }

    const channel = parseInterviewChannel(entrevista.meetUrl);
    const agenda = buildInterviewAgendaPayload({
      entrevistaId: entrevista.id,
      modalidade: channel.modalidade,
      meetEventId: entrevista.meetEventId,
      meetUrl: channel.meetUrl,
      organizerSource: entrevista.meetEventId ? 'USER_OAUTH' : 'SYSTEM',
      organizerUserId: entrevista.meetEventId ? responsavel.id : null,
      organizerEmail: entrevista.meetEventId ? (responsavel.email ?? null) : null,
    });

    await notifyInterviewCreated({
      entrevistaId: entrevista.id,
      empresaUsuarioId: empresa.id,
      empresaNome: empresa.nomeCompleto,
      vagaId: vaga.id,
      vagaTitulo: vaga.titulo,
      candidaturaId: candidatura.id,
      candidatoId: candidatura.candidatoId,
      candidatoNome: candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.nomeCompleto,
      recrutadorId: responsavel.id,
      recrutadorNome: responsavel.nomeCompleto,
      modalidade: channel.modalidade,
      modalidadeLabel: channel.modalidadeLabel,
      dataInicio,
      dataFim,
      meetUrl: channel.meetUrl,
      agenda,
      enderecoPresencial: channel.enderecoPresencial,
    });

    return {
      id: entrevista.id,
      candidaturaId: candidatura.id,
      statusEntrevista: EntrevistaStatus.AGENDADA,
      statusEntrevistaLabel: getInterviewStatusLabel(EntrevistaStatus.AGENDADA),
      modalidade: channel.modalidade,
      modalidadeLabel: channel.modalidadeLabel,
      dataInicio: entrevista.dataInicio.toISOString(),
      dataFim: entrevista.dataFim.toISOString(),
      agendadaPara: entrevista.dataInicio.toISOString(),
      agendadaParaFormatada: formatInterviewDateTime(entrevista.dataInicio),
      descricao: entrevista.descricao ?? null,
      meetUrl: channel.meetUrl,
      local: channel.local,
      enderecoPresencial: channel.enderecoPresencial,
      agenda,
      candidato: {
        id: candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.id,
        nome: candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.nomeCompleto,
        codigo: candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios.codUsuario,
      },
      vaga: {
        id: vaga.id,
        titulo: vaga.titulo,
        codigo: vaga.codigo,
      },
      empresa: {
        id: empresa.id,
        nomeExibicao: empresa.nomeCompleto,
      },
      recrutador: {
        id: responsavel.id,
        nome: responsavel.nomeCompleto,
      },
      criadoEm: entrevista.criadoEm.toISOString(),
    };
  },
};

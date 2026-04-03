import { Prisma, Roles, StatusDeVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  curriculoSelect,
  mapCurriculo,
} from '@/modules/candidatos/candidaturas/utils/candidatos-overview-mapper';
import { recrutadorEmpresasService } from '@/modules/usuarios/services/recrutador-empresas.service';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

import type { RecrutadorCandidatosListQuery } from '../validators/candidatos.schema';

export class RecrutadorCandidatoNotFoundError extends Error {
  status = 404 as const;
  code = 'CANDIDATO_NOT_FOUND' as const;
}

export class RecrutadorCandidatoForbiddenError extends Error {
  status = 403 as const;
  code = 'FORBIDDEN' as const;
}

export class RecrutadorVagaNotFoundError extends Error {
  status = 404 as const;
  code = 'VAGA_NOT_FOUND' as const;
}

export class RecrutadorCurriculoNotFoundError extends Error {
  status = 404 as const;
  code = 'CURRICULO_NOT_FOUND' as const;
}

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

const buildSearchWhere = (search?: string): Prisma.UsuariosWhereInput | undefined => {
  if (!search) return undefined;

  return {
    OR: [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search, mode: 'insensitive' } },
      { codUsuario: { contains: search, mode: 'insensitive' } },
    ],
  } satisfies Prisma.UsuariosWhereInput;
};

const candidaturaCurriculoResumoSelect = {
  id: true,
  titulo: true,
  principal: true,
  ultimaAtualizacao: true,
} satisfies Prisma.UsuariosCurriculosSelect;

const candidateListSelect = (scopeWhere: Prisma.EmpresasCandidatosWhereInput) =>
  ({
    id: true,
    nomeCompleto: true,
    cpf: true,
    codUsuario: true,
    email: true,
    criadoEm: true,
    atualizadoEm: true,
    UsuariosInformation: {
      select: {
        telefone: true,
        avatarUrl: true,
      },
    },
    UsuariosEnderecos: {
      orderBy: { criadoEm: 'asc' },
      take: 1,
      select: {
        cidade: true,
        estado: true,
      },
    },
    _count: {
      select: {
        UsuariosCurriculos: true,
      },
    },
    EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios: {
      where: scopeWhere,
      select: {
        empresaUsuarioId: true,
        vagaId: true,
      },
    },
  }) satisfies Prisma.UsuariosSelect;

const candidateDetailSelect = (scopeWhere: Prisma.EmpresasCandidatosWhereInput) =>
  ({
    id: true,
    nomeCompleto: true,
    cpf: true,
    codUsuario: true,
    email: true,
    UsuariosInformation: {
      select: {
        telefone: true,
        avatarUrl: true,
      },
    },
    UsuariosEnderecos: {
      orderBy: { criadoEm: 'asc' },
      take: 1,
      select: {
        cidade: true,
        estado: true,
      },
    },
    _count: {
      select: {
        UsuariosCurriculos: true,
      },
    },
    EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios: {
      where: scopeWhere,
      orderBy: { aplicadaEm: 'desc' },
      select: {
        id: true,
        empresaUsuarioId: true,
        curriculoId: true,
        status_processo: {
          select: {
            id: true,
            nome: true,
          },
        },
        EmpresasVagas: {
          select: {
            id: true,
            titulo: true,
            codigo: true,
            status: true,
          },
        },
        Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            codUsuario: true,
          },
        },
        UsuariosCurriculos: {
          select: candidaturaCurriculoResumoSelect,
        },
      },
    },
  }) satisfies Prisma.UsuariosSelect;

type CandidateListRecord = Prisma.UsuariosGetPayload<{
  select: ReturnType<typeof candidateListSelect>;
}>;

type CandidateDetailRecord = Prisma.UsuariosGetPayload<{
  select: ReturnType<typeof candidateDetailSelect>;
}>;

type CurriculoCompletoRecord = Prisma.UsuariosCurriculosGetPayload<{
  select: typeof curriculoSelect;
}>;

const mapCandidateListItem = (candidate: CandidateListRecord) => {
  const empresaIds = Array.from(
    new Set(
      candidate.EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios.map(
        (candidatura) => candidatura.empresaUsuarioId,
      ),
    ),
  );

  const vagaIds = Array.from(
    new Set(
      candidate.EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios.map(
        (candidatura) => candidatura.vagaId,
      ),
    ),
  );

  return {
    id: candidate.id,
    nomeCompleto: candidate.nomeCompleto,
    cpf: candidate.cpf ?? null,
    codUsuario: candidate.codUsuario,
    email: candidate.email,
    telefone: candidate.UsuariosInformation?.telefone ?? null,
    avatarUrl: candidate.UsuariosInformation?.avatarUrl ?? null,
    cidade: candidate.UsuariosEnderecos[0]?.cidade ?? null,
    estado: candidate.UsuariosEnderecos[0]?.estado ?? null,
    curriculos: candidate._count.UsuariosCurriculos,
    criadoEm: candidate.criadoEm,
    atualizadoEm: candidate.atualizadoEm,
    candidaturasResumo: {
      total: candidate.EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios.length,
      empresaIds,
      vagaIds,
    },
  };
};

const mapCandidateDetail = (candidate: CandidateDetailRecord, directEmpresaIds: Set<string>) => {
  const candidaturas = candidate.EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios.map(
    (candidatura) => ({
      id: candidatura.id,
      statusId: candidatura.status_processo?.id ?? null,
      status: candidatura.status_processo?.nome ?? null,
      vaga: candidatura.EmpresasVagas
        ? {
            id: candidatura.EmpresasVagas.id,
            titulo: candidatura.EmpresasVagas.titulo,
            codigo: candidatura.EmpresasVagas.codigo,
            status: candidatura.EmpresasVagas.status,
          }
        : null,
      empresa: candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios
        ? {
            id: candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios.id,
            nomeExibicao:
              candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios.nomeCompleto,
            codigo: candidatura.Usuarios_EmpresasCandidatos_empresaUsuarioIdToUsuarios.codUsuario,
          }
        : null,
      curriculo: candidatura.UsuariosCurriculos
        ? {
            id: candidatura.UsuariosCurriculos.id,
            titulo: candidatura.UsuariosCurriculos.titulo ?? null,
            principal: candidatura.UsuariosCurriculos.principal,
            ultimaAtualizacao: candidatura.UsuariosCurriculos.ultimaAtualizacao,
          }
        : null,
    }),
  );

  const hasDirectCompanyScope = candidaturas.some(
    (candidatura) => candidatura.empresa && directEmpresaIds.has(candidatura.empresa.id),
  );

  return {
    candidato: {
      id: candidate.id,
      nomeCompleto: candidate.nomeCompleto,
      cpf: candidate.cpf ?? null,
      codUsuario: candidate.codUsuario,
      email: candidate.email,
      telefone: candidate.UsuariosInformation?.telefone ?? null,
      avatarUrl: candidate.UsuariosInformation?.avatarUrl ?? null,
      cidade: candidate.UsuariosEnderecos[0]?.cidade ?? null,
      estado: candidate.UsuariosEnderecos[0]?.estado ?? null,
    },
    curriculosResumo: {
      total: candidate._count.UsuariosCurriculos,
    },
    candidaturas,
    escopo: {
      totalCandidaturasVisiveis: candidaturas.length,
      tipoAcesso: hasDirectCompanyScope ? 'EMPRESA' : 'VAGA',
    },
  };
};

const ensureScopedFilters = async (params: {
  recrutadorId: string;
  empresaUsuarioId?: string;
  vagaId?: string;
}) => {
  const { recrutadorId, empresaUsuarioId, vagaId } = params;

  if (vagaId) {
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: vagaId },
      select: { id: true, usuarioId: true, status: true },
    });

    if (!vaga || vaga.status === StatusDeVagas.RASCUNHO) {
      throw new RecrutadorVagaNotFoundError('Vaga não encontrada.');
    }

    if (empresaUsuarioId && vaga.usuarioId !== empresaUsuarioId) {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a esta vaga.');
    }

    if (empresaUsuarioId) {
      await recrutadorEmpresasService.getForDashboard(recrutadorId, empresaUsuarioId);
    }

    try {
      await recrutadorVagasService.assertVinculo(recrutadorId, vagaId);
    } catch {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a esta vaga.');
    }

    return [vagaId];
  }

  if (empresaUsuarioId) {
    await recrutadorEmpresasService.getForDashboard(recrutadorId, empresaUsuarioId);
    return recrutadorVagasService.listVagaIdsByEmpresa(recrutadorId, empresaUsuarioId);
  }

  return recrutadorVagasService.listVagaIds(recrutadorId);
};

export const recrutadorCandidatosService = {
  list: async (recrutadorId: string, query: RecrutadorCandidatosListQuery) => {
    const effectiveVagaIds = await ensureScopedFilters({
      recrutadorId,
      empresaUsuarioId: query.empresaUsuarioId,
      vagaId: query.vagaId,
    });

    if (effectiveVagaIds.length === 0) {
      return {
        data: [],
        pagination: buildPagination(query.page, query.pageSize, 0),
      };
    }

    const searchWhere = buildSearchWhere(query.search);
    const candidaturasWhere: Prisma.EmpresasCandidatosWhereInput = {
      vagaId: { in: effectiveVagaIds },
    };

    const usuariosWhere: Prisma.UsuariosWhereInput = {
      role: Roles.ALUNO_CANDIDATO,
      EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios: {
        some: candidaturasWhere,
      },
    };

    if (searchWhere) {
      usuariosWhere.AND = [
        ...(Array.isArray(usuariosWhere.AND) ? usuariosWhere.AND : []),
        searchWhere,
      ];
    }

    if (query.criadoDe || query.criadoAte) {
      usuariosWhere.criadoEm = {};
      if (query.criadoDe) {
        usuariosWhere.criadoEm.gte = query.criadoDe;
      }
      if (query.criadoAte) {
        usuariosWhere.criadoEm.lte = query.criadoAte;
      }
    }

    const skip = (query.page - 1) * query.pageSize;

    const [total, candidates] = await prisma.$transaction([
      prisma.usuarios.count({ where: usuariosWhere }),
      prisma.usuarios.findMany({
        where: usuariosWhere,
        orderBy: { atualizadoEm: 'desc' },
        skip,
        take: query.pageSize,
        select: candidateListSelect(candidaturasWhere),
      }),
    ]);

    return {
      data: candidates.map(mapCandidateListItem),
      pagination: buildPagination(query.page, query.pageSize, total),
    };
  },

  get: async (recrutadorId: string, candidatoId: string) => {
    const candidateExists = await prisma.usuarios.findFirst({
      where: {
        id: candidatoId,
        role: Roles.ALUNO_CANDIDATO,
      },
      select: { id: true },
    });

    if (!candidateExists) {
      throw new RecrutadorCandidatoNotFoundError('Candidato não encontrado.');
    }

    const effectiveVagaIds = await ensureScopedFilters({ recrutadorId });

    if (effectiveVagaIds.length === 0) {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a este candidato.');
    }

    const detail = await prisma.usuarios.findFirst({
      where: {
        id: candidatoId,
        role: Roles.ALUNO_CANDIDATO,
        EmpresasCandidatos_EmpresasCandidatos_candidatoIdToUsuarios: {
          some: {
            vagaId: { in: effectiveVagaIds },
          },
        },
      },
      select: candidateDetailSelect({
        vagaId: { in: effectiveVagaIds },
      }),
    });

    if (!detail) {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a este candidato.');
    }

    const directEmpresaIds = new Set(
      await recrutadorEmpresasService.listDirectEmpresaUsuarioIds(recrutadorId),
    );

    return mapCandidateDetail(detail, directEmpresaIds);
  },

  getCurriculo: async (recrutadorId: string, candidatoId: string, curriculoId: string) => {
    const candidateExists = await prisma.usuarios.findFirst({
      where: {
        id: candidatoId,
        role: Roles.ALUNO_CANDIDATO,
      },
      select: { id: true },
    });

    if (!candidateExists) {
      throw new RecrutadorCandidatoNotFoundError('Candidato não encontrado.');
    }

    const curriculoExists = await prisma.usuariosCurriculos.findFirst({
      where: {
        id: curriculoId,
        usuarioId: candidatoId,
      },
      select: { id: true },
    });

    if (!curriculoExists) {
      throw new RecrutadorCurriculoNotFoundError('Currículo não encontrado.');
    }

    const effectiveVagaIds = await ensureScopedFilters({ recrutadorId });

    if (effectiveVagaIds.length === 0) {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a este currículo.');
    }

    const curriculo = await prisma.usuariosCurriculos.findFirst({
      where: {
        id: curriculoId,
        usuarioId: candidatoId,
        EmpresasCandidatos: {
          some: {
            candidatoId,
            curriculoId,
            vagaId: { in: effectiveVagaIds },
          },
        },
      },
      select: curriculoSelect,
    });

    if (!curriculo) {
      throw new RecrutadorCandidatoForbiddenError('Você não possui acesso a este currículo.');
    }

    return mapCurriculo(curriculo as CurriculoCompletoRecord);
  },
};

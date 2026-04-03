import { Prisma, Roles, StatusDeVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { humanizeStatusProcesso } from '@/modules/entrevistas/utils/presentation';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

import type { RecrutadorVagaCandidatosQuery } from '../validators/vagas.schema';

export class RecrutadorVagaCandidatosForbiddenError extends Error {
  status = 403 as const;
  code = 'FORBIDDEN' as const;
}

export class RecrutadorVagaCandidatesNotFoundError extends Error {
  status = 404 as const;
  code = 'VAGA_NOT_FOUND' as const;
}

const candidatePreviewSelect = {
  id: true,
  codUsuario: true,
  nomeCompleto: true,
  email: true,
  cpf: true,
  role: true,
  tipoUsuario: true,
  status: true,
  criadoEm: true,
  ultimoLogin: true,
  UsuariosInformation: {
    select: usuarioInformacoesSelect,
  },
  UsuariosEnderecos: {
    orderBy: { criadoEm: 'asc' as const },
    take: 1,
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
  _count: {
    select: {
      UsuariosCurriculos: true,
    },
  },
  UsuariosCurriculos: {
    orderBy: [{ principal: 'desc' as const }, { atualizadoEm: 'desc' as const }],
    take: 1,
    select: {
      id: true,
      titulo: true,
      principal: true,
      ultimaAtualizacao: true,
      experiencias: true,
      formacao: true,
    },
  },
} satisfies Prisma.UsuariosSelect;

const vagaCandidaturaSelect = {
  id: true,
  aplicadaEm: true,
  atualizadaEm: true,
  status_processo: {
    select: {
      nome: true,
    },
  },
  UsuariosCurriculos: {
    select: {
      id: true,
      titulo: true,
      principal: true,
      ultimaAtualizacao: true,
      experiencias: true,
      formacao: true,
    },
  },
  Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
    select: candidatePreviewSelect,
  },
} satisfies Prisma.EmpresasCandidatosSelect;

type VagaCandidaturaRecord = Prisma.EmpresasCandidatosGetPayload<{
  select: typeof vagaCandidaturaSelect;
}>;

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 1 : Math.ceil(total / pageSize),
});

const countEntries = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.filter((item) => {
      if (item === null || item === undefined) return false;
      if (typeof item === 'string') return item.trim().length > 0;
      if (typeof item === 'object') return Object.keys(item).length > 0;
      return true;
    }).length;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const arrayLengths = Object.values(objectValue)
      .filter(Array.isArray)
      .map((entry) => countEntries(entry));

    if (arrayLengths.length > 0) {
      return Math.max(...arrayLengths);
    }
  }

  return 0;
};

const summarizeExperiencias = (value: unknown): string | null => {
  const total = countEntries(value);
  if (total <= 0) return null;
  return total === 1 ? '1 experiência' : `${total} experiências`;
};

const extractFormacaoTitulo = (value: unknown): string | null => {
  if (!Array.isArray(value) || value.length === 0) return null;

  const first = value.find((item) => item && typeof item === 'object') as
    | Record<string, unknown>
    | undefined;

  if (!first) return null;

  const candidates = [
    first.curso,
    first.nomeCurso,
    first.titulo,
    first.formacao,
    first.graduacao,
    first.grau,
    first.instituicao,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
};

const summarizeFormacao = (value: unknown): string | null => {
  const firstTitle = extractFormacaoTitulo(value);
  if (firstTitle) return firstTitle;

  const total = countEntries(value);
  if (total <= 0) return null;
  return total === 1 ? '1 formação' : `${total} formações`;
};

const mapCandidatePreview = (
  candidate: Prisma.UsuariosGetPayload<{ select: typeof candidatePreviewSelect }>,
) => {
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
    nomeCompleto: merged.nomeCompleto,
    cpf: merged.cpf ?? null,
    codUsuario: merged.codUsuario,
    email: merged.email,
    telefone: merged.telefone ?? null,
    avatarUrl: merged.avatarUrl ?? null,
    cidade: merged.cidade ?? null,
    estado: merged.estado ?? null,
  };
};

const compareNullableDate = (left: Date | null | undefined, right: Date | null | undefined) => {
  const leftValue = left ? left.getTime() : null;
  const rightValue = right ? right.getTime() : null;

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  return leftValue - rightValue;
};

const compareText = (left: string | null | undefined, right: string | null | undefined) =>
  (left ?? '').localeCompare(right ?? '', 'pt-BR', { sensitivity: 'base' });

const sortItems = (items: ReturnType<typeof mapItem>[], query: RecrutadorVagaCandidatosQuery) => {
  const direction = query.sortDir === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    let result = 0;

    switch (query.sortBy) {
      case 'nome':
        result = compareText(left.candidato.nomeCompleto, right.candidato.nomeCompleto);
        break;
      case 'email':
        result = compareText(left.candidato.email, right.candidato.email);
        break;
      case 'codigo':
        result = compareText(left.candidato.codUsuario, right.candidato.codUsuario);
        break;
      case 'atualizadoEm':
        result = compareNullableDate(new Date(left.atualizadoEm), new Date(right.atualizadoEm));
        break;
      case 'statusCandidatura':
        result = compareText(left.statusCandidaturaLabel, right.statusCandidaturaLabel);
        break;
      case 'criadoEm':
      default:
        result = compareNullableDate(new Date(left.criadoEm), new Date(right.criadoEm));
        break;
    }

    if (result === 0) {
      result = compareText(left.candidato.nomeCompleto, right.candidato.nomeCompleto);
    }

    return result * direction;
  });
};

const mapItem = (candidatura: VagaCandidaturaRecord) => {
  const candidate = candidatura.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios;
  const candidatePrimaryCurriculo = candidate.UsuariosCurriculos[0] ?? null;
  const linkedCurriculo = candidatura.UsuariosCurriculos;
  const referenceCurriculo = linkedCurriculo ?? candidatePrimaryCurriculo;

  return {
    candidaturaId: candidatura.id,
    candidato: mapCandidatePreview(candidate),
    statusCandidatura: candidatura.status_processo?.nome ?? 'DESCONHECIDO',
    statusCandidaturaLabel: humanizeStatusProcesso(candidatura.status_processo?.nome),
    criadoEm: candidatura.aplicadaEm.toISOString(),
    atualizadoEm: candidatura.atualizadaEm.toISOString(),
    curriculosResumo: {
      total: candidate._count.UsuariosCurriculos,
      principalTitulo:
        candidatePrimaryCurriculo?.titulo?.trim() || linkedCurriculo?.titulo?.trim() || null,
    },
    curriculo: linkedCurriculo
      ? {
          id: linkedCurriculo.id,
          titulo: linkedCurriculo.titulo ?? null,
          principal: linkedCurriculo.principal,
          ultimaAtualizacao: linkedCurriculo.ultimaAtualizacao,
        }
      : null,
    experienciaResumo: summarizeExperiencias(referenceCurriculo?.experiencias ?? null),
    formacaoResumo: summarizeFormacao(referenceCurriculo?.formacao ?? null),
  };
};

export const recrutadorVagaCandidatosService = {
  async list(recrutadorId: string, vagaId: string, query: RecrutadorVagaCandidatosQuery) {
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: vagaId },
      select: {
        id: true,
        titulo: true,
        codigo: true,
        status: true,
      },
    });

    if (!vaga || vaga.status === StatusDeVagas.RASCUNHO) {
      throw new RecrutadorVagaCandidatesNotFoundError('Vaga não encontrada.');
    }

    try {
      await recrutadorVagasService.assertVinculo(recrutadorId, vagaId);
    } catch {
      throw new RecrutadorVagaCandidatosForbiddenError(
        'Você não possui acesso aos candidatos desta vaga.',
      );
    }

    const where: Prisma.EmpresasCandidatosWhereInput = {
      vagaId,
      Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
        is: {
          role: Roles.ALUNO_CANDIDATO,
        },
      },
      ...(query.inscricaoDe || query.inscricaoAte
        ? {
            aplicadaEm: {
              ...(query.inscricaoDe ? { gte: query.inscricaoDe } : {}),
              ...(query.inscricaoAte ? { lte: query.inscricaoAte } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
              is: {
                role: Roles.ALUNO_CANDIDATO,
                OR: [
                  { nomeCompleto: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                  { codUsuario: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };

    const candidaturas = await prisma.empresasCandidatos.findMany({
      where,
      select: vagaCandidaturaSelect,
    });

    const mappedItems = candidaturas.map(mapItem);
    const sortedItems = sortItems(mappedItems, query);
    const total = sortedItems.length;
    const skip = (query.page - 1) * query.pageSize;

    return {
      vaga: {
        id: vaga.id,
        titulo: vaga.titulo,
        codigo: vaga.codigo,
        status: vaga.status,
      },
      items: sortedItems.slice(skip, skip + query.pageSize),
      pagination: buildPagination(query.page, query.pageSize, total),
    };
  },
};

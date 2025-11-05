import { Prisma, OrigemVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';

// Função auxiliar para buscar status padrão
const getStatusPadrao = async () => {
  const statusPadrao = await prisma.status_processo.findFirst({
    where: { isDefault: true, ativo: true },
  });

  if (!statusPadrao) {
    throw new Error('Nenhum status padrão encontrado.');
  }

  return statusPadrao;
};
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import {
  VagaProcessoCandidatoInvalidoError,
  VagaProcessoCandidatoNaoEncontradoError,
  VagaProcessoDuplicadoError,
  VagaProcessoNaoEncontradoError,
  VagaProcessoVagaNaoEncontradaError,
} from '@/modules/empresas/vagas-processos/services/errors';

const processoSelect = {
  id: true,
  vagaId: true,
  candidatoId: true,
  statusId: true,
  status_processo: {
    select: {
      id: true,
      nome: true,
      descricao: true,
      ativo: true,
      isDefault: true,
    },
  },
  origem: true,
  observacoes: true,
  agendadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
  Usuarios: {
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      codUsuario: true,
      role: true,
      status: true,
      tipoUsuario: true,
      criadoEm: true,
      ultimoLogin: true,
      UsuariosInformation: {
        select: usuarioInformacoesSelect,
      },
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
} satisfies Prisma.EmpresasVagasProcessoSelect;

type ProcessoSelect = typeof processoSelect;

type ProcessoResult = Prisma.EmpresasVagasProcessoGetPayload<{ select: ProcessoSelect }>;

const mapProcesso = (processo: ProcessoResult) => {
  if (!processo.Usuarios) {
    return { ...processo, candidato: null };
  }

  const candidatoComInformacoes = mergeUsuarioInformacoes(processo.Usuarios);
  const candidatoComEndereco = attachEnderecoResumo(candidatoComInformacoes);

  return {
    ...processo,
    candidato: candidatoComEndereco ?? candidatoComInformacoes,
  };
};

const ensureVagaExists = async (vagaId: string) => {
  const vaga = await prisma.empresasVagas.findUnique({
    where: { id: vagaId },
    select: { id: true },
  });

  if (!vaga) {
    throw new VagaProcessoVagaNaoEncontradaError();
  }
};

const ensureCandidatoElegivel = async (candidatoId: string) => {
  const candidato = await prisma.usuarios.findUnique({
    where: { id: candidatoId },
    select: {
      id: true,
      role: true,
      _count: {
        select: { UsuariosCurriculos: true },
      },
    },
  });

  if (!candidato) {
    throw new VagaProcessoCandidatoNaoEncontradoError();
  }

  if (candidato.role !== 'ALUNO_CANDIDATO') {
    throw new VagaProcessoCandidatoInvalidoError();
  }

  if (!candidato._count || candidato._count.UsuariosCurriculos === 0) {
    throw new VagaProcessoCandidatoInvalidoError();
  }
};

const findProcessoOrThrow = async (vagaId: string, processoId: string) => {
  const processo = await prisma.empresasVagasProcesso.findFirst({
    where: { id: processoId, vagaId },
    select: processoSelect,
  });

  if (!processo) {
    throw new VagaProcessoNaoEncontradoError();
  }

  return processo;
};

export type VagaProcessoListFilters = {
  statusIds?: string[];
  origem?: OrigemVagas[];
  candidatoId?: string;
};

export type VagaProcessoCreateInput = {
  candidatoId: string;
  statusId?: string;
  origem?: OrigemVagas;
  observacoes?: string | null;
  agendadoEm?: Date | null;
};

export type VagaProcessoUpdateInput = {
  statusId?: string;
  origem?: OrigemVagas;
  observacoes?: string | null;
  agendadoEm?: Date | null;
};

export const vagasProcessosService = {
  list: async (vagaId: string, filters?: VagaProcessoListFilters) => {
    await ensureVagaExists(vagaId);

    const where: Prisma.EmpresasVagasProcessoWhereInput = {
      vagaId,
      ...(filters?.statusIds && filters.statusIds.length > 0
        ? { statusId: { in: filters.statusIds } }
        : {}),
      ...(filters?.origem && filters.origem.length > 0 ? { origem: { in: filters.origem } } : {}),
      ...(filters?.candidatoId ? { candidatoId: filters.candidatoId } : {}),
    };

    const processos = await prisma.empresasVagasProcesso.findMany({
      where,
      select: processoSelect,
      orderBy: { criadoEm: 'desc' },
    });

    return processos.map(mapProcesso);
  },

  get: async (vagaId: string, processoId: string) => {
    const processo = await findProcessoOrThrow(vagaId, processoId);
    return mapProcesso(processo);
  },

  create: async (vagaId: string, input: VagaProcessoCreateInput) => {
    await ensureVagaExists(vagaId);
    await ensureCandidatoElegivel(input.candidatoId);

    try {
      const processo = await prisma.empresasVagasProcesso.create({
        data: {
          vagaId,
          candidatoId: input.candidatoId,
          statusId: input.statusId ?? (await getStatusPadrao()).id,
          origem: input.origem ?? OrigemVagas.SITE,
          observacoes: input.observacoes ?? null,
          agendadoEm: input.agendadoEm ?? null,
        },
        select: processoSelect,
      });

      return mapProcesso(processo);
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new VagaProcessoDuplicadoError();
      }
      throw error;
    }
  },

  update: async (vagaId: string, processoId: string, input: VagaProcessoUpdateInput) => {
    await findProcessoOrThrow(vagaId, processoId);

    const processo = await prisma.empresasVagasProcesso.update({
      where: { id: processoId },
      data: {
        ...(input.statusId ? { statusId: input.statusId } : {}),
        ...(input.origem ? { origem: input.origem } : {}),
        ...(input.observacoes !== undefined ? { observacoes: input.observacoes } : {}),
        ...(input.agendadoEm !== undefined ? { agendadoEm: input.agendadoEm } : {}),
      },
      select: processoSelect,
    });

    return mapProcesso(processo);
  },

  remove: async (vagaId: string, processoId: string) => {
    await findProcessoOrThrow(vagaId, processoId);

    await prisma.empresasVagasProcesso.delete({ where: { id: processoId } });
  },
};

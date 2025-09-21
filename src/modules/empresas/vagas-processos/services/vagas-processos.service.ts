import { Prisma, OrigemVagas, StatusProcesso } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import { mergeUsuarioInformacoes, usuarioInformacoesSelect } from '@/modules/usuarios/utils/information';
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
  status: true,
  origem: true,
  observacoes: true,
  agendadoEm: true,
  criadoEm: true,
  atualizadoEm: true,
  candidato: {
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
      informacoes: {
        select: usuarioInformacoesSelect,
      },
      enderecos: {
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
  if (!processo.candidato) {
    return { ...processo, candidato: null };
  }

  const candidatoComInformacoes = mergeUsuarioInformacoes(processo.candidato);
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
    },
  });

  if (!candidato) {
    throw new VagaProcessoCandidatoNaoEncontradoError();
  }

  if (candidato.role !== 'ALUNO_CANDIDATO') {
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
  status?: StatusProcesso[];
  origem?: OrigemVagas[];
  candidatoId?: string;
};

export type VagaProcessoCreateInput = {
  candidatoId: string;
  status?: StatusProcesso;
  origem?: OrigemVagas;
  observacoes?: string | null;
  agendadoEm?: Date | null;
};

export type VagaProcessoUpdateInput = {
  status?: StatusProcesso;
  origem?: OrigemVagas;
  observacoes?: string | null;
  agendadoEm?: Date | null;
};

export const vagasProcessosService = {
  list: async (vagaId: string, filters?: VagaProcessoListFilters) => {
    await ensureVagaExists(vagaId);

    const where: Prisma.EmpresasVagasProcessoWhereInput = {
      vagaId,
      ...(filters?.status && filters.status.length > 0 ? { status: { in: filters.status } } : {}),
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
          status: input.status ?? StatusProcesso.RECEBIDA,
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
        ...(input.status ? { status: input.status } : {}),
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

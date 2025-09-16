import { ModalidadeVaga, Prisma, RegimeTrabalho, StatusVaga } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { planosParceiroService } from '@/modules/empresas/planos-parceiro/services/planos-parceiro.service';
import {
  EmpresaSemPlanoAtivoError,
  LimiteVagasPlanoAtingidoError,
} from '@/modules/empresas/vagas/services/errors';

export type CreateVagaData = {
  empresaId: string;
  modoAnonimo?: boolean;
  regimeDeTrabalho: RegimeTrabalho;
  modalidade: ModalidadeVaga;
  paraPcd?: boolean;
  requisitos: string;
  atividades: string;
  beneficios: string;
  observacoes?: string;
  cargaHoraria: string;
  inscricoesAte?: Date;
  inseridaEm?: Date;
  status?: StatusVaga;
};

export type UpdateVagaData = Omit<Partial<CreateVagaData>, 'inscricoesAte'> & {
  inscricoesAte?: Date | null;
};

const ANON_DESCRIPTION =
  'Esta empresa optou por manter suas informações confidenciais até avançar nas etapas do processo seletivo.';

const includeEmpresa = { include: { empresa: true } } as const;

type VagaWithEmpresa = Prisma.VagaGetPayload<typeof includeEmpresa>;

const anonymizedName = (vagaId: string) => `Oportunidade Confidencial #${vagaId.slice(0, 5).toUpperCase()}`;

const nullableText = (value?: string) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeCreateData = (data: CreateVagaData): Prisma.VagaUncheckedCreateInput => ({
  empresaId: data.empresaId,
  modoAnonimo: data.modoAnonimo ?? false,
  regimeDeTrabalho: data.regimeDeTrabalho,
  modalidade: data.modalidade,
  paraPcd: data.paraPcd ?? false,
  requisitos: data.requisitos.trim(),
  atividades: data.atividades.trim(),
  beneficios: data.beneficios.trim(),
  observacoes: nullableText(data.observacoes),
  cargaHoraria: data.cargaHoraria.trim(),
  inscricoesAte: data.inscricoesAte ?? null,
  inseridaEm: data.inseridaEm ?? new Date(),
  status: data.status ?? StatusVaga.EM_ANALISE,
});

const sanitizeUpdateData = (data: UpdateVagaData): Prisma.VagaUncheckedUpdateInput => {
  const update: Prisma.VagaUncheckedUpdateInput = {};

  if (data.empresaId !== undefined) {
    update.empresaId = data.empresaId;
  }
  if (data.modoAnonimo !== undefined) {
    update.modoAnonimo = data.modoAnonimo;
  }
  if (data.regimeDeTrabalho !== undefined) {
    update.regimeDeTrabalho = data.regimeDeTrabalho;
  }
  if (data.modalidade !== undefined) {
    update.modalidade = data.modalidade;
  }
  if (data.paraPcd !== undefined) {
    update.paraPcd = data.paraPcd;
  }
  if (data.requisitos !== undefined) {
    update.requisitos = data.requisitos.trim();
  }
  if (data.atividades !== undefined) {
    update.atividades = data.atividades.trim();
  }
  if (data.beneficios !== undefined) {
    update.beneficios = data.beneficios.trim();
  }
  if (data.observacoes !== undefined) {
    update.observacoes = nullableText(data.observacoes);
  }
  if (data.cargaHoraria !== undefined) {
    update.cargaHoraria = data.cargaHoraria.trim();
  }
  if (data.inscricoesAte !== undefined) {
    update.inscricoesAte = data.inscricoesAte ?? null;
  }
  if (data.inseridaEm !== undefined) {
    update.inseridaEm = data.inseridaEm;
  }
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === StatusVaga.PUBLICADO && data.inseridaEm === undefined) {
      update.inseridaEm = new Date();
    }
  }

  return update;
};

const transformVaga = (vaga: VagaWithEmpresa) => {
  if (!vaga) return null;

  const displayName = vaga.modoAnonimo ? anonymizedName(vaga.id) : vaga.empresa?.nome ?? null;
  const displayLogo = vaga.modoAnonimo ? null : vaga.empresa?.logoUrl ?? null;
  const rawDescricao = vaga.empresa?.descricao;
  const displayDescription = vaga.modoAnonimo
    ? ANON_DESCRIPTION
    : typeof rawDescricao === 'string' && rawDescricao.trim().length > 0
      ? rawDescricao.trim()
      : rawDescricao ?? null;

  const empresa = vaga.empresa
    ? {
        ...vaga.empresa,
        nome: displayName ?? vaga.empresa.nome,
        logoUrl: vaga.modoAnonimo ? null : vaga.empresa.logoUrl,
        descricao: displayDescription,
      }
    : null;

  return {
    ...vaga,
    empresa,
    nomeExibicao: displayName,
    logoExibicao: displayLogo,
    mensagemAnonimato: vaga.modoAnonimo ? ANON_DESCRIPTION : null,
    descricaoExibicao: displayDescription,
  };
};

const ensurePlanoAtivoParaEmpresa = async (empresaId: string) => {
  const planoAtivo = await planosParceiroService.findActiveByEmpresa(empresaId);

  if (!planoAtivo) {
    throw new EmpresaSemPlanoAtivoError();
  }

  const limite = planoAtivo.plano.quantidadeVagas;
  if (typeof limite === 'number' && limite > 0) {
    const vagasAtivas = await prisma.vaga.count({
      where: {
        empresaId,
        status: { in: [StatusVaga.EM_ANALISE, StatusVaga.PUBLICADO] },
      },
    });

    if (vagasAtivas >= limite) {
      throw new LimiteVagasPlanoAtingidoError(limite);
    }
  }

  return planoAtivo;
};

export const vagasService = {
  list: async () => {
    const vagas = await prisma.vaga.findMany({
      where: { status: StatusVaga.PUBLICADO },
      ...includeEmpresa,
      orderBy: { inseridaEm: 'desc' },
    });

    return vagas.map((vaga) => transformVaga(vaga));
  },

  get: async (id: string) => {
    const vaga = await prisma.vaga.findFirst({
      where: { id, status: StatusVaga.PUBLICADO },
      ...includeEmpresa,
    });

    return vaga ? transformVaga(vaga) : null;
  },

  create: async (data: CreateVagaData) => {
    await ensurePlanoAtivoParaEmpresa(data.empresaId);
    const vaga = await prisma.vaga.create({
      data: sanitizeCreateData(data),
      ...includeEmpresa,
    });

    return transformVaga(vaga);
  },

  update: async (id: string, data: UpdateVagaData) => {
    const vaga = await prisma.vaga.update({
      where: { id },
      data: sanitizeUpdateData(data),
      ...includeEmpresa,
    });

    return transformVaga(vaga);
  },

  remove: (id: string) => prisma.vaga.delete({ where: { id } }),
};

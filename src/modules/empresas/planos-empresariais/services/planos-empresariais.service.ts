import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

export const MAX_PLANOS_EMPRESARIAIS = 4;

export class PlanosEmpresariaisLimitError extends Error {
  constructor() {
    super(`Limite máximo de ${MAX_PLANOS_EMPRESARIAIS} planos empresariais atingido`);
    this.name = 'PlanosEmpresariaisLimitError';
  }
}

type CreatePlanosEmpresariaisData = {
  icon: string;
  nome: string;
  descricao: string;
  valor: string;
  desconto?: number | null;
  quantidadeVagas: number;
  vagaEmDestaque: boolean;
  quantidadeVagasDestaque?: number | null;
};

type UpdatePlanosEmpresariaisData = Partial<CreatePlanosEmpresariaisData>;

const sanitizeCreateData = (
  data: CreatePlanosEmpresariaisData,
): Prisma.PlanosEmpresariaisUncheckedCreateInput => ({
  icon: data.icon.trim(),
  nome: data.nome.trim(),
  descricao: data.descricao.trim(),
  valor: data.valor,
  desconto: data.desconto ?? null,
  quantidadeVagas: data.quantidadeVagas,
  vagaEmDestaque: data.vagaEmDestaque,
  quantidadeVagasDestaque: data.vagaEmDestaque ? (data.quantidadeVagasDestaque ?? null) : null,
});

const sanitizeUpdateData = (
  data: UpdatePlanosEmpresariaisData,
): Prisma.PlanosEmpresariaisUncheckedUpdateInput => {
  const update: Prisma.PlanosEmpresariaisUncheckedUpdateInput = {};

  if (data.icon !== undefined) {
    update.icon = data.icon.trim();
  }
  if (data.nome !== undefined) {
    update.nome = data.nome.trim();
  }
  if (data.descricao !== undefined) {
    update.descricao = data.descricao.trim();
  }
  if (data.valor !== undefined) {
    update.valor = data.valor;
  }
  if (data.desconto !== undefined) {
    update.desconto = data.desconto ?? null;
  }
  if (data.quantidadeVagas !== undefined) {
    update.quantidadeVagas = data.quantidadeVagas;
  }
  if (data.vagaEmDestaque !== undefined) {
    update.vagaEmDestaque = data.vagaEmDestaque;
    if (!data.vagaEmDestaque) {
      update.quantidadeVagasDestaque = null;
    } else if (data.quantidadeVagasDestaque !== undefined) {
      update.quantidadeVagasDestaque = data.quantidadeVagasDestaque;
    }
  } else if (data.quantidadeVagasDestaque !== undefined) {
    update.quantidadeVagasDestaque = data.quantidadeVagasDestaque;
  }

  return update;
};

export const planosEmpresariaisService = {
  list: () =>
    prisma.planosEmpresariais.findMany({
      orderBy: { criadoEm: 'asc' },
    }),

  get: (id: string) => prisma.planosEmpresariais.findUnique({ where: { id } }),

  create: async (data: CreatePlanosEmpresariaisData) => {
    const totalPlanos = await prisma.planosEmpresariais.count();
    if (totalPlanos >= MAX_PLANOS_EMPRESARIAIS) {
      throw new PlanosEmpresariaisLimitError();
    }

    return prisma.planosEmpresariais.create({ data: sanitizeCreateData(data) });
  },

  update: (id: string, data: UpdatePlanosEmpresariaisData) =>
    prisma.planosEmpresariais.update({ where: { id }, data: sanitizeUpdateData(data) }),

  remove: (id: string) => prisma.planosEmpresariais.delete({ where: { id } }),
};

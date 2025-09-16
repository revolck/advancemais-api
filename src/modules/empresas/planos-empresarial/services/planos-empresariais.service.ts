import { Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

export const MAX_PLANOS_EMPRESARIAIS = 4;

export class PlanoEmpresarialLimitError extends Error {
  constructor() {
    super(`Limite máximo de ${MAX_PLANOS_EMPRESARIAIS} planos empresariais atingido`);
    this.name = 'PlanoEmpresarialLimitError';
  }
}

type CreatePlanoEmpresarialData = {
  icon: string;
  nome: string;
  descricao: string;
  valor: string;
  desconto?: number | null;
  quantidadeVagas: number;
  vagaEmDestaque: boolean;
  quantidadeVagasDestaque?: number | null;
};

type UpdatePlanoEmpresarialData = Partial<CreatePlanoEmpresarialData>;

const sanitizeCreateData = (data: CreatePlanoEmpresarialData): Prisma.PlanoEmpresarialUncheckedCreateInput => ({
  icon: data.icon.trim(),
  nome: data.nome.trim(),
  descricao: data.descricao.trim(),
  valor: data.valor,
  desconto: data.desconto ?? null,
  quantidadeVagas: data.quantidadeVagas,
  vagaEmDestaque: data.vagaEmDestaque,
  quantidadeVagasDestaque: data.vagaEmDestaque ? data.quantidadeVagasDestaque ?? null : null,
});

const sanitizeUpdateData = (
  data: UpdatePlanoEmpresarialData,
): Prisma.PlanoEmpresarialUncheckedUpdateInput => {
  const update: Prisma.PlanoEmpresarialUncheckedUpdateInput = {};

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
    prisma.planoEmpresarial.findMany({
      orderBy: { criadoEm: 'asc' },
    }),

  get: (id: string) => prisma.planoEmpresarial.findUnique({ where: { id } }),

  create: async (data: CreatePlanoEmpresarialData) => {
    const totalPlanos = await prisma.planoEmpresarial.count();
    if (totalPlanos >= MAX_PLANOS_EMPRESARIAIS) {
      throw new PlanoEmpresarialLimitError();
    }

    return prisma.planoEmpresarial.create({ data: sanitizeCreateData(data) });
  },

  update: (id: string, data: UpdatePlanoEmpresarialData) =>
    prisma.planoEmpresarial.update({ where: { id }, data: sanitizeUpdateData(data) }),

  remove: (id: string) => prisma.planoEmpresarial.delete({ where: { id } }),
};

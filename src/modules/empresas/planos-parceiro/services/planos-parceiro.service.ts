import { PlanoParceiro, Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  CreatePlanoParceiroInput,
  ListPlanoParceiroQuery,
  PlanoParceiroTipo,
  UpdatePlanoParceiroInput,
} from '@/modules/empresas/planos-parceiro/validators/planos-parceiro.schema';

const PLANO_INPUT_MAP: Record<PlanoParceiroTipo, PlanoParceiro> = {
  '7_dias': PlanoParceiro.SETE_DIAS,
  '15_dias': PlanoParceiro.QUINZE_DIAS,
  '30_dias': PlanoParceiro.TRINTA_DIAS,
  '60_dias': PlanoParceiro.SESSENTA_DIAS,
  '90dias': PlanoParceiro.NOVENTA_DIAS,
  '120_dias': PlanoParceiro.CENTO_VINTE_DIAS,
  parceiro: PlanoParceiro.PARCEIRO,
};

const PLANO_OUTPUT_MAP: Record<PlanoParceiro, PlanoParceiroTipo> = {
  [PlanoParceiro.SETE_DIAS]: '7_dias',
  [PlanoParceiro.QUINZE_DIAS]: '15_dias',
  [PlanoParceiro.TRINTA_DIAS]: '30_dias',
  [PlanoParceiro.SESSENTA_DIAS]: '60_dias',
  [PlanoParceiro.NOVENTA_DIAS]: '90dias',
  [PlanoParceiro.CENTO_VINTE_DIAS]: '120_dias',
  [PlanoParceiro.PARCEIRO]: 'parceiro',
};

const PLANO_DURACAO: Record<PlanoParceiro, number | null> = {
  [PlanoParceiro.SETE_DIAS]: 7,
  [PlanoParceiro.QUINZE_DIAS]: 15,
  [PlanoParceiro.TRINTA_DIAS]: 30,
  [PlanoParceiro.SESSENTA_DIAS]: 60,
  [PlanoParceiro.NOVENTA_DIAS]: 90,
  [PlanoParceiro.CENTO_VINTE_DIAS]: 120,
  [PlanoParceiro.PARCEIRO]: null,
};

const includePlanoEmpresa = {
  include: {
    empresa: {
      select: {
        id: true,
        nome: true,
        logoUrl: true,
        cidade: true,
        estado: true,
      },
    },
    plano: true,
  },
} as const;

type EmpresaPlanoWithRelations = Prisma.EmpresaPlanoGetPayload<typeof includePlanoEmpresa>;

const sanitizeObservacao = (value?: string | null) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const calcularDataFim = (tipo: PlanoParceiro, inicio: Date) => {
  const duracao = PLANO_DURACAO[tipo];
  if (duracao === null) {
    return null;
  }

  const data = new Date(inicio.getTime());
  data.setDate(data.getDate() + duracao);
  return data;
};

const mapTipoToPrisma = (tipo: PlanoParceiroTipo) => PLANO_INPUT_MAP[tipo];

const mapTipoToResponse = (tipo: PlanoParceiro) => PLANO_OUTPUT_MAP[tipo];

const transformarPlano = (plano: EmpresaPlanoWithRelations) => {
  const now = new Date();
  const estaVigente = plano.ativo && (!plano.fim || plano.fim > now);
  const diasRestantes =
    plano.fim && plano.fim > now ? Math.ceil((plano.fim.getTime() - now.getTime()) / 86400000) : null;

  return {
    ...plano,
    tipo: mapTipoToResponse(plano.tipo),
    estaVigente,
    diasRestantes: diasRestantes !== null && diasRestantes < 0 ? 0 : diasRestantes,
  };
};

const buildWhere = (filters: ListPlanoParceiroQuery): Prisma.EmpresaPlanoWhereInput => {
  const where: Prisma.EmpresaPlanoWhereInput = {};

  if (filters.empresaId) {
    where.empresaId = filters.empresaId;
  }

  if (filters.ativo !== undefined) {
    where.ativo = filters.ativo;
  }

  return where;
};

export const planosParceiroService = {
  list: async (filters: ListPlanoParceiroQuery) => {
    const planos = await prisma.empresaPlano.findMany({
      where: buildWhere(filters),
      orderBy: { criadoEm: 'desc' },
      ...includePlanoEmpresa,
    });

    return planos.map((plano) => transformarPlano(plano));
  },

  get: async (id: string) => {
    const plano = await prisma.empresaPlano.findUnique({ where: { id }, ...includePlanoEmpresa });
    return plano ? transformarPlano(plano) : null;
  },

  findActiveByEmpresa: async (empresaId: string) => {
    const now = new Date();
    const plano = await prisma.empresaPlano.findFirst({
      where: {
        empresaId,
        ativo: true,
        OR: [{ fim: null }, { fim: { gt: now } }],
      },
      orderBy: { inicio: 'desc' },
      include: { plano: true },
    });

    if (!plano) return null;

    return {
      ...plano,
      tipo: mapTipoToResponse(plano.tipo),
    };
  },

  assign: async (data: CreatePlanoParceiroInput) => {
    const tipo = mapTipoToPrisma(data.tipo);
    const inicio = data.iniciarEm ?? new Date();
    const fim = calcularDataFim(tipo, inicio);
    const observacao = sanitizeObservacao(data.observacao);

    const plano = await prisma.$transaction(async (tx) => {
      await tx.empresaPlano.updateMany({
        where: { empresaId: data.empresaId, ativo: true },
        data: { ativo: false, fim: new Date() },
      });

      return tx.empresaPlano.create({
        data: {
          empresaId: data.empresaId,
          planoEmpresarialId: data.planoEmpresarialId,
          tipo,
          inicio,
          fim,
          observacao,
        },
        ...includePlanoEmpresa,
      });
    });

    return transformarPlano(plano);
  },

  update: async (id: string, data: UpdatePlanoParceiroInput) => {
    const planoAtual = await prisma.empresaPlano.findUnique({ where: { id } });

    if (!planoAtual) {
      throw Object.assign(new Error('Plano da empresa não encontrado'), { code: 'EMPRESA_PLANO_NOT_FOUND' });
    }

    const updates: Prisma.EmpresaPlanoUpdateInput = {};

    if (data.planoEmpresarialId !== undefined) {
      updates.plano = { connect: { id: data.planoEmpresarialId } };
    }

    let inicio = planoAtual.inicio;
    if (data.iniciarEm !== undefined) {
      inicio = data.iniciarEm;
      updates.inicio = inicio;
    }

    let tipo = planoAtual.tipo;
    if (data.tipo !== undefined) {
      tipo = mapTipoToPrisma(data.tipo);
      updates.tipo = tipo;
    }

    if (data.tipo !== undefined || data.iniciarEm !== undefined) {
      updates.fim = calcularDataFim(tipo, inicio);
    }

    if (data.observacao !== undefined) {
      updates.observacao = sanitizeObservacao(data.observacao);
    }

    const plano = await prisma.empresaPlano.update({ where: { id }, data: updates, ...includePlanoEmpresa });
    return transformarPlano(plano);
  },

  deactivate: async (id: string) => {
    const planoAtual = await prisma.empresaPlano.findUnique({ where: { id } });

    if (!planoAtual) {
      throw Object.assign(new Error('Plano da empresa não encontrado'), { code: 'EMPRESA_PLANO_NOT_FOUND' });
    }

    const fim = planoAtual.fim && planoAtual.fim < new Date() ? planoAtual.fim : new Date();

    await prisma.empresaPlano.update({
      where: { id },
      data: { ativo: false, fim },
    });
  },
};

import { PlanoParceiro, Prisma, TipoUsuario } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  CreateClientePlanoInput,
  ListClientePlanoQuery,
  UpdateClientePlanoInput,
} from '@/modules/empresas/clientes/validators/clientes.schema';
import {
  getPlanoParceiroDuracao,
  mapClienteTipoToPlanoParceiro,
  mapPlanoParceiroToClienteTipo,
} from '@/modules/empresas/shared/plano-parceiro';

const includePlanoEmpresa = {
  include: {
    empresa: {
      select: {
        id: true,
        nomeCompleto: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
        role: true,
        tipoUsuario: true,
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
    plano: true,
  },
} as const;

type EmpresaPlanoWithRelations = Prisma.EmpresaPlanoGetPayload<typeof includePlanoEmpresa>;

const sanitizeObservacao = (value?: string | null) => {
  if (typeof value !== 'string') return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const calcularDataFim = (tipo: PlanoParceiro, inicio: Date | null) => {
  const duracao = getPlanoParceiroDuracao(tipo);
  if (duracao === null) {
    return null;
  }
  const base = inicio ?? new Date();
  const data = new Date(base.getTime());
  data.setDate(data.getDate() + duracao);
  return data;
};

const ensureUsuarioEmpresa = async (usuarioId: string) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { tipoUsuario: true },
  });

  if (!usuario || usuario.tipoUsuario !== TipoUsuario.PESSOA_JURIDICA) {
    throw Object.assign(new Error('Usuário informado não é uma empresa válida'), {
      code: 'USUARIO_NAO_EMPRESA',
    });
  }
};

const transformarPlano = (plano: EmpresaPlanoWithRelations) => {
  const now = new Date();
  const estaVigente = plano.ativo && (!plano.fim || plano.fim > now);
  const diasRestantes =
    plano.fim && plano.fim > now ? Math.ceil((plano.fim.getTime() - now.getTime()) / 86400000) : null;

  const empresaUsuarioRaw =
    plano.empresa && plano.empresa.tipoUsuario === TipoUsuario.PESSOA_JURIDICA ? plano.empresa : null;
  const empresaUsuario = empresaUsuarioRaw ? attachEnderecoResumo(empresaUsuarioRaw)! : null;

  const empresa = empresaUsuario
    ? {
        id: empresaUsuario.id,
        nome: empresaUsuario.nomeCompleto,
        avatarUrl: empresaUsuario.avatarUrl,
        cidade: empresaUsuario.cidade,
        estado: empresaUsuario.estado,
        descricao: empresaUsuario.descricao,
        instagram: empresaUsuario.instagram,
        linkedin: empresaUsuario.linkedin,
        codUsuario: empresaUsuario.codUsuario,
        enderecos: empresaUsuario.enderecos,
      }
    : null;

  const { empresa: _empresa, ...restoPlano } = plano;

  return {
    ...restoPlano,
    empresa,
    tipo: mapPlanoParceiroToClienteTipo(plano.tipo),
    estaVigente,
    diasRestantes: diasRestantes !== null && diasRestantes < 0 ? 0 : diasRestantes,
  };
};

const buildWhere = (filters: ListClientePlanoQuery): Prisma.EmpresaPlanoWhereInput => {
  const where: Prisma.EmpresaPlanoWhereInput = {};

  if (filters.usuarioId) {
    where.usuarioId = filters.usuarioId;
  }

  if (filters.ativo !== undefined) {
    where.ativo = filters.ativo;
  }

  return where;
};

export const clientesService = {
  list: async (filters: ListClientePlanoQuery) => {
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

  findActiveByUsuario: async (usuarioId: string) => {
    await ensureUsuarioEmpresa(usuarioId);
    const now = new Date();
    const plano = await prisma.empresaPlano.findFirst({
      where: {
        usuarioId,
        ativo: true,
        OR: [{ fim: null }, { fim: { gt: now } }],
      },
      orderBy: { inicio: 'desc' },
      include: { plano: true },
    });

    if (!plano) return null;

    return {
      ...plano,
      tipo: mapPlanoParceiroToClienteTipo(plano.tipo),
    };
  },

  assign: async (data: CreateClientePlanoInput) => {
    await ensureUsuarioEmpresa(data.usuarioId);
    const tipo = mapClienteTipoToPlanoParceiro(data.tipo);
    const inicio = data.iniciarEm ?? new Date();
    const fim = calcularDataFim(tipo, inicio);
    const observacao = sanitizeObservacao(data.observacao);

    const plano = await prisma.$transaction(async (tx) => {
      await tx.empresaPlano.updateMany({
        where: { usuarioId: data.usuarioId, ativo: true },
        data: { ativo: false, fim: new Date() },
      });

      return tx.empresaPlano.create({
        data: {
          usuarioId: data.usuarioId,
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

  update: async (id: string, data: UpdateClientePlanoInput) => {
    const planoAtual = await prisma.empresaPlano.findUnique({ where: { id } });

    if (!planoAtual) {
      throw Object.assign(new Error('Plano da empresa não encontrado'), { code: 'EMPRESA_PLANO_NOT_FOUND' });
    }

    const updates: Prisma.EmpresaPlanoUpdateInput = {};

    if (data.planoEmpresarialId !== undefined) {
      updates.plano = { connect: { id: data.planoEmpresarialId } };
    }

    let inicio = planoAtual.inicio ?? null;
    if (data.iniciarEm !== undefined) {
      inicio = data.iniciarEm;
      updates.inicio = inicio;
    }

    let tipo = planoAtual.tipo;
    if (data.tipo !== undefined) {
      tipo = mapClienteTipoToPlanoParceiro(data.tipo);
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

import { EmpresasPlanoModo, EmpresasPlanoStatus, Prisma, TiposDeUsuarios } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { attachEnderecoResumo } from '@/modules/usuarios/utils/address';
import {
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '@/modules/usuarios/utils/information';
import { mapSocialLinks, usuarioRedesSociaisSelect } from '@/modules/usuarios/utils/social-links';
import {
  CreateClientePlanoInput,
  ListClientePlanoQuery,
  UpdateClientePlanoInput,
} from '@/modules/empresas/clientes/validators/clientes.schema';
import { calcularFim, isVigente } from '@/modules/empresas/shared/planos';

const includePlanoEmpresa = {
  include: {
    empresa: {
      select: {
        id: true,
        nomeCompleto: true,
        informacoes: {
          select: usuarioInformacoesSelect,
        },
        ...usuarioRedesSociaisSelect,
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

type EmpresasPlanoWithRelations = Prisma.EmpresasPlanoGetPayload<typeof includePlanoEmpresa>;

const sanitizeUndefined = <T>(value: T | undefined | null) =>
  value === undefined ? undefined : (value ?? null);

const ensureUsuarioEmpresa = async (usuarioId: string) => {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: usuarioId },
    select: { tipoUsuario: true },
  });

  if (!usuario || usuario.tipoUsuario !== TiposDeUsuarios.PESSOA_JURIDICA) {
    throw Object.assign(new Error('Usuário informado não é uma empresa válida'), {
      code: 'USUARIO_NAO_EMPRESA',
    });
  }
};

const transformarPlano = (plano: EmpresasPlanoWithRelations) => {
  const now = new Date();
  const estaVigente = isVigente(plano.status, plano.fim ?? null, now);
  const diasRestantes =
    plano.fim && plano.fim > now
      ? Math.ceil((plano.fim.getTime() - now.getTime()) / 86400000)
      : null;

  const empresaUsuarioRaw =
    plano.empresa && plano.empresa.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
      ? plano.empresa
      : null;
  const empresaUsuario = empresaUsuarioRaw
    ? attachEnderecoResumo(mergeUsuarioInformacoes(empresaUsuarioRaw))!
    : null;

  const empresa = empresaUsuario
    ? {
        id: empresaUsuario.id,
        nome: empresaUsuario.nomeCompleto,
        avatarUrl: empresaUsuario.avatarUrl,
        cidade: empresaUsuario.cidade,
        estado: empresaUsuario.estado,
        descricao: empresaUsuario.descricao,
        socialLinks: mapSocialLinks(empresaUsuario.redesSociais),
        codUsuario: empresaUsuario.codUsuario,
        enderecos: empresaUsuario.enderecos,
        informacoes: empresaUsuario.informacoes,
      }
    : null;

  const { empresa: _empresa, ...restoPlano } = plano;

  return {
    ...restoPlano,
    empresa,
    modo: plano.modo,
    status: plano.status,
    estaVigente,
    diasRestantes: diasRestantes !== null && diasRestantes < 0 ? 0 : diasRestantes,
  };
};

const buildWhere = (filters: ListClientePlanoQuery): Prisma.EmpresasPlanoWhereInput => {
  const where: Prisma.EmpresasPlanoWhereInput = {};

  if (filters.usuarioId) {
    where.usuarioId = filters.usuarioId;
  }

  if (filters.status !== undefined) {
    // Accept both enum and string
    where.status = filters.status as any;
  }

  return where;
};

export const clientesService = {
  list: async (filters: ListClientePlanoQuery) => {
    const planos = await prisma.empresasPlano.findMany({
      where: buildWhere(filters),
      orderBy: { criadoEm: 'desc' },
      ...includePlanoEmpresa,
    });

    return planos.map((plano) => transformarPlano(plano));
  },

  get: async (id: string) => {
    const plano = await prisma.empresasPlano.findUnique({ where: { id }, ...includePlanoEmpresa });
    return plano ? transformarPlano(plano) : null;
  },

  findActiveByUsuario: async (usuarioId: string) => {
    await ensureUsuarioEmpresa(usuarioId);
    const now = new Date();
    const plano = await prisma.empresasPlano.findFirst({
      where: {
        usuarioId,
        status: EmpresasPlanoStatus.ATIVO,
        OR: [{ fim: null }, { fim: { gt: now } }],
      },
      orderBy: { inicio: 'desc' },
      include: { plano: true },
    });

    if (!plano) return null;

    return {
      ...plano,
      modo: plano.modo,
    };
  },

  assign: async (data: CreateClientePlanoInput) => {
    await ensureUsuarioEmpresa(data.usuarioId);
    const inicio = data.iniciarEm ?? new Date();
    const modo = data.modo as EmpresasPlanoModo;
    const fim = calcularFim(modo, inicio, sanitizeUndefined<number>(data.diasTeste) ?? undefined);
    const status = EmpresasPlanoStatus.ATIVO;

    const plano = await prisma.$transaction(async (tx) => {
      await tx.empresasPlano.updateMany({
        where: { usuarioId: data.usuarioId, status: EmpresasPlanoStatus.ATIVO },
        data: { status: EmpresasPlanoStatus.CANCELADO, fim: new Date() },
      });

      return tx.empresasPlano.create({
        data: {
          usuarioId: data.usuarioId,
          planosEmpresariaisId: data.planosEmpresariaisId,
          modo,
          status,
          origin: 'ADMIN',
          inicio,
          fim,
        },
        ...includePlanoEmpresa,
      });
    });

    return transformarPlano(plano);
  },

  update: async (id: string, data: UpdateClientePlanoInput) => {
    const planoAtual = await prisma.empresasPlano.findUnique({ where: { id } });

    if (!planoAtual) {
      throw Object.assign(new Error('Plano da empresa não encontrado'), {
        code: 'EMPRESAS_PLANO_NOT_FOUND',
      });
    }

    const updates: Prisma.EmpresasPlanoUpdateInput = {};

    if (data.planosEmpresariaisId !== undefined) {
      updates.plano = { connect: { id: data.planosEmpresariaisId } };
    }

    let inicio = planoAtual.inicio ?? null;
    if (data.iniciarEm !== undefined) {
      inicio = data.iniciarEm;
      updates.inicio = inicio;
    }

    let modo = planoAtual.modo;
    if (data.modo !== undefined) {
      modo = data.modo as EmpresasPlanoModo;
      updates.modo = modo;
      // Ajusta status automaticamente para testes/parceiro
      if (modo === EmpresasPlanoModo.TESTE || modo === EmpresasPlanoModo.PARCEIRO) {
        updates.status = EmpresasPlanoStatus.ATIVO;
      }
    }

    if (data.modo !== undefined || data.iniciarEm !== undefined || data.diasTeste !== undefined) {
      updates.fim = calcularFim(
        modo,
        inicio,
        sanitizeUndefined<number>(data.diasTeste) ?? undefined,
      );
    }

    const plano = await prisma.empresasPlano.update({
      where: { id },
      data: updates,
      ...includePlanoEmpresa,
    });
    return transformarPlano(plano);
  },

  deactivate: async (id: string) => {
    const planoAtual = await prisma.empresasPlano.findUnique({ where: { id } });

    if (!planoAtual) {
      throw Object.assign(new Error('Plano da empresa não encontrado'), {
        code: 'EMPRESAS_PLANO_NOT_FOUND',
      });
    }

    const fim = planoAtual.fim && planoAtual.fim < new Date() ? planoAtual.fim : new Date();

    await prisma.empresasPlano.update({
      where: { id },
      data: { status: EmpresasPlanoStatus.CANCELADO, fim },
    });
  },
};

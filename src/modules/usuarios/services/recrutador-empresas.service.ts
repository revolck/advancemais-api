import { prisma } from '@/config/prisma';
import { Roles, Status } from '@prisma/client';

export class RecrutadorEmpresasForbiddenError extends Error {
  status = 403 as const;
  code = 'RECRUTADOR_EMPRESA_FORBIDDEN' as const;
}

export class RecrutadorEmpresaNotFoundError extends Error {
  status = 404 as const;
  code = 'EMPRESA_NOT_FOUND' as const;
}

const unique = (values: string[]) => Array.from(new Set(values));

const recruiterCompanySelect = {
  id: true,
  nomeCompleto: true,
  email: true,
  cnpj: true,
  status: true,
  codUsuario: true,
  UsuariosInformation: {
    select: {
      telefone: true,
      avatarUrl: true,
    },
  },
  UsuariosEnderecos: {
    orderBy: { criadoEm: 'asc' as const },
    take: 1,
    select: {
      cidade: true,
      estado: true,
      cep: true,
      bairro: true,
      logradouro: true,
    },
  },
} as const;

type RecruiterCompanyRecord = {
  id: string;
  nomeCompleto: string;
  email: string;
  cnpj: string | null;
  status: Status;
  codUsuario: string;
  UsuariosInformation: {
    telefone: string | null;
    avatarUrl: string | null;
  } | null;
  UsuariosEnderecos: {
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    bairro: string | null;
    logradouro: string | null;
  }[];
};

const mapRecruiterEmpresaListItem = (empresa: RecruiterCompanyRecord) => ({
  id: empresa.id,
  nome: empresa.nomeCompleto,
  nomeExibicao: empresa.nomeCompleto,
  email: empresa.email,
  cnpj: empresa.cnpj ?? null,
  cidade: empresa.UsuariosEnderecos[0]?.cidade ?? null,
  estado: empresa.UsuariosEnderecos[0]?.estado ?? null,
  cep: empresa.UsuariosEnderecos[0]?.cep ?? null,
  bairro: empresa.UsuariosEnderecos[0]?.bairro ?? null,
  logradouro: empresa.UsuariosEnderecos[0]?.logradouro ?? null,
  codUsuario: empresa.codUsuario,
  avatarUrl: empresa.UsuariosInformation?.avatarUrl ?? null,
  telefone: empresa.UsuariosInformation?.telefone ?? null,
  status: empresa.status,
});

export const recrutadorEmpresasService = {
  listDirectEmpresaUsuarioIds: async (recrutadorId: string): Promise<string[]> => {
    const rows = await prisma.usuariosEmpresasVinculos.findMany({
      where: { recrutadorId },
      select: { empresaUsuarioId: true },
    });

    return rows.map((row) => row.empresaUsuarioId);
  },

  listEmpresaUsuarioIds: async (recrutadorId: string): Promise<string[]> => {
    const [directEmpresaRows, empresasFromVagasRows] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findMany({
        where: { recrutadorId },
        select: { empresaUsuarioId: true },
      }),
      prisma.empresasVagas.findMany({
        where: {
          UsuariosVagasVinculos: {
            some: { recrutadorId },
          },
        },
        distinct: ['usuarioId'],
        select: { usuarioId: true },
      }),
    ]);

    return unique([
      ...directEmpresaRows.map((row) => row.empresaUsuarioId),
      ...empresasFromVagasRows.map((row) => row.usuarioId),
    ]);
  },

  assertVinculo: async (recrutadorId: string, empresaUsuarioId: string): Promise<void> => {
    const [directCompanyLink, companyFromVagaLink] = await prisma.$transaction([
      prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId,
            empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
      prisma.usuariosVagasVinculos.findFirst({
        where: {
          recrutadorId,
          EmpresasVagas: {
            usuarioId: empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!directCompanyLink && !companyFromVagaLink) {
      throw new RecrutadorEmpresasForbiddenError(
        'Acesso negado: recrutador não vinculado à empresa',
      );
    }
  },

  ensureEmpresa: async (empresaUsuarioId: string) => {
    const empresa = await prisma.usuarios.findUnique({
      where: { id: empresaUsuarioId },
      select: {
        role: true,
        ...recruiterCompanySelect,
      },
    });

    if (!empresa || empresa.role !== Roles.EMPRESA) {
      throw new RecrutadorEmpresaNotFoundError('Empresa não encontrada');
    }

    return empresa;
  },

  listEmpresas: async (recrutadorId: string) => {
    const empresaUsuarioIds = await recrutadorEmpresasService.listEmpresaUsuarioIds(recrutadorId);
    if (empresaUsuarioIds.length === 0) {
      return [];
    }

    return prisma.usuarios.findMany({
      where: {
        id: { in: empresaUsuarioIds },
        role: Roles.EMPRESA,
      },
      orderBy: { nomeCompleto: 'asc' },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cnpj: true,
        status: true,
        codUsuario: true,
        UsuariosInformation: { select: { telefone: true, avatarUrl: true, descricao: true } },
        UsuariosEnderecos: {
          orderBy: { criadoEm: 'asc' },
          take: 1,
          select: { cidade: true, estado: true, cep: true, bairro: true, logradouro: true },
        },
      },
    });
  },

  listForDashboard: async (recrutadorId: string) => {
    const empresas = await recrutadorEmpresasService.listEmpresas(recrutadorId);
    return empresas.map(mapRecruiterEmpresaListItem);
  },

  getForDashboard: async (recrutadorId: string, empresaUsuarioId: string) => {
    const [empresa, directCompanyLink, companyFromVagaLink] = await Promise.all([
      recrutadorEmpresasService.ensureEmpresa(empresaUsuarioId),
      prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId,
            empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
      prisma.usuariosVagasVinculos.findFirst({
        where: {
          recrutadorId,
          EmpresasVagas: {
            usuarioId: empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!directCompanyLink && !companyFromVagaLink) {
      throw new RecrutadorEmpresasForbiddenError('Você não possui acesso a esta empresa.');
    }

    return {
      empresa: mapRecruiterEmpresaListItem(empresa),
      possuiVinculoEmpresa: Boolean(directCompanyLink),
    };
  },

  link: async (params: {
    recrutadorId: string;
    empresaUsuarioId: string;
    criadoPor?: string | null;
  }) => {
    const [recrutador, empresa] = await prisma.$transaction([
      prisma.usuarios.findUnique({
        where: { id: params.recrutadorId },
        select: { id: true, role: true },
      }),
      prisma.usuarios.findUnique({
        where: { id: params.empresaUsuarioId },
        select: { id: true, role: true },
      }),
    ]);

    if (!recrutador || recrutador.role !== Roles.RECRUTADOR) {
      throw Object.assign(new Error('Recrutador não encontrado'), {
        status: 404,
        code: 'RECRUTADOR_NOT_FOUND',
      });
    }

    if (!empresa || empresa.role !== Roles.EMPRESA) {
      throw Object.assign(new Error('Empresa não encontrada'), {
        status: 404,
        code: 'EMPRESA_NOT_FOUND',
      });
    }

    const vinculo = await prisma.usuariosEmpresasVinculos.upsert({
      where: {
        recrutadorId_empresaUsuarioId: {
          recrutadorId: params.recrutadorId,
          empresaUsuarioId: params.empresaUsuarioId,
        },
      },
      create: {
        recrutadorId: params.recrutadorId,
        empresaUsuarioId: params.empresaUsuarioId,
      },
      update: {
        atualizadoEm: new Date(),
      },
      select: {
        id: true,
        recrutadorId: true,
        empresaUsuarioId: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });

    return vinculo;
  },

  unlink: async (params: { recrutadorId: string; empresaUsuarioId: string }) => {
    await prisma.usuariosEmpresasVinculos.deleteMany({
      where: { recrutadorId: params.recrutadorId, empresaUsuarioId: params.empresaUsuarioId },
    });
  },
};

import { prisma } from '@/config/prisma';
import { Roles } from '@prisma/client';

export class RecrutadorEmpresasForbiddenError extends Error {
  status = 403 as const;
  code = 'RECRUTADOR_EMPRESA_FORBIDDEN' as const;
}

export const recrutadorEmpresasService = {
  listEmpresaUsuarioIds: async (recrutadorId: string): Promise<string[]> => {
    const rows = await prisma.usuariosEmpresasVinculos.findMany({
      where: { recrutadorId },
      select: { empresaUsuarioId: true },
    });

    return rows.map((row) => row.empresaUsuarioId);
  },

  assertVinculo: async (recrutadorId: string, empresaUsuarioId: string): Promise<void> => {
    const vinculo = await prisma.usuariosEmpresasVinculos.findUnique({
      where: {
        recrutadorId_empresaUsuarioId: {
          recrutadorId,
          empresaUsuarioId,
        },
      },
      select: { id: true },
    });

    if (!vinculo) {
      throw new RecrutadorEmpresasForbiddenError(
        'Acesso negado: recrutador não vinculado à empresa',
      );
    }
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

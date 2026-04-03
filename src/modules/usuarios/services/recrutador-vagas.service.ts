import { prisma } from '@/config/prisma';
import { Roles, StatusDeVagas } from '@prisma/client';
import { recrutadorEmpresasService } from './recrutador-empresas.service';

export class RecrutadorVagaForbiddenError extends Error {
  status = 403 as const;
  code = 'RECRUTADOR_VAGA_FORBIDDEN' as const;
}

const unique = (values: string[]) => Array.from(new Set(values));

const OPERABLE_VAGA_FILTER = {
  not: StatusDeVagas.RASCUNHO,
} as const;

export const recrutadorVagasService = {
  listDirectVagaIds: async (recrutadorId: string): Promise<string[]> => {
    const rows = await prisma.usuariosVagasVinculos.findMany({
      where: { recrutadorId },
      select: { vagaId: true },
    });
    return rows.map((row) => row.vagaId);
  },

  listVagaIds: async (recrutadorId: string): Promise<string[]> => {
    const [directVagaRows, directEmpresaIds] = await prisma.$transaction([
      prisma.usuariosVagasVinculos.findMany({
        where: { recrutadorId },
        select: { vagaId: true },
      }),
      prisma.usuariosEmpresasVinculos.findMany({
        where: { recrutadorId },
        select: { empresaUsuarioId: true },
      }),
    ]);

    const companyScopedVagas =
      directEmpresaIds.length === 0
        ? []
        : await prisma.empresasVagas.findMany({
            where: {
              usuarioId: { in: directEmpresaIds.map((row) => row.empresaUsuarioId) },
              status: OPERABLE_VAGA_FILTER,
            },
            select: { id: true },
          });

    return unique([
      ...directVagaRows.map((row) => row.vagaId),
      ...companyScopedVagas.map((row) => row.id),
    ]);
  },

  listVagaIdsByEmpresa: async (recrutadorId: string, empresaUsuarioId: string) => {
    const [directVagaRows, directCompanyLink] = await prisma.$transaction([
      prisma.usuariosVagasVinculos.findMany({
        where: {
          recrutadorId,
          EmpresasVagas: { usuarioId: empresaUsuarioId },
        },
        select: { vagaId: true },
      }),
      prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId,
            empresaUsuarioId,
          },
        },
        select: { id: true },
      }),
    ]);

    const companyScopedVagas = !directCompanyLink
      ? []
      : await prisma.empresasVagas.findMany({
          where: {
            usuarioId: empresaUsuarioId,
            status: OPERABLE_VAGA_FILTER,
          },
          select: { id: true },
        });

    return unique([
      ...directVagaRows.map((row) => row.vagaId),
      ...companyScopedVagas.map((row) => row.id),
    ]);
  },

  assertVinculo: async (recrutadorId: string, vagaId: string) => {
    const [directVagaLink, vaga] = await prisma.$transaction([
      prisma.usuariosVagasVinculos.findUnique({
        where: { recrutadorId_vagaId: { recrutadorId, vagaId } },
        select: { id: true },
      }),
      prisma.empresasVagas.findUnique({
        where: { id: vagaId },
        select: { id: true, usuarioId: true },
      }),
    ]);

    if (directVagaLink) {
      return;
    }

    if (vaga) {
      const companyLink = await prisma.usuariosEmpresasVinculos.findUnique({
        where: {
          recrutadorId_empresaUsuarioId: {
            recrutadorId,
            empresaUsuarioId: vaga.usuarioId,
          },
        },
        select: { id: true },
      });

      if (companyLink) {
        return;
      }
    }

    throw new RecrutadorVagaForbiddenError('Acesso negado: recrutador não vinculado à vaga');
  },

  listEmpresasFromVagas: async (recrutadorId: string) => {
    const empresaUsuarioIds = await recrutadorEmpresasService.listEmpresaUsuarioIds(recrutadorId);
    if (empresaUsuarioIds.length === 0) return [];

    return prisma.usuarios.findMany({
      where: { id: { in: empresaUsuarioIds }, role: Roles.EMPRESA },
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

  link: async (params: { recrutadorId: string; vagaId: string }) => {
    const [recrutador, vaga] = await prisma.$transaction([
      prisma.usuarios.findUnique({
        where: { id: params.recrutadorId },
        select: { id: true, role: true },
      }),
      prisma.empresasVagas.findUnique({
        where: { id: params.vagaId },
        select: { id: true, usuarioId: true },
      }),
    ]);

    if (!recrutador || recrutador.role !== Roles.RECRUTADOR) {
      throw Object.assign(new Error('Recrutador não encontrado'), {
        status: 404,
        code: 'RECRUTADOR_NOT_FOUND',
      });
    }

    if (!vaga) {
      throw Object.assign(new Error('Vaga não encontrada'), {
        status: 404,
        code: 'VAGA_NOT_FOUND',
      });
    }

    await recrutadorEmpresasService.assertVinculo(params.recrutadorId, vaga.usuarioId);

    return prisma.usuariosVagasVinculos.upsert({
      where: { recrutadorId_vagaId: { recrutadorId: params.recrutadorId, vagaId: params.vagaId } },
      create: { recrutadorId: params.recrutadorId, vagaId: params.vagaId },
      update: { atualizadoEm: new Date() },
      select: { id: true, recrutadorId: true, vagaId: true, criadoEm: true, atualizadoEm: true },
    });
  },

  unlink: async (params: { recrutadorId: string; vagaId: string }) => {
    await prisma.usuariosVagasVinculos.deleteMany({
      where: { recrutadorId: params.recrutadorId, vagaId: params.vagaId },
    });
  },
};

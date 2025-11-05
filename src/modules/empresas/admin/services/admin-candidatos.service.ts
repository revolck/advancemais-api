import type { Prisma } from '@prisma/client';
import { Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import {
  buildCandidatoSelect,
  mapCandidatoDetalhe,
} from '@/modules/candidatos/candidaturas/utils/candidatos-overview-mapper';

import type { AdminCandidatosListQuery } from '@/modules/empresas/admin/validators/admin-candidatos.schema';
type AdminCandidatoDetalhe = ReturnType<typeof mapCandidatoDetalhe>;

const buildWhere = ({ status, search }: AdminCandidatosListQuery): Prisma.UsuariosWhereInput => {
  const where: Prisma.UsuariosWhereInput = {
    role: Roles.ALUNO_CANDIDATO,
    UsuariosCurriculos: { some: {} },
  };

  if (status && status.length > 0) {
    where.status = { in: status };
  }

  if (search) {
    where.OR = [
      { nomeCompleto: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search, mode: 'insensitive' } },
      { codUsuario: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
};

const buildPagination = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

export const adminCandidatosService = {
  list: async (params: AdminCandidatosListQuery) => {
    const { page, pageSize } = params;
    const where = buildWhere(params);
    const skip = (page - 1) * pageSize;

    const [total, candidatos] = await prisma.$transaction([
      prisma.usuarios.count({ where }),
      prisma.usuarios.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
        select: buildCandidatoSelect(),
      }),
    ]);

    const data = candidatos
      .map((candidato) => mapCandidatoDetalhe(candidato))
      .filter((item): item is NonNullable<AdminCandidatoDetalhe> => item !== null);

    return {
      data,
      pagination: buildPagination(page, pageSize, total),
    };
  },

  get: async (id: string) => {
    const candidato = await prisma.usuarios.findFirst({
      where: {
        id,
        role: Roles.ALUNO_CANDIDATO,
        UsuariosCurriculos: { some: {} },
      },
      select: buildCandidatoSelect(),
    });

    return candidato ? mapCandidatoDetalhe(candidato) : null;
  },
};

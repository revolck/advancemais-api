import { Prisma, StatusDeVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';

type SyncExpiredPublishedVagasParams = {
  now?: Date;
  empresaUsuarioIds?: string[];
  vagaIds?: string[];
};

const sanitizeIds = (ids?: string[]) => ids?.map((id) => id.trim()).filter(Boolean) ?? [];

const buildWhere = (
  params?: SyncExpiredPublishedVagasParams,
  now: Date = new Date(),
): Prisma.EmpresasVagasWhereInput => {
  const empresaUsuarioIds = sanitizeIds(params?.empresaUsuarioIds);
  const vagaIds = sanitizeIds(params?.vagaIds);

  const and: Prisma.EmpresasVagasWhereInput[] = [
    {
      status: StatusDeVagas.PUBLICADO,
      inscricoesAte: { lt: now },
    },
  ];

  if (empresaUsuarioIds.length > 0) {
    and.push({ usuarioId: { in: empresaUsuarioIds } });
  }

  if (vagaIds.length > 0) {
    and.push({ id: { in: vagaIds } });
  }

  return and.length === 1 ? and[0] : { AND: and };
};

export const syncExpiredPublishedVagas = async (params?: SyncExpiredPublishedVagasParams) => {
  const now = params?.now ?? new Date();

  return prisma.empresasVagas.updateMany({
    where: buildWhere(params, now),
    data: {
      status: StatusDeVagas.EXPIRADO,
      atualizadoEm: now,
    },
  });
};

import { Prisma, StatusDeVagas } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { avisosDaVaga } from '@/modules/empresas/vagas/utils/avisos-vaga';
import { registrarHistoricoVaga } from '@/modules/empresas/vagas/utils/historico-vaga';

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

/**
 * Publicadas com prazo de inscrições vencido → EXPIRADO. Uma a uma, para avisar a empresa
 * e registrar no histórico só quem de fato expirou nesta execução (se duas execuções
 * rodarem juntas, só uma consegue mudar cada vaga, e só ela avisa).
 */
export const syncExpiredPublishedVagas = async (params?: SyncExpiredPublishedVagasParams) => {
  const now = params?.now ?? new Date();

  const vencidas = await prisma.empresasVagas.findMany({
    where: buildWhere(params, now),
    select: { id: true, usuarioId: true, titulo: true },
  });

  let count = 0;
  for (const vaga of vencidas) {
    const { count: mudou } = await prisma.empresasVagas.updateMany({
      where: { id: vaga.id, status: StatusDeVagas.PUBLICADO },
      data: { status: StatusDeVagas.EXPIRADO, atualizadoEm: now },
    });
    if (mudou === 0) continue;
    count += 1;
    await registrarHistoricoVaga({
      vagaId: vaga.id,
      acao: 'VAGA_EXPIRADA',
      descricao: 'Prazo de inscrições terminou: vaga expirada automaticamente',
      de: StatusDeVagas.PUBLICADO,
      para: StatusDeVagas.EXPIRADO,
    });
    await avisosDaVaga.expirada(vaga);
  }

  return { count };
};

import { Prisma } from '@prisma/client';

import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';
import { ProvaWithModulo, mapProva, provaDefaultInclude } from './provas.mapper';

export const moduloDetailedInclude =
  Prisma.validator<Prisma.CursosTurmasModulosDefaultArgs>()({
    include: {
      aulas: {
        ...aulaWithMateriaisInclude.include,
        orderBy: [
          { ordem: 'asc' },
          { criadoEm: 'asc' },
        ],
      },
      provas: {
        ...provaDefaultInclude.include,
        orderBy: [
          { ordem: 'asc' },
          { criadoEm: 'asc' },
        ],
      },
    },
  });

export type ModuloWithRelations = Prisma.CursosTurmasModulosGetPayload<typeof moduloDetailedInclude>;

export const mapModulo = (modulo: ModuloWithRelations) => {
  const aulas = (modulo.aulas ?? []) as unknown as AulaWithMateriais[];
  const provas = (modulo.provas ?? []) as unknown as ProvaWithModulo[];

  return {
  id: modulo.id,
  turmaId: modulo.turmaId,
  nome: modulo.nome,
  descricao: modulo.descricao ?? null,
  obrigatorio: modulo.obrigatorio,
  ordem: modulo.ordem,
  criadoEm: modulo.criadoEm.toISOString(),
  atualizadoEm: modulo.atualizadoEm.toISOString(),
  aulas: aulas.map(mapAula),
  provas: provas.map(mapProva),
};
};

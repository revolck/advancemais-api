import { Prisma } from '@prisma/client';

import { aulaWithMateriaisInclude, mapAula } from './aulas.mapper';
import { mapProva, provaDefaultInclude } from './provas.mapper';

export const moduloDetailedInclude = {
  include: {
    aulas: {
      ...aulaWithMateriaisInclude.include,
      orderBy: [
        { ordem: 'asc' as const },
        { criadoEm: 'asc' as const },
      ],
    },
    provas: {
      ...provaDefaultInclude.include,
      orderBy: [
        { ordem: 'asc' as const },
        { criadoEm: 'asc' as const },
      ],
    },
  },
} as const;

export type ModuloWithRelations = Prisma.CursosTurmasModulosGetPayload<typeof moduloDetailedInclude>;

export const mapModulo = (modulo: ModuloWithRelations) => ({
  id: modulo.id,
  turmaId: modulo.turmaId,
  nome: modulo.nome,
  descricao: modulo.descricao ?? null,
  obrigatorio: modulo.obrigatorio,
  ordem: modulo.ordem,
  criadoEm: modulo.criadoEm.toISOString(),
  atualizadoEm: modulo.atualizadoEm.toISOString(),
  aulas: modulo.aulas?.map(mapAula) ?? [],
  provas: modulo.provas?.map(mapProva) ?? [],
});

import { Prisma } from '@prisma/client';

import { AulaWithMateriais, aulaWithMateriaisInclude, mapAula } from './aulas.mapper';
import { ProvaWithRelations, mapProva, provaDefaultInclude } from './provas.mapper';

export const moduloDetailedInclude = Prisma.validator<Prisma.CursosTurmasModulosDefaultArgs>()({
  include: {
    CursosTurmasAulas: {
      include: aulaWithMateriaisInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasProvas: {
      include: provaDefaultInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
  },
});

export type ModuloWithRelations = Prisma.CursosTurmasModulosGetPayload<
  typeof moduloDetailedInclude
>;

export const mapModulo = (modulo: ModuloWithRelations) => {
  const aulas = ((modulo as any).CursosTurmasAulas ||
    (modulo as any).aulas ||
    []) as unknown as AulaWithMateriais[];
  const provas = ((modulo as any).CursosTurmasProvas ||
    (modulo as any).provas ||
    []) as unknown as ProvaWithRelations[];

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

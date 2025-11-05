import { Prisma } from '@prisma/client';

export const aulaWithMateriaisInclude = Prisma.validator<Prisma.CursosTurmasAulasDefaultArgs>()({
  include: {
    CursosTurmasAulasMateriais: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
  },
});

export type AulaWithMateriais = Prisma.CursosTurmasAulasGetPayload<typeof aulaWithMateriaisInclude>;

export const mapMaterial = (material: any) => ({
  id: material.id,
  aulaId: material.aulaId,
  titulo: material.titulo,
  descricao: material.descricao ?? null,
  tipo: material.tipo,
  tipoArquivo: material.tipoArquivo ?? null,
  url: material.url ?? null,
  duracaoEmSegundos: material.duracaoEmSegundos ?? null,
  tamanhoEmBytes: material.tamanhoEmBytes ?? null,
  ordem: material.ordem,
  criadoEm: material.criadoEm.toISOString(),
  atualizadoEm: material.atualizadoEm.toISOString(),
});

export const mapAula = (aula: AulaWithMateriais) => ({
  id: aula.id,
  moduloId: aula.moduloId ?? null,
  nome: aula.nome,
  descricao: aula.descricao ?? null,
  ordem: aula.ordem,
  urlVideo: aula.urlVideo ?? null,
  sala: aula.sala ?? null,
  urlMeet: aula.urlMeet ?? null,
  criadoEm: aula.criadoEm.toISOString(),
  atualizadoEm: aula.atualizadoEm.toISOString(),
  materiais: ((aula as any).CursosTurmasAulasMateriais || aula.materiais || []).map(mapMaterial),
});

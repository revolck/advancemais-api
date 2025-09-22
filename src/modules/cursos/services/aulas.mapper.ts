import { Prisma } from '@prisma/client';

export const aulaWithMateriaisInclude = {
  include: {
    materiais: {
      orderBy: [
        { ordem: 'asc' },
        { criadoEm: 'asc' },
      ],
    },
  },
} as const;

export type AulaWithMateriais = Prisma.CursosTurmasAulasGetPayload<typeof aulaWithMateriaisInclude>;

export const mapMaterial = (material: AulaWithMateriais['materiais'][number]) => ({
  id: material.id,
  aulaId: material.aulaId,
  titulo: material.titulo,
  descricao: material.descricao,
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
  turmaId: aula.turmaId,
  nome: aula.nome,
  descricao: aula.descricao,
  ordem: aula.ordem,
  criadoEm: aula.criadoEm.toISOString(),
  atualizadoEm: aula.atualizadoEm.toISOString(),
  materiais: aula.materiais.map(mapMaterial),
});

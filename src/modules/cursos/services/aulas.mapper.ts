import { Prisma } from '@prisma/client';

export const aulaWithMateriaisInclude = Prisma.validator<Prisma.CursosTurmasAulasDefaultArgs>()({
  include: {
    CursosTurmasAulasMateriais: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
  },
});

export type AulaWithMateriais = Prisma.CursosTurmasAulasGetPayload<typeof aulaWithMateriaisInclude>;

const mapModalidadeFromDb = (modalidade: string | null | undefined) => {
  if (!modalidade) return null;
  if (modalidade === 'LIVE') return 'AO_VIVO';
  return modalidade;
};

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
  codigo: (aula as any).codigo ?? null,
  cursoId: (aula as any).cursoId ?? null,
  turmaId: (aula as any).turmaId ?? null,
  moduloId: aula.moduloId ?? null,
  titulo: aula.nome,
  nome: aula.nome,
  descricao: aula.descricao ?? null,
  ordem: aula.ordem,
  modalidade: mapModalidadeFromDb((aula as any).modalidade) ?? null,
  status: (aula as any).status ?? null,
  obrigatoria: (aula as any).obrigatoria ?? null,
  duracaoMinutos: (aula as any).duracaoMinutos ?? null,
  urlVideo: aula.urlVideo ?? null,
  sala: aula.sala ?? null,
  urlMeet: aula.urlMeet ?? null,
  meetEventId: (aula as any).meetEventId ?? null,
  dataInicio: (aula as any).dataInicio ? (aula as any).dataInicio.toISOString() : null,
  dataFim: (aula as any).dataFim ? (aula as any).dataFim.toISOString() : null,
  horaInicio: (aula as any).horaInicio ?? null,
  horaFim: (aula as any).horaFim ?? null,
  gravarAula: (aula as any).gravarAula ?? null,
  linkGravacao: (aula as any).linkGravacao ?? null,
  duracaoGravacao: (aula as any).duracaoGravacao ?? null,
  statusGravacao: (aula as any).statusGravacao ?? null,
  instrutorId: (aula as any).instrutorId ?? null,
  criadoPorId: (aula as any).criadoPorId ?? null,
  criadoEm: aula.criadoEm.toISOString(),
  atualizadoEm: aula.atualizadoEm.toISOString(),
  materiais: ((aula as any).CursosTurmasAulasMateriais || []).map(mapMaterial),
});

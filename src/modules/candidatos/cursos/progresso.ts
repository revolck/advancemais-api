type ProgressoCursoInput = {
  aulaIds: string[];
  avaliacaoIds: string[];
  aulaProgressoIds: string[];
  aulaPresencaIds: string[];
  avaliacaoRespondidaIds: string[];
};

export const calcularProgressoCurso = ({
  aulaIds,
  avaliacaoIds,
  aulaProgressoIds,
  aulaPresencaIds,
  avaliacaoRespondidaIds,
}: ProgressoCursoInput) => {
  const aulasValidas = new Set(aulaIds);
  const avaliacoesValidas = new Set(avaliacaoIds);
  const aulasConcluidas = new Set([...aulaProgressoIds, ...aulaPresencaIds]);

  const totalItens = aulasValidas.size + avaliacoesValidas.size;
  const itensConcluidos =
    [...aulasConcluidas].filter((id) => aulasValidas.has(id)).length +
    [...new Set(avaliacaoRespondidaIds)].filter((id) => avaliacoesValidas.has(id)).length;

  return {
    totalItens,
    itensConcluidos,
    percentual:
      totalItens > 0 ? Math.round(Math.min(100, (itensConcluidos / totalItens) * 100)) : 0,
  };
};

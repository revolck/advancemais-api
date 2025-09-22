import { CursosModelosRecuperacao } from '@prisma/client';

export enum CursosFinalStatus {
  EM_ANALISE = 'Em análise',
  APROVADO = 'Aprovado',
  REPROVADO = 'Reprovado',
}

export enum CursosModelosDeRecuperacao {
  SUBSTITUI_MENOR = 'substitui_menor',
  MEDIA_MINIMA_DIRETA = 'media_minima_direta',
  PROVA_FINAL_UNICA = 'prova_final_unica',
  NOTA_MAXIMA_LIMITADA = 'nota_maxima_limitada',
}

export type CursosPoliticaDeRecuperacao = {
  habilitada: boolean;
  modelos: CursosModelosDeRecuperacao[];
  ordemAplicacao?: CursosModelosDeRecuperacao[];
  notaMaxima?: number | null;
  pesoProvaFinal?: number | null;
};

export type CursosRegrasDeProvas = {
  mediaMinima: number;
  politicaRecuperacao: CursosPoliticaDeRecuperacao;
};

export type CursosReferenciasDeProvas = {
  id: string;
  etiqueta: string;
  peso: number;
  nota: number | null;
};

export type ResultadoModeloRecuperacao = {
  aplicado: boolean;
  novaMedia?: number | null;
  notaConsiderada?: number | null;
  status?: CursosFinalStatus;
  detalhes?: string;
};

export type ResultadoAplicacaoRecuperacao = {
  provas: CursosReferenciasDeProvas[];
  media: number | null;
  status: CursosFinalStatus;
  notaRecuperacao?: number | null;
  modelos: Partial<Record<CursosModelosDeRecuperacao, ResultadoModeloRecuperacao>>;
};

const round = (value: number, precision = 2) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const normalizarPeso = (provas: CursosReferenciasDeProvas[]) => {
  const pesos = provas.map((prova) => Math.max(prova.peso, 0));
  const total = pesos.reduce((acc, peso) => acc + peso, 0);
  return total > 0 ? total : 0;
};

export const computeInitialAverage = (provas: CursosReferenciasDeProvas[]): number | null => {
  const provasValidas = provas.filter((prova) => prova.nota !== null && prova.peso > 0);
  if (provasValidas.length === 0) {
    return null;
  }

  const somaPesos = provasValidas.reduce((acc, prova) => acc + prova.peso, 0);
  if (somaPesos === 0) {
    return null;
  }

  const somaNotas = provasValidas.reduce((acc, prova) => acc + (prova.nota ?? 0) * prova.peso, 0);
  return round(somaNotas / somaPesos, 2);
};

const mapModeloEnum = (modelo: CursosModelosRecuperacao): CursosModelosDeRecuperacao => {
  switch (modelo) {
    case CursosModelosRecuperacao.SUBSTITUI_MENOR:
      return CursosModelosDeRecuperacao.SUBSTITUI_MENOR;
    case CursosModelosRecuperacao.MEDIA_MINIMA_DIRETA:
      return CursosModelosDeRecuperacao.MEDIA_MINIMA_DIRETA;
    case CursosModelosRecuperacao.PROVA_FINAL_UNICA:
      return CursosModelosDeRecuperacao.PROVA_FINAL_UNICA;
    case CursosModelosRecuperacao.NOTA_MAXIMA_LIMITADA:
      return CursosModelosDeRecuperacao.NOTA_MAXIMA_LIMITADA;
    default:
      return modelo as unknown as CursosModelosDeRecuperacao;
  }
};

export const traduzirModelosPrisma = (
  modelos: CursosModelosRecuperacao[] | null | undefined,
): CursosModelosDeRecuperacao[] => {
  if (!modelos || modelos.length === 0) {
    return [];
  }
  return modelos.map(mapModeloEnum);
};

export const applyRecoveryModels = (
  provas: CursosReferenciasDeProvas[],
  regras: CursosRegrasDeProvas,
  notaRecuperacao: number | null,
): ResultadoAplicacaoRecuperacao => {
  const modelosAplicacao = regras.politicaRecuperacao.ordemAplicacao?.length
    ? regras.politicaRecuperacao.ordemAplicacao
    : regras.politicaRecuperacao.modelos;

  const modelosResultado: ResultadoAplicacaoRecuperacao['modelos'] = {};
  const registrarModelo = (
    modelo: CursosModelosDeRecuperacao,
    resultado: ResultadoModeloRecuperacao,
  ) => {
    modelosResultado[modelo] = resultado;
  };
  const provasOrdenadas = [...provas];
  let mediaAtual = computeInitialAverage(provasOrdenadas);
  let statusAtual = mediaAtual === null ? CursosFinalStatus.EM_ANALISE : CursosFinalStatus.REPROVADO;
  let notaAtualRecuperacao = notaRecuperacao;

  if (!regras.politicaRecuperacao.habilitada || notaRecuperacao === null) {
    return {
      provas: provasOrdenadas,
      media: mediaAtual,
      status: mediaAtual !== null && mediaAtual >= regras.mediaMinima ? CursosFinalStatus.APROVADO : statusAtual,
      notaRecuperacao,
      modelos: modelosResultado,
    };
  }

  const somaPesos = normalizarPeso(provasOrdenadas);

  for (const modelo of modelosAplicacao) {
    switch (modelo) {
      case CursosModelosDeRecuperacao.NOTA_MAXIMA_LIMITADA: {
        if (notaAtualRecuperacao !== null && regras.politicaRecuperacao.notaMaxima !== null && regras.politicaRecuperacao.notaMaxima !== undefined) {
          const limitada = Math.min(notaAtualRecuperacao, regras.politicaRecuperacao.notaMaxima);
          registrarModelo(modelo, {
            aplicado: true,
            notaConsiderada: round(limitada, 1),
            detalhes: 'Nota de recuperação limitada pelo teto configurado',
            status: statusAtual,
          });
          notaAtualRecuperacao = limitada;
        } else {
          registrarModelo(modelo, { aplicado: false });
        }
        break;
      }
      case CursosModelosDeRecuperacao.SUBSTITUI_MENOR: {
        if (notaAtualRecuperacao === null) {
          registrarModelo(modelo, { aplicado: false });
          break;
        }

        const provasComNotas = provasOrdenadas.filter((prova) => prova.nota !== null);
        if (provasComNotas.length === 0) {
          registrarModelo(modelo, { aplicado: false });
          break;
        }

        let indiceMenor = 0;
        let menorNota = provasComNotas[0].nota ?? 0;
        for (let i = 1; i < provasComNotas.length; i += 1) {
          const notaAtual = provasComNotas[i].nota ?? 0;
          if (notaAtual < menorNota) {
            menorNota = notaAtual;
            indiceMenor = i;
          }
        }

        const provaMenor = provasComNotas[indiceMenor];
        if (notaAtualRecuperacao > (provaMenor.nota ?? 0)) {
          const indiceGlobal = provasOrdenadas.findIndex((prova) => prova.id === provaMenor.id);
          if (indiceGlobal >= 0) {
            provasOrdenadas[indiceGlobal] = {
              ...provasOrdenadas[indiceGlobal],
              nota: round(notaAtualRecuperacao, 1),
            };
            mediaAtual = computeInitialAverage(provasOrdenadas);
            statusAtual = mediaAtual !== null && mediaAtual >= regras.mediaMinima ? CursosFinalStatus.APROVADO : CursosFinalStatus.EM_ANALISE;
            registrarModelo(modelo, {
              aplicado: true,
              novaMedia: mediaAtual,
              notaConsiderada: round(notaAtualRecuperacao, 1),
              status: statusAtual,
              detalhes: `Substituição da prova ${provaMenor.etiqueta}`,
            });
          }
        } else {
          registrarModelo(modelo, {
            aplicado: false,
            detalhes: 'Nota de recuperação não superou a menor nota existente',
          });
        }
        break;
      }
      case CursosModelosDeRecuperacao.MEDIA_MINIMA_DIRETA: {
        if (notaAtualRecuperacao === null) {
          registrarModelo(modelo, { aplicado: false });
          break;
        }

        if (notaAtualRecuperacao >= regras.mediaMinima) {
          mediaAtual = Math.max(mediaAtual ?? 0, notaAtualRecuperacao);
          statusAtual = CursosFinalStatus.APROVADO;
          registrarModelo(modelo, {
            aplicado: true,
            novaMedia: round(mediaAtual, 2),
            notaConsiderada: round(notaAtualRecuperacao, 1),
            status: statusAtual,
            detalhes: 'Nota de recuperação atingiu a média mínima para aprovação direta',
          });
        } else {
          registrarModelo(modelo, {
            aplicado: false,
            detalhes: 'Nota de recuperação abaixo da média mínima configurada',
          });
        }
        break;
      }
      case CursosModelosDeRecuperacao.PROVA_FINAL_UNICA: {
        if (notaAtualRecuperacao === null) {
          registrarModelo(modelo, { aplicado: false });
          break;
        }

        if (regras.politicaRecuperacao.pesoProvaFinal && regras.politicaRecuperacao.pesoProvaFinal > 0 && somaPesos > 0) {
          const pesoFinal = regras.politicaRecuperacao.pesoProvaFinal;
          const mediaAnterior = mediaAtual ?? computeInitialAverage(provasOrdenadas) ?? 0;
          const mediaCombinada = (mediaAnterior * somaPesos + notaAtualRecuperacao * pesoFinal) / (somaPesos + pesoFinal);
          mediaAtual = round(mediaCombinada, 2);
        } else {
          mediaAtual = round(notaAtualRecuperacao, 2);
        }

        statusAtual = mediaAtual >= regras.mediaMinima ? CursosFinalStatus.APROVADO : CursosFinalStatus.EM_ANALISE;
        registrarModelo(modelo, {
          aplicado: true,
          novaMedia: mediaAtual,
          notaConsiderada: round(notaAtualRecuperacao, 1),
          status: statusAtual,
          detalhes: 'Prova final aplicada como nota predominante',
        });
        break;
      }
      default:
        registrarModelo(modelo, { aplicado: false });
    }
  }

  return {
    provas: provasOrdenadas,
    media: mediaAtual,
    status: statusAtual,
    notaRecuperacao: notaAtualRecuperacao,
    modelos: modelosResultado,
  };
};

export const computeFinalResult = ({
  mediaInicial,
  regras,
  recuperacao,
}: {
  mediaInicial: number | null;
  regras: CursosRegrasDeProvas;
  recuperacao?: ResultadoAplicacaoRecuperacao | null;
}) => {
  const statusInicial = mediaInicial === null
    ? CursosFinalStatus.EM_ANALISE
    : mediaInicial >= regras.mediaMinima
      ? CursosFinalStatus.APROVADO
      : CursosFinalStatus.REPROVADO;

  const mediaFinal = recuperacao?.media ?? mediaInicial;
  const statusFinal = mediaFinal === null
    ? CursosFinalStatus.EM_ANALISE
    : mediaFinal >= regras.mediaMinima
      ? CursosFinalStatus.APROVADO
      : CursosFinalStatus.REPROVADO;

  return {
    mediaInicial: mediaInicial !== null ? round(mediaInicial, 2) : null,
    statusInicial,
    mediaFinal: mediaFinal !== null ? round(mediaFinal, 2) : null,
    statusFinal,
  };
};

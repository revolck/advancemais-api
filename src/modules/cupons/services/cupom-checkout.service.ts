import { CuponsAplicarEm, CuponsLimiteUso, CuponsPeriodo, WebsiteStatus } from '@prisma/client';

import { prisma } from '@/config/prisma';

export type CupomCheckoutValidado = {
  valido: boolean;
  cupomId?: string;
  tipoDesconto?: 'PORCENTAGEM' | 'VALOR_FIXO';
  valorPercentual?: number;
  valorFixo?: number;
  erro?: string;
  mensagem?: string;
};

type CupomCheckoutScope = 'COURSE' | 'SUBSCRIPTION';

export async function validarECalcularDescontoCheckout(params: {
  cupomCodigo?: string;
  scope: CupomCheckoutScope;
  targetId: string;
  valorOriginal: number;
}): Promise<{
  valorFinal: number;
  desconto: number;
  cupomId: string | null;
  cupomInfo: CupomCheckoutValidado | null;
}> {
  const { cupomCodigo, scope, targetId, valorOriginal } = params;

  if (!cupomCodigo) {
    return { valorFinal: valorOriginal, desconto: 0, cupomId: null, cupomInfo: null };
  }

  const codigoNormalizado = cupomCodigo.trim().toUpperCase();

  const cupom = await prisma.cuponsDesconto.findUnique({
    where: { codigo: codigoNormalizado },
    include: {
      CuponsDescontoCursos: true,
      CuponsDescontoPlanos: true,
    },
  });

  if (!cupom) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: { valido: false, erro: 'CUPOM_NAO_ENCONTRADO', mensagem: 'Cupom não encontrado' },
    };
  }

  if (cupom.status !== WebsiteStatus.PUBLICADO) {
    return {
      valorFinal: valorOriginal,
      desconto: 0,
      cupomId: null,
      cupomInfo: {
        valido: false,
        erro: 'CUPOM_INATIVO',
        mensagem: 'Este cupom não está mais ativo',
      },
    };
  }

  const agora = new Date();
  if (cupom.periodoTipo === CuponsPeriodo.PERIODO) {
    if (cupom.periodoInicio && agora < cupom.periodoInicio) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_AINDA_NAO_VALIDO',
          mensagem: 'Este cupom ainda não está válido',
        },
      };
    }

    if (cupom.periodoFim && agora > cupom.periodoFim) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: { valido: false, erro: 'CUPOM_EXPIRADO', mensagem: 'Este cupom já expirou' },
      };
    }
  }

  if (cupom.limiteUsoTotalTipo === CuponsLimiteUso.LIMITADO) {
    if (cupom.limiteUsoTotalQuantidade && cupom.usosTotais >= cupom.limiteUsoTotalQuantidade) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_ESGOTADO',
          mensagem: 'Este cupom já atingiu o limite de uso',
        },
      };
    }
  }

  if (scope === 'SUBSCRIPTION') {
    if (cupom.aplicarEm === CuponsAplicarEm.APENAS_CURSOS) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_NAO_APLICAVEL',
          mensagem: 'Este cupom é válido apenas para cursos',
        },
      };
    }

    if (cupom.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA && !cupom.aplicarEmTodosItens) {
      const planoVinculado = cupom.CuponsDescontoPlanos.find((item) => item.planoId === targetId);
      if (!planoVinculado) {
        return {
          valorFinal: valorOriginal,
          desconto: 0,
          cupomId: null,
          cupomInfo: {
            valido: false,
            erro: 'CUPOM_NAO_APLICAVEL_PLANO',
            mensagem: 'Este cupom não é válido para o plano selecionado',
          },
        };
      }
    }
  } else {
    if (cupom.aplicarEm === CuponsAplicarEm.APENAS_ASSINATURA) {
      return {
        valorFinal: valorOriginal,
        desconto: 0,
        cupomId: null,
        cupomInfo: {
          valido: false,
          erro: 'CUPOM_NAO_APLICAVEL',
          mensagem: 'Este cupom é válido apenas para planos empresariais',
        },
      };
    }

    if (cupom.aplicarEm === CuponsAplicarEm.APENAS_CURSOS && !cupom.aplicarEmTodosItens) {
      const cursoVinculado = cupom.CuponsDescontoCursos.find((item) => item.cursoId === targetId);
      if (!cursoVinculado) {
        return {
          valorFinal: valorOriginal,
          desconto: 0,
          cupomId: null,
          cupomInfo: {
            valido: false,
            erro: 'CUPOM_NAO_APLICAVEL_CURSO',
            mensagem: 'Este cupom não é válido para o curso selecionado',
          },
        };
      }
    }
  }

  let desconto = 0;

  if (cupom.tipoDesconto === 'PORCENTAGEM' && cupom.valorPorcentagem) {
    desconto = valorOriginal * (Number(cupom.valorPorcentagem) / 100);
  } else if (cupom.tipoDesconto === 'VALOR_FIXO' && cupom.valorFixo) {
    desconto = Number(cupom.valorFixo);
  }

  desconto = Math.min(desconto, valorOriginal);
  desconto = Math.round(desconto * 100) / 100;

  return {
    valorFinal: Math.round((valorOriginal - desconto) * 100) / 100,
    desconto,
    cupomId: cupom.id,
    cupomInfo: {
      valido: true,
      cupomId: cupom.id,
      tipoDesconto: cupom.tipoDesconto as 'PORCENTAGEM' | 'VALOR_FIXO',
      valorPercentual: cupom.valorPorcentagem ? Number(cupom.valorPorcentagem) : undefined,
      valorFixo: cupom.valorFixo ? Number(cupom.valorFixo) : undefined,
    },
  };
}

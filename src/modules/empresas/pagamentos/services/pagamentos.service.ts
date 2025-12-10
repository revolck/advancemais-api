import { prisma } from '@/config/prisma';
import type { Prisma } from '@prisma/client';
import type { ListarPagamentosQuery } from '../validators/pagamentos.schema';

interface PagamentoFormatado {
  id: string;
  tipo: string;
  tipoDescricao: string;
  status: string | null;
  statusDescricao: string;
  descricaoCompleta: string; // Campo novo: combina tipo + status de forma inteligente
  valor: number | null;
  valorFormatado: string | null;
  metodo: string | null;
  metodoDescricao: string | null;
  plano: {
    id: string;
    nome: string;
  } | null;
  referencia: string | null;
  transacaoId: string | null;
  criadoEm: Date;
  detalhes: {
    pix?: {
      qrCode: string | null;
      copiaCola: string | null;
      expiraEm: string | null;
    };
    boleto?: {
      codigo: string | null;
      urlPdf: string | null;
      vencimento: string | null;
    };
  } | null;
}

interface PagamentosResumo {
  totalPago: number;
  totalPendente: number;
  totalTransacoes: number;
  ultimoPagamento: string | null;
}

const TIPO_DESCRICOES: Record<string, string> = {
  CHECKOUT_START: 'Checkout iniciado',
  CHECKOUT_ERROR: 'Erro no checkout',
  PAYMENT_CREATED: 'Pagamento criado',
  PAYMENT_APPROVED: 'Pagamento aprovado',
  PAYMENT_PENDING: 'Pagamento pendente',
  PAYMENT_CANCELLED: 'Pagamento cancelado',
  PAYMENT_REJECTED: 'Pagamento rejeitado',
  PAYMENT_REFUNDED: 'Pagamento reembolsado',
  PAYMENT_STATUS_UPDATE: 'Atualização de status',
  SUBSCRIPTION_CREATED: 'Assinatura criada',
  SUBSCRIPTION_CANCELLED: 'Assinatura cancelada',
  SUBSCRIPTION_UPDATED: 'Assinatura atualizada',
  WEBHOOK_RECEIVED: 'Webhook recebido',
  RECONCILE_CANCEL: 'Cancelamento por inadimplência',
};

const STATUS_DESCRICOES: Record<string, string> = {
  PENDENTE: 'Aguardando pagamento',
  EM_PROCESSAMENTO: 'Em processamento',
  APROVADO: 'Aprovado',
  CONCLUIDO: 'Concluído',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
  ESTORNADO: 'Estornado',
  ERRO: 'Erro',
};

const METODO_DESCRICOES: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto Bancário',
  bolbradesco: 'Boleto Bradesco',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  account_money: 'Saldo Mercado Pago',
};

/**
 * Extrai informações do payload do pagamento
 */
function extrairInfoPagamento(payload: any): {
  valor: number | null;
  metodo: string | null;
  detalhes: PagamentoFormatado['detalhes'];
} {
  if (!payload) {
    return { valor: null, metodo: null, detalhes: null };
  }

  const valor = payload.transaction_amount ?? payload.valorFinal ?? null;
  const metodo = payload.payment_method_id ?? payload.pagamento ?? null;

  let detalhes: PagamentoFormatado['detalhes'] = null;

  // Extrair detalhes de PIX
  if (payload.point_of_interaction?.transaction_data?.qr_code) {
    detalhes = {
      pix: {
        qrCode: payload.point_of_interaction.transaction_data.ticket_url ?? null,
        copiaCola: payload.point_of_interaction.transaction_data.qr_code ?? null,
        expiraEm: payload.date_of_expiration ?? null,
      },
    };
  }

  // Extrair detalhes de boleto
  if (payload.transaction_details?.external_resource_url) {
    detalhes = {
      boleto: {
        codigo: payload.transaction_details.digitable_line ?? null,
        urlPdf: payload.transaction_details.external_resource_url ?? null,
        vencimento: payload.date_of_expiration ?? null,
      },
    };
  }

  return { valor, metodo, detalhes };
}

/**
 * Formata valor para moeda brasileira
 */
function formatarMoeda(valor: number | null): string | null {
  if (valor === null || valor === undefined) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Gera descrição completa combinando tipo e status de forma inteligente
 * Prioriza status quando há redundância, mas mantém informação do tipo quando relevante
 */
function gerarDescricaoCompleta(tipo: string, status: string | null): string {
  const tipoDesc = TIPO_DESCRICOES[tipo] ?? tipo;
  const statusDesc = status ? STATUS_DESCRICOES[status] ?? status : null;

  // Casos onde tipo e status são redundantes - usar apenas status
  if (
    (tipo === 'PAYMENT_APPROVED' && status === 'APROVADO') ||
    (tipo === 'PAYMENT_REJECTED' && status === 'RECUSADO') ||
    (tipo === 'PAYMENT_CANCELLED' && status === 'CANCELADO') ||
    (tipo === 'CHECKOUT_ERROR' && status === 'ERRO')
  ) {
    return statusDesc || tipoDesc;
  }

  // Casos onde tipo e status são complementares
  if (tipo === 'PAYMENT_CREATED' && status) {
    return `${tipoDesc} - ${statusDesc}`;
  }

  if (tipo === 'PAYMENT_STATUS_UPDATE' && status) {
    return `Status atualizado: ${statusDesc}`;
  }

  if (tipo === 'CHECKOUT_START' && status === 'PENDENTE') {
    return `${tipoDesc} - ${statusDesc}`;
  }

  // Casos especiais
  if (tipo === 'SUBSCRIPTION_CREATED') {
    return 'Assinatura criada';
  }

  if (tipo === 'SUBSCRIPTION_CANCELLED') {
    return 'Assinatura cancelada';
  }

  if (tipo === 'RECONCILE_CANCEL') {
    return 'Cancelado por inadimplência';
  }

  // Fallback: usar tipo se status não existir, ou combinar se ambos existirem
  if (!statusDesc) {
    return tipoDesc;
  }

  return `${tipoDesc} (${statusDesc})`;
}

export const pagamentosService = {
  async listar(
    empresaId: string,
    params: ListarPagamentosQuery,
  ): Promise<{
    pagamentos: PagamentoFormatado[];
    resumo: PagamentosResumo;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      page,
      pageSize,
      tipo,
      status,
      dataInicio,
      dataFim,
      metodo,
      planoId,
      valorMin,
      valorMax,
    } = params;

    // Buscar IDs dos planos da empresa
    const planos = await prisma.empresasPlano.findMany({
      where: { usuarioId: empresaId },
      select: {
        id: true,
        PlanosEmpresariais: { select: { nome: true } },
      },
    });
    const planoIds = planos.map((p) => p.id);
    const planoMap = new Map(
      planos.map((p) => [p.id, { id: p.id, nome: p.PlanosEmpresariais.nome }]),
    );

    // Construir filtro base
    const orFilters: Prisma.LogsPagamentosDeAssinaturasWhereInput['OR'] = [
      { usuarioId: empresaId },
    ];
    if (planoIds.length > 0) {
      orFilters.push({ empresasPlanoId: { in: planoIds } });
    }

    const where: Prisma.LogsPagamentosDeAssinaturasWhereInput = {
      OR: orFilters,
      ...(tipo && { tipo }),
      ...(status && { status }),
      // Filtro por planoId (se fornecido e válido)
      ...(planoId && planoIds.includes(planoId) && { empresasPlanoId: planoId }),
    };

    // Filtro de data
    if (dataInicio || dataFim) {
      where.criadoEm = {};
      if (dataInicio) {
        where.criadoEm.gte = new Date(dataInicio);
      }
      if (dataFim) {
        where.criadoEm.lte = new Date(dataFim);
      }
    }

    // Buscar TODOS os logs que passam pelos filtros do Prisma
    // (vamos filtrar por método e valor em memória, pois estão no payload JSON)
    const allLogs = await prisma.logsPagamentosDeAssinaturas.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      // Buscar mais registros para compensar filtros em memória
      take: 1000, // Limite razoável para filtros em memória
    });

    // Aplicar filtros que dependem do payload (método e valor)
    let filteredLogs = allLogs.filter((log) => {
      const payload = log.payload as any;

      // Filtro por método
      if (metodo) {
        const logMetodo = payload?.payment_method_id ?? payload?.pagamento ?? null;
        if (!logMetodo) return false;

        // Normalizar bolbradesco para boleto
        const metodoNormalizado = logMetodo === 'bolbradesco' ? 'boleto' : logMetodo;
        const filtroNormalizado = metodo === 'bolbradesco' ? 'boleto' : metodo;

        if (metodoNormalizado !== filtroNormalizado) return false;
      }

      // Filtro por valor
      if (valorMin !== undefined || valorMax !== undefined) {
        const valor = payload?.transaction_amount ?? payload?.valorFinal ?? null;
        if (valor === null) return false;

        if (valorMin !== undefined && valor < valorMin) return false;
        if (valorMax !== undefined && valor > valorMax) return false;
      }

      return true;
    });

    // Calcular total após filtros
    const total = filteredLogs.length;

    // Aplicar paginação
    const skip = (page - 1) * pageSize;
    const logs = filteredLogs.slice(skip, skip + pageSize);

    // Calcular resumo (aplicar mesmos filtros)
    const resumoLogsBase = await prisma.logsPagamentosDeAssinaturas.findMany({
      where: {
        OR: orFilters,
        tipo: { in: ['PAYMENT_APPROVED', 'PAYMENT_CREATED'] },
        ...(planoId && planoIds.includes(planoId) && { empresasPlanoId: planoId }),
      },
      select: {
        tipo: true,
        status: true,
        payload: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'desc' },
      take: 1000,
    });

    // Aplicar filtros de método e valor no resumo também
    const resumoLogs = resumoLogsBase.filter((log) => {
      const payload = log.payload as any;

      if (metodo) {
        const logMetodo = payload?.payment_method_id ?? payload?.pagamento ?? null;
        if (!logMetodo) return false;
        const metodoNormalizado = logMetodo === 'bolbradesco' ? 'boleto' : logMetodo;
        const filtroNormalizado = metodo === 'bolbradesco' ? 'boleto' : metodo;
        if (metodoNormalizado !== filtroNormalizado) return false;
      }

      if (valorMin !== undefined || valorMax !== undefined) {
        const valor = payload?.transaction_amount ?? payload?.valorFinal ?? null;
        if (valor === null) return false;
        if (valorMin !== undefined && valor < valorMin) return false;
        if (valorMax !== undefined && valor > valorMax) return false;
      }

      return true;
    });

    let totalPago = 0;
    let totalPendente = 0;
    let ultimoPagamento: Date | null = null;

    resumoLogs.forEach((log) => {
      const payload = log.payload as any;
      const valor = payload?.transaction_amount ?? 0;

      if (log.status === 'APROVADO' || log.tipo === 'PAYMENT_APPROVED') {
        totalPago += valor;
        const dataCriacao = log.criadoEm instanceof Date ? log.criadoEm : new Date(log.criadoEm);
        if (!ultimoPagamento || dataCriacao > ultimoPagamento) {
          ultimoPagamento = dataCriacao;
        }
      } else if (log.status === 'EM_PROCESSAMENTO' || log.status === 'PENDENTE') {
        totalPendente += valor;
      }
    });

    // Formatar pagamentos
    const pagamentos: PagamentoFormatado[] = logs.map((log) => {
      const payload = log.payload as any;
      const { valor, metodo, detalhes } = extrairInfoPagamento(payload);

      const tipoDescricao = TIPO_DESCRICOES[log.tipo] ?? log.tipo;
      const statusDescricao = STATUS_DESCRICOES[log.status ?? ''] ?? log.status ?? 'Desconhecido';
      const descricaoCompleta = gerarDescricaoCompleta(log.tipo, log.status);

      return {
        id: log.id,
        tipo: log.tipo,
        tipoDescricao,
        status: log.status,
        statusDescricao,
        descricaoCompleta, // Campo novo para simplificar UX
        valor,
        valorFormatado: formatarMoeda(valor),
        metodo,
        metodoDescricao: metodo ? METODO_DESCRICOES[metodo] ?? metodo : null,
        plano: log.empresasPlanoId ? planoMap.get(log.empresasPlanoId) ?? null : null,
        referencia: log.externalRef,
        transacaoId: log.mpResourceId,
        criadoEm: log.criadoEm,
        detalhes,
      };
    });

    return {
      pagamentos,
      resumo: {
        totalPago,
        totalPendente,
        totalTransacoes: total,
        ultimoPagamento: ultimoPagamento ? (ultimoPagamento as Date).toISOString() : null,
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Lista os planos da empresa (histórico de planos contratados)
   */
  async listarPlanos(empresaId: string) {
    const planos = await prisma.empresasPlano.findMany({
      where: { usuarioId: empresaId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        status: true,
        inicio: true,
        fim: true,
        proximaCobranca: true,
        statusPagamento: true,
        PlanosEmpresariais: {
          select: {
            id: true,
            nome: true,
            valor: true,
          },
        },
      },
    });

    return planos.map((plano) => ({
      id: plano.id,
      nome: plano.PlanosEmpresariais.nome,
      valor: plano.PlanosEmpresariais.valor,
      status: plano.status,
      statusPagamento: plano.statusPagamento,
      inicio: plano.inicio,
      fim: plano.fim,
      proximaCobranca: plano.proximaCobranca,
    }));
  },
};


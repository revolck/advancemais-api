import { Prisma, NotificacaoStatus, NotificacaoTipo, NotificacaoPrioridade } from '@prisma/client';
import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  ListNotificacoesQuery,
  MarcarComoLidaInput,
  MarcarTodasComoLidasInput,
  ArquivarNotificacoesInput,
  CriarNotificacaoInput,
} from '../validators/notificacoes.schema';

const notificacoesLogger = logger.child({ module: 'NotificacoesService' });

export const notificacoesService = {
  /**
   * Lista notificações do usuário
   */
  list: async (usuarioId: string, query: ListNotificacoesQuery) => {
    const { page, pageSize, status, tipo, prioridade, apenasNaoLidas } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NotificacoesWhereInput = {
      usuarioId,
    };

    // Filtro por status
    if (status && status.length > 0) {
      where.status = { in: status as NotificacaoStatus[] };
    } else if (apenasNaoLidas) {
      where.status = NotificacaoStatus.NAO_LIDA;
    }

    // Filtro por tipo
    if (tipo && tipo.length > 0) {
      where.tipo = { in: tipo as NotificacaoTipo[] };
    }

    // Filtro por prioridade
    if (prioridade && prioridade.length > 0) {
      where.prioridade = { in: prioridade as NotificacaoPrioridade[] };
    }

    // Não mostrar notificações expiradas
    where.OR = [{ expiraEm: null }, { expiraEm: { gt: new Date() } }];

    // ✅ Usar retryOperation para tratar erros de conexão automaticamente
    const [notificacoes, total, naoLidas] = await retryOperation(
      () =>
        Promise.all([
          prisma.notificacoes.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [
              { prioridade: 'desc' }, // URGENTE > ALTA > NORMAL > BAIXA
              { criadoEm: 'desc' },
            ],
            select: {
              id: true,
              tipo: true,
              status: true,
              prioridade: true,
              titulo: true,
              mensagem: true,
              dados: true,
              linkAcao: true,
              lidaEm: true,
              criadoEm: true,
              expiraEm: true,
              vagaId: true,
              candidaturaId: true,
              empresasPlanoId: true,
              Vaga: {
                select: {
                  id: true,
                  titulo: true,
                  codigo: true,
                },
              },
            },
          }),
          prisma.notificacoes.count({ where }),
          prisma.notificacoes.count({
            where: {
              usuarioId,
              status: NotificacaoStatus.NAO_LIDA,
              OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
            },
          }),
        ]),
      3, // maxRetries
      1000, // delayMs
      20000, // timeoutMs - 20s para queries complexas
    );

    return {
      data: notificacoes.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        status: n.status,
        prioridade: n.prioridade,
        titulo: n.titulo,
        mensagem: n.mensagem,
        dados: n.dados,
        linkAcao: n.linkAcao,
        lidaEm: n.lidaEm?.toISOString() || null,
        criadoEm: n.criadoEm.toISOString(),
        expiraEm: n.expiraEm?.toISOString() || null,
        vaga: n.Vaga
          ? {
              id: n.Vaga.id,
              titulo: n.Vaga.titulo,
              codigo: n.Vaga.codigo,
            }
          : null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      contadores: {
        naoLidas,
        total,
      },
    };
  },

  /**
   * Conta notificações não lidas do usuário
   */
  contarNaoLidas: async (usuarioId: string) => {
    // ✅ Usar retryOperation para tratar erros de conexão automaticamente
    const count = await retryOperation(
      () =>
        prisma.notificacoes.count({
          where: {
            usuarioId,
            status: NotificacaoStatus.NAO_LIDA,
            OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
          },
        }),
      3, // maxRetries
      1000, // delayMs
      15000, // timeoutMs
    );

    return { naoLidas: count };
  },

  /**
   * Marca notificações como lidas
   */
  marcarComoLida: async (usuarioId: string, input: MarcarComoLidaInput) => {
    const result = await prisma.notificacoes.updateMany({
      where: {
        id: { in: input.notificacaoIds },
        usuarioId, // Garantir que pertence ao usuário
        status: NotificacaoStatus.NAO_LIDA,
      },
      data: {
        status: NotificacaoStatus.LIDA,
        lidaEm: new Date(),
      },
    });

    return {
      success: true,
      marcadas: result.count,
    };
  },

  /**
   * Marca todas as notificações como lidas
   */
  marcarTodasComoLidas: async (usuarioId: string, input: MarcarTodasComoLidasInput) => {
    const where: Prisma.NotificacoesWhereInput = {
      usuarioId,
      status: NotificacaoStatus.NAO_LIDA,
    };

    if (input.tipo) {
      where.tipo = input.tipo as NotificacaoTipo;
    }

    const result = await prisma.notificacoes.updateMany({
      where,
      data: {
        status: NotificacaoStatus.LIDA,
        lidaEm: new Date(),
      },
    });

    return {
      success: true,
      marcadas: result.count,
    };
  },

  /**
   * Arquiva notificações
   */
  arquivar: async (usuarioId: string, input: ArquivarNotificacoesInput) => {
    const result = await prisma.notificacoes.updateMany({
      where: {
        id: { in: input.notificacaoIds },
        usuarioId, // Garantir que pertence ao usuário
      },
      data: {
        status: NotificacaoStatus.ARQUIVADA,
      },
    });

    return {
      success: true,
      arquivadas: result.count,
    };
  },

  /**
   * Cria uma nova notificação
   * Uso interno - chamado por outros serviços quando eventos ocorrem
   */
  criar: async (input: CriarNotificacaoInput) => {
    const notificacao = await prisma.notificacoes.create({
      data: {
        usuarioId: input.usuarioId,
        tipo: input.tipo as NotificacaoTipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        prioridade: (input.prioridade || 'NORMAL') as NotificacaoPrioridade,
        vagaId: input.vagaId,
        candidaturaId: input.candidaturaId,
        empresasPlanoId: input.empresasPlanoId,
        dados: input.dados,
        linkAcao: input.linkAcao,
        expiraEm: input.expiraEm,
      },
    });

    notificacoesLogger.info(
      { notificacaoId: notificacao.id, usuarioId: input.usuarioId, tipo: input.tipo },
      'Notificação criada',
    );

    return notificacao;
  },

  // =============================================
  // MÉTODOS DE CONVENIÊNCIA PARA CRIAR NOTIFICAÇÕES
  // =============================================

  /**
   * Notifica empresa que a vaga foi rejeitada
   */
  notificarVagaRejeitada: async (params: {
    empresaId: string;
    vagaId: string;
    vagaTitulo: string;
    motivoRejeicao: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'VAGA_REJEITADA',
      titulo: 'Vaga rejeitada',
      mensagem: `Sua vaga "${params.vagaTitulo}" foi rejeitada. Motivo: ${params.motivoRejeicao}. Você pode editar e reenviar para uma nova análise.`,
      prioridade: 'ALTA',
      vagaId: params.vagaId,
      dados: { motivoRejeicao: params.motivoRejeicao },
      linkAcao: `/empresa/vagas/${params.vagaId}/editar`,
    });
  },

  /**
   * Notifica empresa que a vaga foi aprovada e publicada
   */
  notificarVagaAprovada: async (params: {
    empresaId: string;
    vagaId: string;
    vagaTitulo: string;
    observacoes?: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'VAGA_APROVADA',
      titulo: 'Vaga aprovada e publicada',
      mensagem: `Sua vaga "${params.vagaTitulo}" foi aprovada e já está publicada no sistema!${params.observacoes ? ` Observações: ${params.observacoes}` : ''}`,
      prioridade: 'NORMAL',
      vagaId: params.vagaId,
      dados: params.observacoes ? { observacoes: params.observacoes } : undefined,
      linkAcao: `/empresa/vagas/${params.vagaId}`,
    });
  },

  /**
   * Notifica empresa sobre novo candidato inscrito
   */
  notificarNovoCandidato: async (params: {
    empresaId: string;
    vagaId: string;
    vagaTitulo: string;
    candidatoNome: string;
    candidaturaId: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'NOVO_CANDIDATO',
      titulo: 'Novo candidato inscrito',
      mensagem: `${params.candidatoNome} se inscreveu para a vaga "${params.vagaTitulo}".`,
      prioridade: 'NORMAL',
      vagaId: params.vagaId,
      candidaturaId: params.candidaturaId,
      linkAcao: `/empresa/vagas/${params.vagaId}/candidatos`,
    });
  },

  /**
   * Notifica empresa que a vaga atingiu o limite de candidatos
   */
  notificarVagaPreenchida: async (params: {
    empresaId: string;
    vagaId: string;
    vagaTitulo: string;
    totalCandidatos: number;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'VAGA_PREENCHIDA',
      titulo: 'Vaga atingiu o limite de candidatos',
      mensagem: `Sua vaga "${params.vagaTitulo}" atingiu o limite de ${params.totalCandidatos} candidatos inscritos.`,
      prioridade: 'ALTA',
      vagaId: params.vagaId,
      dados: { totalCandidatos: params.totalCandidatos },
      linkAcao: `/empresa/vagas/${params.vagaId}/candidatos`,
    });
  },

  /**
   * Notifica empresa que o plano está prestes a expirar
   */
  notificarPlanoExpirando: async (params: {
    empresaId: string;
    planoId: string;
    planoNome: string;
    diasRestantes: number;
    dataExpiracao: Date;
  }) => {
    const mensagem =
      params.diasRestantes === 0
        ? `Seu plano "${params.planoNome}" expira hoje!`
        : params.diasRestantes === 1
          ? `Seu plano "${params.planoNome}" expira amanhã!`
          : `Seu plano "${params.planoNome}" expira em ${params.diasRestantes} dias.`;

    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'PLANO_EXPIRANDO',
      titulo: 'Plano prestes a expirar',
      mensagem,
      prioridade: params.diasRestantes <= 1 ? 'URGENTE' : 'ALTA',
      empresasPlanoId: params.planoId,
      dados: { diasRestantes: params.diasRestantes, dataExpiracao: params.dataExpiracao },
      linkAcao: '/empresa/plano',
    });
  },

  /**
   * Notifica empresa que o plano expirou
   */
  notificarPlanoExpirado: async (params: {
    empresaId: string;
    planoId: string;
    planoNome: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'PLANO_EXPIRADO',
      titulo: 'Plano expirado',
      mensagem: `Seu plano "${params.planoNome}" expirou. Renove para continuar utilizando todos os recursos.`,
      prioridade: 'URGENTE',
      empresasPlanoId: params.planoId,
      linkAcao: '/empresa/planos',
    });
  },

  /**
   * Notifica empresa que a assinatura foi renovada
   */
  notificarAssinaturaRenovada: async (params: {
    empresaId: string;
    planoId: string;
    planoNome: string;
    proximaCobranca: Date;
    valor: number;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'ASSINATURA_RENOVADA',
      titulo: 'Assinatura renovada com sucesso',
      mensagem: `Sua assinatura do plano "${params.planoNome}" foi renovada com sucesso! Próxima cobrança: ${params.proximaCobranca.toLocaleDateString('pt-BR')}.`,
      prioridade: 'NORMAL',
      empresasPlanoId: params.planoId,
      dados: { proximaCobranca: params.proximaCobranca, valor: params.valor },
      linkAcao: '/empresa/plano',
    });
  },

  /**
   * Notifica empresa que o pagamento foi aprovado
   */
  notificarPagamentoAprovado: async (params: {
    empresaId: string;
    planoId: string;
    planoNome: string;
    valor: number;
    metodoPagamento: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'PAGAMENTO_APROVADO',
      titulo: 'Pagamento aprovado',
      mensagem: `Seu pagamento de R$ ${params.valor.toFixed(2)} para o plano "${params.planoNome}" foi aprovado!`,
      prioridade: 'NORMAL',
      empresasPlanoId: params.planoId,
      dados: { valor: params.valor, metodoPagamento: params.metodoPagamento },
      linkAcao: '/empresa/plano',
    });
  },

  /**
   * Notifica empresa que o pagamento foi recusado
   */
  notificarPagamentoRecusado: async (params: {
    empresaId: string;
    planoId: string;
    planoNome: string;
    motivo?: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.empresaId,
      tipo: 'PAGAMENTO_RECUSADO',
      titulo: 'Pagamento recusado',
      mensagem: `O pagamento para o plano "${params.planoNome}" foi recusado.${params.motivo ? ` Motivo: ${params.motivo}` : ''} Por favor, tente novamente.`,
      prioridade: 'URGENTE',
      empresasPlanoId: params.planoId,
      dados: params.motivo ? { motivo: params.motivo } : undefined,
      linkAcao: '/empresa/plano',
    });
  },

  // =============================================
  // NOTIFICAÇÕES DE RECUPERAÇÃO FINAL (CURSOS)
  // =============================================

  /**
   * Notifica aluno que a recuperação final está disponível e aguardando pagamento
   */
  notificarRecuperacaoFinalPendente: async (params: {
    alunoId: string;
    cursoId: string;
    cursoNome: string;
    turmaId: string;
    turmaNome: string;
    provaId: string;
    valor: number;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.alunoId,
      tipo: 'RECUPERACAO_FINAL_PAGAMENTO_PENDENTE',
      titulo: 'Recuperação Final Disponível',
      mensagem: `Você está elegível para a recuperação final do curso "${params.cursoNome}". Valor: R$ ${params.valor.toFixed(2)}. Efetue o pagamento para liberar a prova.`,
      prioridade: 'ALTA',
      dados: {
        cursoId: params.cursoId,
        cursoNome: params.cursoNome,
        turmaId: params.turmaId,
        turmaNome: params.turmaNome,
        provaId: params.provaId,
        valor: params.valor,
        titulo: 'Recuperação Final',
        returnTo: '/dashboard',
      },
      linkAcao: `/dashboard/cursos/${params.cursoId}/turmas/${params.turmaId}/recuperacao`,
    });
  },

  /**
   * Notifica aluno que o pagamento da recuperação final foi aprovado
   */
  notificarRecuperacaoFinalAprovada: async (params: {
    alunoId: string;
    cursoId: string;
    cursoNome: string;
    turmaId: string;
    turmaNome: string;
    provaId: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.alunoId,
      tipo: 'RECUPERACAO_FINAL_PAGAMENTO_APROVADO',
      titulo: 'Pagamento Aprovado - Recuperação Final',
      mensagem: `Seu pagamento para a recuperação final do curso "${params.cursoNome}" foi aprovado! A prova já está liberada.`,
      prioridade: 'ALTA',
      dados: {
        cursoId: params.cursoId,
        cursoNome: params.cursoNome,
        turmaId: params.turmaId,
        turmaNome: params.turmaNome,
        provaId: params.provaId,
        titulo: 'Recuperação Final',
        returnTo: '/dashboard',
      },
      linkAcao: `/dashboard/cursos/${params.cursoId}/turmas/${params.turmaId}/provas/${params.provaId}`,
    });
  },

  /**
   * Notifica aluno que o pagamento da recuperação final foi recusado
   */
  notificarRecuperacaoFinalRecusada: async (params: {
    alunoId: string;
    cursoId: string;
    cursoNome: string;
    turmaId: string;
    turmaNome: string;
    provaId: string;
    motivo?: string;
  }) => {
    return notificacoesService.criar({
      usuarioId: params.alunoId,
      tipo: 'RECUPERACAO_FINAL_PAGAMENTO_RECUSADO',
      titulo: 'Pagamento Recusado - Recuperação Final',
      mensagem: `O pagamento para a recuperação final do curso "${params.cursoNome}" foi recusado.${params.motivo ? ` Motivo: ${params.motivo}` : ''} Por favor, tente novamente.`,
      prioridade: 'URGENTE',
      dados: {
        cursoId: params.cursoId,
        cursoNome: params.cursoNome,
        turmaId: params.turmaId,
        turmaNome: params.turmaNome,
        provaId: params.provaId,
        titulo: 'Recuperação Final',
        returnTo: '/dashboard',
        motivo: params.motivo,
      },
      linkAcao: `/dashboard/cursos/${params.cursoId}/turmas/${params.turmaId}/recuperacao`,
    });
  },

  /**
   * Deleta notificações antigas (para limpeza)
   * Chamado por um job periódico
   */
  limparNotificacoesAntigas: async (diasParaManter: number = 90) => {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasParaManter);

    const result = await prisma.notificacoes.deleteMany({
      where: {
        criadoEm: { lt: dataLimite },
        status: { in: [NotificacaoStatus.LIDA, NotificacaoStatus.ARQUIVADA] },
      },
    });

    notificacoesLogger.info(
      { deletadas: result.count, diasParaManter },
      'Notificações antigas limpas',
    );

    return { deletadas: result.count };
  },
};

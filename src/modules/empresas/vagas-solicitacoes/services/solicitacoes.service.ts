import { prisma } from '@/config/prisma';
import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import { adminVagasService } from '@/modules/empresas/admin/services/admin-vagas.service';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { logger } from '@/utils/logger';
import { registrarHistoricoVaga } from '@/modules/empresas/vagas/utils/historico-vaga';
import { atualizarAvisoDaFila, avisosDaVaga } from '@/modules/empresas/vagas/utils/avisos-vaga';
import { LimiteVagasPlanoAtingidoError } from '@/modules/empresas/vagas/services/errors';
import { Prisma, StatusDeVagas } from '@prisma/client';
import type {
  AprovarSolicitacaoInput,
  RejeitarSolicitacaoInput,
  SolicitacoesListQuery,
} from '../validators/solicitacoes.schema';

const solicitacoesLogger = logger.child({ module: 'SolicitacoesService' });

/**
 * Status de solicitação baseado no status da vaga
 */
export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA';

/** Já passaram pela aprovação: publicada e o que vem depois dela */
const STATUS_APROVADA: StatusDeVagas[] = [
  StatusDeVagas.PUBLICADO,
  StatusDeVagas.DESPUBLICADA,
  StatusDeVagas.PAUSADA,
  StatusDeVagas.ENCERRADA,
  StatusDeVagas.EXPIRADO,
];

/**
 * Situação da solicitação a partir da vaga. Rejeitada = voltou a rascunho com motivo
 * de rejeição (campo próprio, não as observações da empresa); rascunho sem motivo =
 * cancelada/não enviada.
 */
const situacaoDaSolicitacao = (vaga: {
  status: StatusDeVagas;
  motivoRejeicao: string | null;
}): StatusSolicitacao => {
  if (vaga.status === StatusDeVagas.EM_ANALISE) return 'PENDENTE';
  if (vaga.status === StatusDeVagas.RASCUNHO) {
    return vaga.motivoRejeicao ? 'REJEITADA' : 'CANCELADA';
  }
  return 'APROVADA';
};

/**
 * Quando o setor de vagas respondeu. Vagas moderadas antes do campo próprio existir
 * usam a última atualização (só para as que já passaram pela aprovação).
 */
const dataDaResposta = (vaga: {
  status: StatusDeVagas;
  moderadaEm: Date | null;
  atualizadoEm: Date;
  motivoRejeicao: string | null;
}): string | null => {
  const situacao = situacaoDaSolicitacao(vaga);
  if (situacao === 'PENDENTE' || situacao === 'CANCELADA') return null;
  return (vaga.moderadaEm ?? vaga.atualizadoEm).toISOString();
};

/** Filtro do banco para cada situação de solicitação */
const filtroDaSituacao = (situacao: StatusSolicitacao): Prisma.EmpresasVagasWhereInput => {
  switch (situacao) {
    case 'PENDENTE':
      return { status: StatusDeVagas.EM_ANALISE };
    case 'APROVADA':
      return { status: { in: STATUS_APROVADA } };
    case 'REJEITADA':
      return { status: StatusDeVagas.RASCUNHO, motivoRejeicao: { not: null } };
    case 'CANCELADA':
      return { status: StatusDeVagas.RASCUNHO, motivoRejeicao: null };
    default:
      return {};
  }
};

export const solicitacoesService = {
  /**
   * Busca detalhes completos de uma solicitação (vaga + empresa)
   * Retorna todas as informações necessárias para o Setor de Vagas avaliar
   */
  get: async (solicitacaoId: string) => {
    // Verificar se a vaga existe
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!vaga) {
      throw Object.assign(new Error('Solicitação não encontrada'), {
        code: 'SOLICITACAO_NOT_FOUND',
      });
    }

    // Reutilizar o serviço admin que já retorna todas as informações completas
    // (vaga completa + empresa com CNPJ, avatar, localização, etc.)
    const vagaDetalhada = await adminVagasService.get(solicitacaoId);

    if (!vagaDetalhada) {
      throw Object.assign(new Error('Solicitação não encontrada'), {
        code: 'SOLICITACAO_NOT_FOUND',
      });
    }

    return vagaDetalhada;
  },

  /**
   * Lista solicitações de publicação de vagas
   */
  list: async (query: SolicitacoesListQuery) => {
    const { page, pageSize, status, empresaId, criadoDe, criadoAte, search } = query;
    const skip = (page - 1) * pageSize;

    // Construir filtros
    const where: Prisma.EmpresasVagasWhereInput = {};

    // Array para coletar condições AND
    const andConditions: Prisma.EmpresasVagasWhereInput[] = [];

    // Filtro por situação da solicitação (uma ou várias)
    if (status && status.length > 0) {
      andConditions.push({
        OR: [...new Set(status)].map((s) => filtroDaSituacao(s as StatusSolicitacao)),
      });
    }
    // ✅ Por padrão, retornar TODAS as solicitações (sem filtro de status)
    // O frontend pode filtrar por status=PENDENTE se quiser apenas pendentes para aprovação

    // Filtro por empresa
    if (empresaId) {
      where.usuarioId = empresaId;
    }

    // Filtro por data de criação
    if (criadoDe || criadoAte) {
      where.inseridaEm = {};
      if (criadoDe) {
        where.inseridaEm.gte = new Date(criadoDe);
      }
      if (criadoAte) {
        where.inseridaEm.lte = new Date(criadoAte);
      }
    }

    // Busca por título da vaga ou nome da empresa
    if (search) {
      andConditions.push({
        OR: [
          { titulo: { contains: search, mode: 'insensitive' } },
          { Usuarios: { nomeCompleto: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    // Combinar todas as condições AND
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      solicitacoesLogger.debug(
        { where, skip, take: pageSize },
        'Buscando solicitações com filtros',
      );
    }

    // Buscar vagas com dados da empresa (sequencial para evitar saturar pool)
    const vagas = await prisma.empresasVagas.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { inseridaEm: 'desc' },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        status: true,
        inseridaEm: true,
        atualizadoEm: true,
        motivoRejeicao: true,
        observacoesAprovacao: true,
        moderadaEm: true,
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            codUsuario: true,
            cnpj: true,
          },
        },
      },
    });
    const total = await prisma.empresasVagas.count({ where });

    // Log para debug
    if (process.env.NODE_ENV === 'development') {
      solicitacoesLogger.debug({ total, encontradas: vagas.length }, 'Solicitações encontradas');
    }

    // Mapear para formato de solicitação
    const data = vagas.map((vaga) => ({
      id: vaga.id,
      codigo: `SOL-${vaga.codigo}`, // Formato: SOL-{codigo_vaga}
      vaga: {
        id: vaga.id,
        titulo: vaga.titulo,
        codigo: vaga.codigo,
      },
      empresa: {
        id: vaga.Usuarios.id,
        nome: vaga.Usuarios.nomeCompleto,
        codigo: vaga.Usuarios.codUsuario,
        cnpj: vaga.Usuarios.cnpj || null,
      },
      solicitante: {
        id: vaga.Usuarios.id,
        nome: vaga.Usuarios.nomeCompleto,
      },
      status: situacaoDaSolicitacao(vaga),
      dataSolicitacao: vaga.inseridaEm.toISOString(),
      dataResposta: dataDaResposta(vaga),
      motivoRejeicao: situacaoDaSolicitacao(vaga) === 'REJEITADA' ? vaga.motivoRejeicao : null,
      // Observações que o setor de vagas deixou ao aprovar
      observacoes: vaga.observacoesAprovacao ?? null,
    }));

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Aprova uma solicitação de publicação
   */
  aprovar: async (solicitacaoId: string, input: AprovarSolicitacaoInput, aprovadorId: string) => {
    // Buscar a vaga com título para notificação
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        usuarioId: true,
        titulo: true,
        status: true,
      },
    });

    if (!vaga) {
      throw Object.assign(new Error('Solicitação não encontrada'), {
        code: 'SOLICITACAO_NOT_FOUND',
      });
    }

    if (vaga.status !== StatusDeVagas.EM_ANALISE) {
      throw Object.assign(new Error('Solicitação não está pendente'), {
        code: 'SOLICITACAO_INVALID_STATUS',
      });
    }

    // Usar o serviço existente de aprovação de vagas
    try {
      await adminEmpresasService.approveVaga(vaga.usuarioId, vaga.id);
    } catch (error) {
      // Plano cheio: a empresa precisa saber por que a vaga não foi ao ar
      if (error instanceof LimiteVagasPlanoAtingidoError) {
        await avisosDaVaga.limiteNoEnvio(vaga, { limite: error.limite, emUso: error.limite });
      }
      throw error;
    }

    // Moderação em campos próprios (as observações da vaga são da empresa)
    await prisma.empresasVagas.update({
      where: { id: vaga.id },
      data: {
        observacoesAprovacao: input.observacoes?.trim() || null,
        motivoRejeicao: null,
        moderadaEm: new Date(),
        atualizadoEm: new Date(),
      },
    });

    // Saiu da fila: corrige a contagem do aviso da equipe
    await atualizarAvisoDaFila({});

    // Quem aprovou fica no histórico da vaga
    await registrarHistoricoVaga({
      vagaId: vaga.id,
      usuarioId: aprovadorId,
      acao: 'VAGA_APROVADA',
      descricao: 'Vaga aprovada e publicada pelo setor de vagas',
      de: StatusDeVagas.EM_ANALISE,
      para: StatusDeVagas.PUBLICADO,
      metadata: input.observacoes ? { observacoes: input.observacoes } : undefined,
    });

    // Criar notificação para a empresa
    try {
      await notificacoesService.notificarVagaAprovada({
        empresaId: vaga.usuarioId,
        vagaId: vaga.id,
        vagaTitulo: vaga.titulo,
        observacoes: input.observacoes,
      });
    } catch (error) {
      // Não falhar a operação se a notificação falhar
      solicitacoesLogger.error(
        { error, vagaId: vaga.id },
        'Erro ao criar notificação de aprovação',
      );
    }

    return {
      success: true,
      message: 'Solicitação aprovada com sucesso',
    };
  },

  /**
   * Rejeita uma solicitação de publicação
   */
  rejeitar: async (
    solicitacaoId: string,
    input: RejeitarSolicitacaoInput,
    rejeitadorId: string,
  ) => {
    // Buscar a vaga com título e usuarioId para notificação
    const vaga = await prisma.empresasVagas.findUnique({
      where: { id: solicitacaoId },
      select: {
        id: true,
        usuarioId: true,
        titulo: true,
        status: true,
      },
    });

    if (!vaga) {
      throw Object.assign(new Error('Solicitação não encontrada'), {
        code: 'SOLICITACAO_NOT_FOUND',
      });
    }

    if (vaga.status !== StatusDeVagas.EM_ANALISE) {
      throw Object.assign(new Error('Solicitação não está pendente'), {
        code: 'SOLICITACAO_INVALID_STATUS',
      });
    }

    // Atualizar status da vaga para RASCUNHO (rejeitada) - permite a empresa editar e reenviar
    await prisma.empresasVagas.update({
      where: { id: vaga.id },
      data: {
        status: StatusDeVagas.RASCUNHO, // volta para a empresa ajustar e reenviar
        motivoRejeicao: input.motivoRejeicao.trim(),
        observacoesAprovacao: null,
        moderadaEm: new Date(),
        atualizadoEm: new Date(),
      },
    });

    await atualizarAvisoDaFila({});

    await registrarHistoricoVaga({
      vagaId: vaga.id,
      usuarioId: rejeitadorId,
      acao: 'VAGA_REJEITADA',
      descricao: 'Vaga rejeitada pelo setor de vagas',
      de: StatusDeVagas.EM_ANALISE,
      para: StatusDeVagas.RASCUNHO,
      metadata: { motivoRejeicao: input.motivoRejeicao },
    });

    // Criar notificação para a empresa sobre a rejeição
    try {
      await notificacoesService.notificarVagaRejeitada({
        empresaId: vaga.usuarioId,
        vagaId: vaga.id,
        vagaTitulo: vaga.titulo,
        motivoRejeicao: input.motivoRejeicao,
      });
    } catch (error) {
      // Não falhar a operação se a notificação falhar
      solicitacoesLogger.error({ error, vagaId: vaga.id }, 'Erro ao criar notificação de rejeição');
    }

    return {
      success: true,
      message: 'Solicitação rejeitada. A empresa poderá editar e reenviar a vaga para análise.',
    };
  },
};

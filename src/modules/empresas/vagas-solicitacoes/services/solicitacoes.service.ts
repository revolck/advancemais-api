import { Prisma, StatusDeVagas } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  SolicitacoesListQuery,
  AprovarSolicitacaoInput,
  RejeitarSolicitacaoInput,
} from '../validators/solicitacoes.schema';
import { adminEmpresasService } from '@/modules/empresas/admin/services/admin-empresas.service';
import { adminVagasService } from '@/modules/empresas/admin/services/admin-vagas.service';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';

const solicitacoesLogger = logger.child({ module: 'SolicitacoesService' });

/**
 * Status de solicitação baseado no status da vaga
 */
export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA';

/**
 * Mapeia status da vaga para status da solicitação
 */
const mapStatusVagaToSolicitacao = (status: StatusDeVagas): StatusSolicitacao => {
  switch (status) {
    case StatusDeVagas.EM_ANALISE:
      return 'PENDENTE';
    case StatusDeVagas.PUBLICADO:
      return 'APROVADA';
    case StatusDeVagas.RASCUNHO:
      return 'CANCELADA';
    default:
      return 'REJEITADA';
  }
};

/**
 * Mapeia status da solicitação para filtro de status da vaga
 */
const mapStatusSolicitacaoToVaga = (status: StatusSolicitacao): StatusDeVagas[] => {
  switch (status) {
    case 'PENDENTE':
      return [StatusDeVagas.EM_ANALISE];
    case 'APROVADA':
      return [StatusDeVagas.PUBLICADO];
    case 'REJEITADA':
      return [
        StatusDeVagas.DESPUBLICADA,
        StatusDeVagas.PAUSADA,
        StatusDeVagas.ENCERRADA,
        StatusDeVagas.EXPIRADO,
      ];
    case 'CANCELADA':
      return [StatusDeVagas.RASCUNHO];
    default:
      return [];
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

    // Filtro por status (mapear status de solicitação para status de vaga)
    // Lógica especial para REJEITADA e CANCELADA que compartilham o status RASCUNHO
    if (status && status.length > 0) {
      const statusVagas: StatusDeVagas[] = [];
      const incluiRejeitada = status.includes('REJEITADA');
      const incluiCancelada = status.includes('CANCELADA');

      status.forEach((s) => {
        if (s === 'REJEITADA' || s === 'CANCELADA') {
          // REJEITADA e CANCELADA são tratados especialmente abaixo
          // Adicionar outros status de REJEITADA (DESPUBLICADA, etc)
          if (s === 'REJEITADA') {
            statusVagas.push(
              StatusDeVagas.DESPUBLICADA,
              StatusDeVagas.PAUSADA,
              StatusDeVagas.ENCERRADA,
              StatusDeVagas.EXPIRADO,
            );
          }
        } else {
          statusVagas.push(...mapStatusSolicitacaoToVaga(s as StatusSolicitacao));
        }
      });

      // RASCUNHO é compartilhado: com observacoes = REJEITADA, sem = CANCELADA
      // Incluir RASCUNHO se qualquer um dos dois foi solicitado
      if (incluiRejeitada || incluiCancelada) {
        statusVagas.push(StatusDeVagas.RASCUNHO);
      }

      if (statusVagas.length > 0) {
        where.status = { in: [...new Set(statusVagas)] }; // Remove duplicatas
      }

      // Adicionar filtro especial para RASCUNHO
      // - Se APENAS REJEITADA: RASCUNHO precisa ter observacoes
      // - Se APENAS CANCELADA: RASCUNHO NÃO pode ter observacoes
      // - Se AMBOS: não precisa filtrar observacoes
      if (incluiRejeitada && !incluiCancelada) {
        // REJEITADA apenas: RASCUNHO precisa ter observacoes
        andConditions.push({
          OR: [
            { status: { not: StatusDeVagas.RASCUNHO } },
            { status: StatusDeVagas.RASCUNHO, observacoes: { not: null } },
          ],
        });
      } else if (incluiCancelada && !incluiRejeitada) {
        // CANCELADA apenas: RASCUNHO não pode ter observacoes
        andConditions.push({
          OR: [
            { status: { not: StatusDeVagas.RASCUNHO } },
            { status: StatusDeVagas.RASCUNHO, observacoes: null },
          ],
        });
      }
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
        observacoes: true, // Campo para observações de aprovação
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
      // Status: RASCUNHO com observações = REJEITADA (vaga foi rejeitada e voltou para edição)
      status:
        vaga.status === StatusDeVagas.RASCUNHO && vaga.observacoes
          ? ('REJEITADA' as StatusSolicitacao)
          : (mapStatusVagaToSolicitacao(vaga.status) as StatusSolicitacao),
      dataSolicitacao: vaga.inseridaEm.toISOString(),
      // Data de resposta: quando a vaga foi aprovada/rejeitada
      // Inclui RASCUNHO com observações (foi rejeitada)
      dataResposta:
        vaga.status !== StatusDeVagas.EM_ANALISE &&
        (vaga.status !== StatusDeVagas.RASCUNHO || vaga.observacoes)
          ? vaga.atualizadoEm.toISOString()
          : null,
      // Motivo de rejeição: preenchido quando vaga foi rejeitada
      // RASCUNHO com observações = rejeitada, ou status DESPUBLICADA/PAUSADA/etc
      motivoRejeicao:
        ((vaga.status === StatusDeVagas.RASCUNHO && vaga.observacoes) ||
          vaga.status === StatusDeVagas.DESPUBLICADA ||
          vaga.status === StatusDeVagas.PAUSADA ||
          vaga.status === StatusDeVagas.ENCERRADA ||
          vaga.status === StatusDeVagas.EXPIRADO) &&
        vaga.observacoes
          ? vaga.observacoes
          : null,
      // Observações: usado para observações de aprovação (quando status = PUBLICADO)
      observacoes:
        vaga.status === StatusDeVagas.PUBLICADO && vaga.observacoes ? vaga.observacoes : null,
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
    await adminEmpresasService.approveVaga(vaga.usuarioId, vaga.id);

    // Salvar observações de aprovação (se fornecidas)
    // Isso atualiza o campo observacoes e a data de resposta (atualizadoEm)
    if (input.observacoes) {
      await prisma.empresasVagas.update({
        where: { id: vaga.id },
        data: {
          observacoes: input.observacoes,
          atualizadoEm: new Date(), // Data de aprovação (histórico)
        },
      });
    } else {
      // Mesmo sem observações, atualizar data de resposta para histórico
      await prisma.empresasVagas.update({
        where: { id: vaga.id },
        data: {
          atualizadoEm: new Date(), // Data de aprovação (histórico)
        },
      });
    }

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
        status: StatusDeVagas.RASCUNHO, // RASCUNHO para permitir edição e reenvio
        observacoes: input.motivoRejeicao, // Salvar motivo de rejeição no campo observacoes
        atualizadoEm: new Date(), // Data de rejeição
      },
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

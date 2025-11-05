/**
 * Serviço para auditoria de transações
 * @module auditoria/services/transacoes
 */

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  AuditoriaTransacaoInput,
  AuditoriaTransacaoResponse,
  PaginatedResponse,
} from '../types';

const transacoesLogger = logger.child({ module: 'TransacoesService' });

export class TransacoesService {
  /**
   * Registra uma nova transação
   */
  async registrarTransacao(input: AuditoriaTransacaoInput): Promise<AuditoriaTransacaoResponse> {
    try {
      const transacao = await prisma.auditoriaTransacoes.create({
        data: {
          tipo: input.tipo,
          status: 'PENDENTE' as any,
          valor: input.valor,
          moeda: input.moeda || 'BRL',
          referencia: input.referencia,
          gateway: input.gateway,
          gatewayId: input.gatewayId,
          usuarioId: input.usuarioId,
          empresaId: input.empresaId,
          metadata: input.metadata,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          empresa: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      transacoesLogger.info(
        { transacaoId: transacao.id, tipo: transacao.tipo, valor: transacao.valor },
        'Transação registrada',
      );

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, input }, 'Erro ao registrar transação');
      throw error;
    }
  }

  /**
   * Atualiza status de uma transação
   */
  async atualizarStatusTransacao(
    id: string,
    status: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaTransacaoResponse> {
    try {
      const transacao = await prisma.auditoriaTransacoes.update({
        where: { id },
        data: {
          status: status as any,
          processadoEm: new Date(),
          metadata: metadata ? { ...metadata } : undefined,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          empresa: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      transacoesLogger.info({ transacaoId: id, status }, 'Status da transação atualizado');

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, id, status }, 'Erro ao atualizar status da transação');
      throw error;
    }
  }

  /**
   * Lista transações com filtros
   */
  async listarTransacoes(
    filters: {
      tipo?: string;
      status?: string;
      usuarioId?: string;
      empresaId?: string;
      gateway?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    try {
      const where: any = {};

      if (filters.tipo) {
        where.tipo = filters.tipo;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      if (filters.empresaId) {
        where.empresaId = filters.empresaId;
      }

      if (filters.gateway) {
        where.gateway = filters.gateway;
      }

      if (filters.startDate || filters.endDate) {
        where.criadoEm = {};
        if (filters.startDate) {
          where.criadoEm.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.criadoEm.lte = new Date(filters.endDate);
        }
      }

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const [transacoes, total] = await Promise.all([
        prisma.auditoriaTransacoes.findMany({
          where,
          include: {
            usuario: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
                role: true,
              },
            },
            empresa: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.auditoriaTransacoes.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: transacoes.map((transacao) => this.formatTransacaoResponse(transacao)),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      transacoesLogger.error({ err: error, filters }, 'Erro ao listar transações');
      throw error;
    }
  }

  /**
   * Obtém uma transação específica
   */
  async obterTransacaoPorId(id: string): Promise<AuditoriaTransacaoResponse | null> {
    try {
      const transacao = await prisma.auditoriaTransacoes.findUnique({
        where: { id },
        include: {
          usuario: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
          empresa: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!transacao) {
        return null;
      }

      return this.formatTransacaoResponse(transacao);
    } catch (error) {
      transacoesLogger.error({ err: error, id }, 'Erro ao obter transação por ID');
      throw error;
    }
  }

  /**
   * Obtém transações por usuário
   */
  async obterTransacoesPorUsuario(
    usuarioId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    return this.listarTransacoes({
      usuarioId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém transações por empresa
   */
  async obterTransacoesPorEmpresa(
    empresaId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaTransacaoResponse>> {
    return this.listarTransacoes({
      empresaId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém estatísticas de transações
   */
  async obterEstatisticasTransacoes() {
    try {
      const [
        totalTransacoes,
        transacoesPorTipo,
        transacoesPorStatus,
        transacoesPorGateway,
        transacoesPorPeriodo,
        valorTotal,
        valorPorPeriodo,
      ] = await Promise.all([
        this.contarTransacoes(),
        this.obterTransacoesPorTipo(),
        this.obterTransacoesPorStatus(),
        this.obterTransacoesPorGateway(),
        this.obterTransacoesPorPeriodo(),
        this.calcularValorTotal(),
        this.calcularValorPorPeriodo(),
      ]);

      return {
        totalTransacoes,
        transacoesPorTipo,
        transacoesPorStatus,
        transacoesPorGateway,
        transacoesPorPeriodo,
        valorTotal,
        valorPorPeriodo,
      };
    } catch (error) {
      transacoesLogger.error({ err: error }, 'Erro ao obter estatísticas de transações');
      throw error;
    }
  }

  /**
   * Obtém resumo financeiro
   */
  async obterResumoFinanceiro() {
    try {
      const hoje = new Date();
      const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
      const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      const mesPassado = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        receitaHoje,
        receitaOntem,
        receitaSemana,
        receitaMes,
        transacoesHoje,
        transacoesOntem,
        transacoesSemana,
        transacoesMes,
      ] = await Promise.all([
        this.calcularReceitaPeriodo(hoje),
        this.calcularReceitaPeriodo(ontem, hoje),
        this.calcularReceitaPeriodo(semanaPassada),
        this.calcularReceitaPeriodo(mesPassado),
        this.contarTransacoesPeriodo(hoje),
        this.contarTransacoesPeriodo(ontem, hoje),
        this.contarTransacoesPeriodo(semanaPassada),
        this.contarTransacoesPeriodo(mesPassado),
      ]);

      return {
        receitaHoje,
        receitaOntem,
        receitaSemana,
        receitaMes,
        transacoesHoje,
        transacoesOntem,
        transacoesSemana,
        transacoesMes,
        tendenciaReceita: this.calcularTendencia(receitaHoje, receitaOntem),
        tendenciaTransacoes: this.calcularTendencia(transacoesHoje, transacoesOntem),
      };
    } catch (error) {
      transacoesLogger.error({ err: error }, 'Erro ao obter resumo financeiro');
      throw error;
    }
  }

  /**
   * Conta total de transações
   */
  private async contarTransacoes(): Promise<number> {
    return prisma.auditoriaTransacoes.count();
  }

  /**
   * Conta transações em um período
   */
  private async contarTransacoesPeriodo(startDate: Date, endDate?: Date): Promise<number> {
    const where: any = {
      criadoEm: { gte: startDate },
    };

    if (endDate) {
      where.criadoEm.lte = endDate;
    }

    return prisma.auditoriaTransacoes.count({ where });
  }

  /**
   * Obtém transações agrupadas por tipo
   */
  private async obterTransacoesPorTipo() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['tipo'],
      _count: { tipo: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.tipo] = item._count.tipo;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por status
   */
  private async obterTransacoesPorStatus() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por gateway
   */
  private async obterTransacoesPorGateway() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['gateway'],
      where: { gateway: { not: null } },
      _count: { gateway: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.gateway || 'N/A'] = item._count.gateway;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém transações agrupadas por período
   */
  private async obterTransacoesPorPeriodo() {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['criadoEm'],
      where: {
        criadoEm: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      },
      _count: { criadoEm: true },
    });

    return result.map((item) => ({
      data: item.criadoEm.toISOString().split('T')[0],
      total: item._count.criadoEm,
    }));
  }

  /**
   * Calcula valor total das transações
   */
  private async calcularValorTotal(): Promise<number> {
    const result = await prisma.auditoriaTransacoes.aggregate({
      _sum: { valor: true },
    });

    return Number(result._sum.valor) || 0;
  }

  /**
   * Calcula valor por período
   */
  private async calcularValorPorPeriodo(): Promise<{ data: string; valor: number }[]> {
    const result = await prisma.auditoriaTransacoes.groupBy({
      by: ['criadoEm'],
      where: {
        criadoEm: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias
        },
      },
      _sum: { valor: true },
    });

    return result.map((item) => ({
      data: item.criadoEm.toISOString().split('T')[0],
      valor: Number(item._sum.valor) || 0,
    }));
  }

  /**
   * Calcula receita em um período
   */
  private async calcularReceitaPeriodo(startDate: Date, endDate?: Date): Promise<number> {
    const where: any = {
      criadoEm: { gte: startDate },
      status: 'APROVADA',
    };

    if (endDate) {
      where.criadoEm.lte = endDate;
    }

    const result = await prisma.auditoriaTransacoes.aggregate({
      where,
      _sum: { valor: true },
    });

    return Number(result._sum.valor) || 0;
  }

  /**
   * Calcula tendência
   */
  private calcularTendencia(hoje: number, ontem: number): 'crescendo' | 'diminuindo' | 'estavel' {
    if (hoje > ontem) return 'crescendo';
    if (hoje < ontem) return 'diminuindo';
    return 'estavel';
  }

  /**
   * Formata resposta da transação
   */
  private formatTransacaoResponse(transacao: any): AuditoriaTransacaoResponse {
    return {
      id: transacao.id,
      tipo: transacao.tipo,
      status: transacao.status,
      valor: transacao.valor,
      moeda: transacao.moeda,
      referencia: transacao.referencia,
      gateway: transacao.gateway,
      gatewayId: transacao.gatewayId,
      usuarioId: transacao.usuarioId,
      empresaId: transacao.empresaId,
      metadata: transacao.metadata,
      criadoEm: transacao.criadoEm,
      processadoEm: transacao.processadoEm,
      usuario: transacao.usuario,
      empresa: transacao.empresa,
    };
  }
}

export const transacoesService = new TransacoesService();

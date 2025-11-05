/**
 * Serviço para auditoria de assinaturas
 * @module auditoria/services/assinaturas
 */

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { AuditoriaLogResponse, PaginatedResponse } from '../types';

const assinaturasLogger = logger.child({ module: 'AssinaturasService' });

export class AssinaturasService {
  /**
   * Obtém logs de assinaturas
   */
  async obterLogsAssinaturas(
    filters: {
      usuarioId?: string;
      empresaId?: string;
      tipo?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      const where: any = {
        categoria: 'PAGAMENTO',
        tipo: 'ASSINATURA',
      };

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      if (filters.empresaId) {
        where.entidadeId = filters.empresaId;
        where.entidadeTipo = 'EMPRESA';
      }

      if (filters.tipo) {
        where.acao = { contains: filters.tipo, mode: 'insensitive' };
      }

      if (filters.status) {
        where.metadata = {
          path: ['status'],
          equals: filters.status,
        };
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

      const [logs, total] = await Promise.all([
        prisma.auditoriaLogs.findMany({
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
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.auditoriaLogs.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: logs.map((log) => this.formatLogResponse(log)),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      assinaturasLogger.error({ err: error, filters }, 'Erro ao obter logs de assinaturas');
      throw error;
    }
  }

  /**
   * Obtém logs de pagamentos de assinaturas
   */
  async obterLogsPagamentos(
    filters: {
      usuarioId?: string;
      empresasPlanoId?: string;
      tipo?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: any = {};

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      if (filters.empresasPlanoId) {
        where.empresasPlanoId = filters.empresasPlanoId;
      }

      if (filters.tipo) {
        where.tipo = filters.tipo;
      }

      if (filters.status) {
        where.status = filters.status;
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

      const [logs, total] = await Promise.all([
        prisma.logsPagamentosDeAssinaturas.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.logsPagamentosDeAssinaturas.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: logs,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      assinaturasLogger.error({ err: error, filters }, 'Erro ao obter logs de pagamentos');
      throw error;
    }
  }

  /**
   * Obtém logs de planos empresariais
   */
  async obterLogsPlanos(
    filters: {
      empresaId?: string;
      planoId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<any>> {
    try {
      const where: any = {};

      if (filters.empresaId) {
        where.usuarioId = filters.empresaId;
      }

      if (filters.planoId) {
        where.planosEmpresariaisId = filters.planoId;
      }

      if (filters.status) {
        where.status = filters.status;
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

      const [planos, total] = await Promise.all([
        prisma.empresasPlano.findMany({
          where,
          include: {
            empresa: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
                role: true,
              },
            },
            plano: {
              select: {
                id: true,
                nome: true,
                descricao: true,
                valor: true,
              },
            },
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.empresasPlano.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: planos,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      assinaturasLogger.error({ err: error, filters }, 'Erro ao obter logs de planos');
      throw error;
    }
  }

  /**
   * Obtém estatísticas de assinaturas
   */
  async obterEstatisticasAssinaturas() {
    try {
      const [
        totalAssinaturas,
        assinaturasPorStatus,
        assinaturasPorTipo,
        assinaturasPorPeriodo,
        receitaTotal,
        receitaPorPeriodo,
      ] = await Promise.all([
        this.contarAssinaturas(),
        this.obterAssinaturasPorStatus(),
        this.obterAssinaturasPorTipo(),
        this.obterAssinaturasPorPeriodo(),
        this.calcularReceitaTotal(),
        this.calcularReceitaPorPeriodo(),
      ]);

      return {
        totalAssinaturas,
        assinaturasPorStatus,
        assinaturasPorTipo,
        assinaturasPorPeriodo,
        receitaTotal,
        receitaPorPeriodo,
      };
    } catch (error) {
      assinaturasLogger.error({ err: error }, 'Erro ao obter estatísticas de assinaturas');
      throw error;
    }
  }

  /**
   * Obtém resumo de assinaturas ativas
   */
  async obterResumoAssinaturasAtivas() {
    try {
      const hoje = new Date();
      const mesPassado = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalAtivas, novasEsteMes, canceladasEsteMes, renovacoesEsteMes, receitaEsteMes] =
        await Promise.all([
          this.contarAssinaturasAtivas(),
          this.contarNovasAssinaturas(mesPassado),
          this.contarCancelamentos(mesPassado),
          this.contarRenovacoes(mesPassado),
          this.calcularReceitaPeriodo(mesPassado),
        ]);

      return {
        totalAtivas,
        novasEsteMes,
        canceladasEsteMes,
        renovacoesEsteMes,
        receitaEsteMes,
        taxaRetencao: this.calcularTaxaRetencao(novasEsteMes, canceladasEsteMes),
      };
    } catch (error) {
      assinaturasLogger.error({ err: error }, 'Erro ao obter resumo de assinaturas ativas');
      throw error;
    }
  }

  /**
   * Conta total de assinaturas
   */
  private async contarAssinaturas(): Promise<number> {
    return prisma.empresasPlano.count();
  }

  /**
   * Conta assinaturas ativas
   */
  private async contarAssinaturasAtivas(): Promise<number> {
    return prisma.empresasPlano.count({
      where: { status: 'ATIVO' },
    });
  }

  /**
   * Conta novas assinaturas em um período
   */
  private async contarNovasAssinaturas(startDate: Date): Promise<number> {
    return prisma.empresasPlano.count({
      where: {
        criadoEm: { gte: startDate },
        status: 'ATIVO',
      },
    });
  }

  /**
   * Conta cancelamentos em um período
   */
  private async contarCancelamentos(startDate: Date): Promise<number> {
    return prisma.empresasPlano.count({
      where: {
        atualizadoEm: { gte: startDate },
        status: 'CANCELADO',
      },
    });
  }

  /**
   * Conta renovações em um período
   */
  private async contarRenovacoes(startDate: Date): Promise<number> {
    return prisma.empresasPlano.count({
      where: {
        atualizadoEm: { gte: startDate },
        status: 'ATIVO',
        criadoEm: { lt: startDate },
      },
    });
  }

  /**
   * Obtém assinaturas agrupadas por status
   */
  private async obterAssinaturasPorStatus() {
    const result = await prisma.empresasPlano.groupBy({
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
   * Obtém assinaturas agrupadas por tipo
   */
  private async obterAssinaturasPorTipo() {
    const result = await prisma.empresasPlano.groupBy({
      by: ['modo'],
      _count: { modo: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.modo] = item._count.modo;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém assinaturas agrupadas por período
   */
  private async obterAssinaturasPorPeriodo() {
    const result = await prisma.empresasPlano.groupBy({
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
   * Calcula receita total
   */
  private async calcularReceitaTotal(): Promise<number> {
    // Por enquanto, retorna 0 pois não há campo de valor direto na tabela EmpresasPlano
    // O valor está na tabela PlanosEmpresariais
    return 0;
  }

  /**
   * Calcula receita por período
   */
  private async calcularReceitaPorPeriodo(): Promise<{ data: string; valor: number }[]> {
    // Implementar lógica de cálculo de receita por período
    // Por enquanto, retorna array vazio
    return [];
  }

  /**
   * Calcula receita em um período específico
   */
  private async calcularReceitaPeriodo(_startDate: Date): Promise<number> {
    // Implementar lógica de cálculo de receita
    // Por enquanto, retorna 0
    return 0;
  }

  /**
   * Calcula taxa de retenção
   */
  private calcularTaxaRetencao(novas: number, canceladas: number): number {
    if (novas === 0) return 0;
    return ((novas - canceladas) / novas) * 100;
  }

  /**
   * Formata resposta do log
   */
  private formatLogResponse(log: any): AuditoriaLogResponse {
    return {
      id: log.id,
      categoria: log.categoria,
      tipo: log.tipo,
      acao: log.acao,
      usuarioId: log.usuarioId,
      entidadeId: log.entidadeId,
      entidadeTipo: log.entidadeTipo,
      descricao: log.descricao,
      dadosAnteriores: log.dadosAnteriores,
      dadosNovos: log.dadosNovos,
      metadata: log.metadata,
      ip: log.ip,
      userAgent: log.userAgent,
      criadoEm: log.criadoEm,
      usuario: log.usuario,
    };
  }
}

export const assinaturasService = new AssinaturasService();

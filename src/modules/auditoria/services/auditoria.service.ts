/**
 * Serviço principal de auditoria
 * @module auditoria/services/auditoria
 */

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  AuditoriaLogInput,
  AuditoriaLogResponse,
  AuditoriaFilters,
  AuditoriaStats,
  PaginatedResponse,
} from '../types';

const auditoriaLogger = logger.child({ module: 'AuditoriaService' });

export class AuditoriaService {
  /**
   * Registra um log de auditoria
   */
  async registrarLog(input: AuditoriaLogInput): Promise<AuditoriaLogResponse> {
    try {
      const log = await prisma.auditoriaLogs.create({
        data: {
          categoria: input.categoria,
          tipo: input.tipo,
          acao: input.acao,
          usuarioId: input.usuarioId,
          entidadeId: input.entidadeId,
          entidadeTipo: input.entidadeTipo,
          descricao: input.descricao,
          dadosAnteriores: input.dadosAnteriores,
          dadosNovos: input.dadosNovos,
          metadata: input.metadata,
          ip: input.ip,
          userAgent: input.userAgent,
        },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      auditoriaLogger.info(
        { logId: log.id, categoria: log.categoria, tipo: log.tipo },
        'Log de auditoria registrado',
      );

      return this.formatLogResponse(log);
    } catch (error) {
      auditoriaLogger.error({ err: error, input }, 'Erro ao registrar log de auditoria');
      throw error;
    }
  }

  /**
   * Lista logs de auditoria com filtros
   */
  async listarLogs(filters: AuditoriaFilters): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      const where: any = {};

      if (filters.categoria) {
        where.categoria = filters.categoria;
      }

      if (filters.tipo) {
        where.tipo = { contains: filters.tipo, mode: 'insensitive' };
      }

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      if (filters.entidadeId) {
        where.entidadeId = filters.entidadeId;
      }

      if (filters.entidadeTipo) {
        where.entidadeTipo = filters.entidadeTipo;
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

      if (filters.search) {
        where.OR = [
          { descricao: { contains: filters.search, mode: 'insensitive' } },
          { tipo: { contains: filters.search, mode: 'insensitive' } },
          { acao: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const [logs, total] = await Promise.all([
        prisma.auditoriaLogs.findMany({
          where,
          include: {
            Usuarios: {
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
      auditoriaLogger.error({ err: error, filters }, 'Erro ao listar logs de auditoria');
      throw error;
    }
  }

  /**
   * Obtém estatísticas de auditoria
   */
  async obterEstatisticas(filters: Partial<AuditoriaFilters> = {}): Promise<AuditoriaStats> {
    try {
      const where: any = {};

      if (filters.startDate || filters.endDate) {
        where.criadoEm = {};
        if (filters.startDate) {
          where.criadoEm.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.criadoEm.lte = new Date(filters.endDate);
        }
      }

      if (filters.categoria) {
        where.categoria = filters.categoria;
      }

      if (filters.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      const [totalLogs, logsPorCategoria, logsPorTipo, logsPorUsuario, logsPorPeriodo] =
        await Promise.all([
          prisma.auditoriaLogs.count({ where }),
          this.obterLogsPorCategoria(where),
          this.obterLogsPorTipo(where),
          this.obterLogsPorUsuario(where),
          this.obterLogsPorPeriodo(where),
        ]);

      return {
        totalLogs,
        logsPorCategoria,
        logsPorTipo,
        logsPorUsuario,
        logsPorPeriodo,
      };
    } catch (error) {
      auditoriaLogger.error({ err: error, filters }, 'Erro ao obter estatísticas de auditoria');
      throw error;
    }
  }

  /**
   * Obtém um log específico por ID
   */
  async obterLogPorId(id: string): Promise<AuditoriaLogResponse | null> {
    try {
      const log = await prisma.auditoriaLogs.findUnique({
        where: { id },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!log) {
        return null;
      }

      return this.formatLogResponse(log);
    } catch (error) {
      auditoriaLogger.error({ err: error, id }, 'Erro ao obter log por ID');
      throw error;
    }
  }

  /**
   * Formata a resposta do log
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
      usuario: log.Usuarios,
    };
  }

  /**
   * Obtém logs agrupados por categoria
   */
  private async obterLogsPorCategoria(where: any): Promise<Record<string, number>> {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['categoria'],
      where,
      _count: { categoria: true },
    });

    return result.reduce(
      (acc, item) => {
        acc[item.categoria] = item._count.categoria;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Obtém logs agrupados por tipo
   */
  private async obterLogsPorTipo(where: any): Promise<Record<string, number>> {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['tipo'],
      where,
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
   * Obtém logs agrupados por usuário
   */
  private async obterLogsPorUsuario(
    where: any,
  ): Promise<{ usuarioId: string; nomeCompleto: string; total: number }[]> {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['usuarioId'],
      where: { ...where, usuarioId: { not: null } },
      _count: { usuarioId: true },
    });

    const usuarioIds = result
      .map((item) => item.usuarioId)
      .filter((id): id is string => Boolean(id));
    const usuarios = await prisma.usuarios.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, nomeCompleto: true },
    });

    const usuarioMap = new Map(usuarios.map((u) => [u.id, u.nomeCompleto]));

    return result.map((item) => ({
      usuarioId: item.usuarioId!,
      nomeCompleto: usuarioMap.get(item.usuarioId!) || 'Usuário não encontrado',
      total: item._count.usuarioId,
    }));
  }

  /**
   * Obtém logs agrupados por período (últimos 30 dias)
   */
  private async obterLogsPorPeriodo(where: any): Promise<{ data: string; total: number }[]> {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['criadoEm'],
      where: {
        ...where,
        criadoEm: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
        },
      },
      _count: { criadoEm: true },
    });

    return result.map((item) => ({
      data: item.criadoEm.toISOString().split('T')[0],
      total: item._count.criadoEm,
    }));
  }
}

export const auditoriaService = new AuditoriaService();

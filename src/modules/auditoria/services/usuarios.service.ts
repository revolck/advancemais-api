/**
 * Serviço para histórico de usuários
 * @module auditoria/services/usuarios
 */

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { auditoriaService } from './auditoria.service';
import type { AuditoriaLogResponse, PaginatedResponse } from '../types';

const usuariosLogger = logger.child({ module: 'UsuariosService' });

export class UsuariosService {
  /**
   * Obtém histórico completo de um usuário
   */
  async obterHistoricoUsuario(
    usuarioId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      return auditoriaService.listarLogs({
        usuarioId,
        page,
        pageSize,
      });
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter histórico do usuário');
      throw error;
    }
  }

  /**
   * Obtém histórico de login do usuário
   */
  async obterHistoricoLogin(
    usuarioId: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      return auditoriaService.listarLogs({
        usuarioId,
        categoria: 'SEGURANCA' as any,
        tipo: 'LOGIN',
        startDate,
        endDate,
        page,
        pageSize,
      });
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter histórico de login');
      throw error;
    }
  }

  /**
   * Obtém histórico de alterações de perfil
   */
  async obterHistoricoAlteracoesPerfil(
    usuarioId: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      return auditoriaService.listarLogs({
        usuarioId,
        categoria: 'USUARIO' as any,
        tipo: 'ALTERACAO_PERFIL',
        startDate,
        endDate,
        page,
        pageSize,
      });
    } catch (error) {
      usuariosLogger.error(
        { err: error, usuarioId },
        'Erro ao obter histórico de alterações de perfil',
      );
      throw error;
    }
  }

  /**
   * Obtém histórico de ações do usuário
   */
  async obterHistoricoAcoes(
    usuarioId: string,
    tipo?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      return auditoriaService.listarLogs({
        usuarioId,
        tipo,
        startDate,
        endDate,
        page,
        pageSize,
      });
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter histórico de ações');
      throw error;
    }
  }

  /**
   * Obtém histórico de acessos a recursos
   */
  async obterHistoricoAcessos(
    usuarioId: string,
    recurso?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    try {
      return auditoriaService.listarLogs({
        usuarioId,
        categoria: 'SEGURANCA' as any,
        tipo: 'ACESSO_RECURSO',
        startDate,
        endDate,
        page,
        pageSize,
      });
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter histórico de acessos');
      throw error;
    }
  }

  /**
   * Obtém estatísticas do usuário
   */
  async obterEstatisticasUsuario(usuarioId: string) {
    try {
      // Queries sequenciais para evitar saturar pool no Supabase Free
      const totalAcoes = await this.contarAcoesUsuario(usuarioId);
      const acoesPorTipo = await this.obterAcoesPorTipo(usuarioId);
      const acoesPorPeriodo = await this.obterAcoesPorPeriodo(usuarioId);
      const ultimaAtividade = await this.obterUltimaAtividade(usuarioId);

      return {
        totalAcoes,
        acoesPorTipo,
        acoesPorPeriodo,
        ultimaAtividade,
      };
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter estatísticas do usuário');
      throw error;
    }
  }

  /**
   * Obtém resumo de atividade do usuário
   */
  async obterResumoAtividade(usuarioId: string) {
    try {
      const hoje = new Date();
      const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
      const semanaPassada = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      const mesPassado = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Queries sequenciais para evitar saturar pool no Supabase Free
      const acoesHoje = await this.contarAcoesUsuario(usuarioId, hoje.toISOString());
      const acoesOntem = await this.contarAcoesUsuario(usuarioId, ontem.toISOString(), hoje.toISOString());
      const acoesSemana = await this.contarAcoesUsuario(usuarioId, semanaPassada.toISOString());
      const acoesMes = await this.contarAcoesUsuario(usuarioId, mesPassado.toISOString());

      return {
        acoesHoje,
        acoesOntem,
        acoesSemana,
        acoesMes,
        tendencia: this.calcularTendencia(acoesHoje, acoesOntem),
      };
    } catch (error) {
      usuariosLogger.error({ err: error, usuarioId }, 'Erro ao obter resumo de atividade');
      throw error;
    }
  }

  /**
   * Conta ações do usuário
   */
  private async contarAcoesUsuario(
    usuarioId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<number> {
    const where: any = { usuarioId };

    if (startDate || endDate) {
      where.criadoEm = {};
      if (startDate) {
        where.criadoEm.gte = new Date(startDate);
      }
      if (endDate) {
        where.criadoEm.lte = new Date(endDate);
      }
    }

    return prisma.auditoriaLogs.count({ where });
  }

  /**
   * Obtém ações agrupadas por tipo
   */
  private async obterAcoesPorTipo(usuarioId: string) {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['tipo'],
      where: { usuarioId },
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
   * Obtém ações agrupadas por período
   */
  private async obterAcoesPorPeriodo(usuarioId: string) {
    const result = await prisma.auditoriaLogs.groupBy({
      by: ['criadoEm'],
      where: {
        usuarioId,
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
   * Obtém última atividade do usuário
   */
  private async obterUltimaAtividade(usuarioId: string) {
    const ultimaAtividade = await prisma.auditoriaLogs.findFirst({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      select: {
        tipo: true,
        acao: true,
        descricao: true,
        criadoEm: true,
      },
    });

    return ultimaAtividade;
  }

  /**
   * Calcula tendência de atividade
   */
  private calcularTendencia(hoje: number, ontem: number): 'crescendo' | 'diminuindo' | 'estavel' {
    if (hoje > ontem) return 'crescendo';
    if (hoje < ontem) return 'diminuindo';
    return 'estavel';
  }
}

export const usuariosService = new UsuariosService();

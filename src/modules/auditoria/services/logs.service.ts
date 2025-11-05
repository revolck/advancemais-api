/**
 * Serviço específico para logs de auditoria
 * @module auditoria/services/logs
 */

import { auditoriaService } from './auditoria.service';
import type { AuditoriaLogResponse, AuditoriaFilters, PaginatedResponse } from '../types';

export class LogsService {
  /**
   * Registra um log de sistema
   */
  async registrarLogSistema(
    tipo: string,
    acao: string,
    descricao: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'SISTEMA' as any,
      tipo,
      acao,
      descricao,
      metadata,
    });
  }

  /**
   * Registra um log de usuário
   */
  async registrarLogUsuario(
    usuarioId: string,
    tipo: string,
    acao: string,
    descricao: string,
    entidadeId?: string,
    entidadeTipo?: string,
    dadosAnteriores?: Record<string, any>,
    dadosNovos?: Record<string, any>,
    metadata?: Record<string, any>,
    ip?: string,
    userAgent?: string,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'USUARIO' as any,
      tipo,
      acao,
      descricao,
      usuarioId,
      entidadeId,
      entidadeTipo,
      dadosAnteriores,
      dadosNovos,
      metadata,
      ip,
      userAgent,
    });
  }

  /**
   * Registra um log de segurança
   */
  async registrarLogSeguranca(
    tipo: string,
    acao: string,
    descricao: string,
    usuarioId?: string,
    ip?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<AuditoriaLogResponse> {
    return auditoriaService.registrarLog({
      categoria: 'SEGURANCA' as any,
      tipo,
      acao,
      descricao,
      usuarioId,
      metadata,
      ip,
      userAgent,
    });
  }

  /**
   * Lista logs com filtros específicos
   */
  async listarLogs(filters: AuditoriaFilters): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs(filters);
  }

  /**
   * Obtém logs por usuário
   */
  async obterLogsPorUsuario(
    usuarioId: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      usuarioId,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs por entidade
   */
  async obterLogsPorEntidade(
    entidadeId: string,
    entidadeTipo?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      entidadeId,
      entidadeTipo,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de erro do sistema
   */
  async obterLogsErro(
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'SISTEMA' as any,
      tipo: 'ERRO',
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de acesso
   */
  async obterLogsAcesso(
    usuarioId?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'SEGURANCA' as any,
      tipo: 'ACESSO',
      usuarioId,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém logs de alteração de dados
   */
  async obterLogsAlteracao(
    entidadeTipo?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedResponse<AuditoriaLogResponse>> {
    return auditoriaService.listarLogs({
      categoria: 'USUARIO' as any,
      tipo: 'ALTERACAO',
      entidadeTipo,
      startDate,
      endDate,
      page,
      pageSize,
    });
  }

  /**
   * Obtém estatísticas de logs
   */
  async obterEstatisticas(filters: Partial<AuditoriaFilters> = {}) {
    return auditoriaService.obterEstatisticas(filters);
  }

  /**
   * Obtém um log específico
   */
  async obterLogPorId(id: string): Promise<AuditoriaLogResponse | null> {
    return auditoriaService.obterLogPorId(id);
  }

  /**
   * Exporta logs para CSV
   */
  async exportarLogs(filters: AuditoriaFilters): Promise<string> {
    const logs = await auditoriaService.listarLogs({
      ...filters,
      pageSize: 10000, // Limite alto para exportação
    });

    const headers = [
      'ID',
      'Categoria',
      'Tipo',
      'Ação',
      'Usuário',
      'Entidade ID',
      'Entidade Tipo',
      'Descrição',
      'IP',
      'Data/Hora',
    ];

    const rows = logs.items.map((log) => [
      log.id,
      log.categoria,
      log.tipo,
      log.acao,
      log.usuario?.nomeCompleto || '',
      log.entidadeId || '',
      log.entidadeTipo || '',
      log.descricao,
      log.ip || '',
      log.criadoEm.toISOString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export const logsService = new LogsService();

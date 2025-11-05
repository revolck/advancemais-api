/**
 * Serviço para auditoria de scripts
 * @module auditoria/services/scripts
 */

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type { AuditoriaScriptInput, AuditoriaScriptResponse, PaginatedResponse } from '../types';

const scriptsLogger = logger.child({ module: 'ScriptsService' });

export class ScriptsService {
  /**
   * Registra um novo script
   */
  async registrarScript(
    input: AuditoriaScriptInput,
    executadoPor: string,
  ): Promise<AuditoriaScriptResponse> {
    try {
      const script = await prisma.auditoriaScripts.create({
        data: {
          nome: input.nome,
          descricao: input.descricao,
          tipo: input.tipo,
          status: 'PENDENTE' as any,
          executadoPor,
          parametros: input.parametros,
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

      scriptsLogger.info(
        { scriptId: script.id, nome: script.nome, tipo: script.tipo },
        'Script registrado',
      );

      return this.formatScriptResponse(script);
    } catch (error) {
      scriptsLogger.error({ err: error, input }, 'Erro ao registrar script');
      throw error;
    }
  }

  /**
   * Executa um script
   */
  async executarScript(id: string, _executadoPor: string): Promise<AuditoriaScriptResponse> {
    try {
      const script = await prisma.auditoriaScripts.findUnique({
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

      if (!script) {
        throw new Error('Script não encontrado');
      }

      if (script.status !== 'PENDENTE') {
        throw new Error('Script já foi executado ou está em execução');
      }

      const inicioExecucao = Date.now();

      // Atualiza status para EXECUTANDO
      await prisma.auditoriaScripts.update({
        where: { id },
        data: {
          status: 'EXECUTANDO' as any,
          executadoEm: new Date(),
        },
      });

      try {
        // Aqui seria a lógica de execução do script
        // Por enquanto, simulamos uma execução
        const resultado = await this.executarScriptLogic(script);
        const duracaoMs = Date.now() - inicioExecucao;

        const scriptAtualizado = await prisma.auditoriaScripts.update({
          where: { id },
          data: {
            status: 'CONCLUIDO' as any,
            resultado,
            duracaoMs,
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

        scriptsLogger.info({ scriptId: id, duracaoMs }, 'Script executado com sucesso');

        return this.formatScriptResponse(scriptAtualizado);
      } catch (error) {
        const duracaoMs = Date.now() - inicioExecucao;

        const scriptAtualizado = await prisma.auditoriaScripts.update({
          where: { id },
          data: {
            status: 'ERRO' as any,
            erro: error instanceof Error ? error.message : 'Erro desconhecido',
            duracaoMs,
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

        scriptsLogger.error({ scriptId: id, erro: error, duracaoMs }, 'Erro ao executar script');

        return this.formatScriptResponse(scriptAtualizado);
      }
    } catch (error) {
      scriptsLogger.error({ err: error, id }, 'Erro ao executar script');
      throw error;
    }
  }

  /**
   * Lista scripts com filtros
   */
  async listarScripts(
    filters: {
      tipo?: string;
      status?: string;
      executadoPor?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResponse<AuditoriaScriptResponse>> {
    try {
      const where: any = {};

      if (filters.tipo) {
        where.tipo = filters.tipo;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.executadoPor) {
        where.executadoPor = filters.executadoPor;
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

      const [scripts, total] = await Promise.all([
        prisma.auditoriaScripts.findMany({
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
        prisma.auditoriaScripts.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        items: scripts.map((script) => this.formatScriptResponse(script)),
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      scriptsLogger.error({ err: error, filters }, 'Erro ao listar scripts');
      throw error;
    }
  }

  /**
   * Obtém um script específico
   */
  async obterScriptPorId(id: string): Promise<AuditoriaScriptResponse | null> {
    try {
      const script = await prisma.auditoriaScripts.findUnique({
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

      if (!script) {
        return null;
      }

      return this.formatScriptResponse(script);
    } catch (error) {
      scriptsLogger.error({ err: error, id }, 'Erro ao obter script por ID');
      throw error;
    }
  }

  /**
   * Atualiza um script
   */
  async atualizarScript(
    id: string,
    updates: Partial<AuditoriaScriptInput>,
  ): Promise<AuditoriaScriptResponse> {
    try {
      const script = await prisma.auditoriaScripts.update({
        where: { id },
        data: updates,
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

      scriptsLogger.info({ scriptId: id, updates }, 'Script atualizado com sucesso');
      return this.formatScriptResponse(script);
    } catch (error) {
      scriptsLogger.error({ err: error, id, updates }, 'Erro ao atualizar script');
      throw error;
    }
  }

  /**
   * Cancela um script pendente
   */
  async cancelarScript(id: string): Promise<AuditoriaScriptResponse> {
    try {
      const script = await prisma.auditoriaScripts.findUnique({
        where: { id },
      });

      if (!script) {
        throw new Error('Script não encontrado');
      }

      if (script.status !== 'PENDENTE') {
        throw new Error('Apenas scripts pendentes podem ser cancelados');
      }

      const scriptAtualizado = await prisma.auditoriaScripts.update({
        where: { id },
        data: {
          status: 'CANCELADO' as any,
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

      scriptsLogger.info({ scriptId: id }, 'Script cancelado');

      return this.formatScriptResponse(scriptAtualizado);
    } catch (error) {
      scriptsLogger.error({ err: error, id }, 'Erro ao cancelar script');
      throw error;
    }
  }

  /**
   * Obtém estatísticas de scripts
   */
  async obterEstatisticas() {
    try {
      const [totalScripts, scriptsPorTipo, scriptsPorStatus, scriptsPorUsuario, scriptsPorPeriodo] =
        await Promise.all([
          prisma.auditoriaScripts.count(),
          this.obterScriptsPorTipo(),
          this.obterScriptsPorStatus(),
          this.obterScriptsPorUsuario(),
          this.obterScriptsPorPeriodo(),
        ]);

      return {
        totalScripts,
        scriptsPorTipo,
        scriptsPorStatus,
        scriptsPorUsuario,
        scriptsPorPeriodo,
      };
    } catch (error) {
      scriptsLogger.error({ err: error }, 'Erro ao obter estatísticas de scripts');
      throw error;
    }
  }

  /**
   * Lógica de execução do script (simulada)
   */
  private async executarScriptLogic(script: any): Promise<Record<string, any>> {
    // Simula execução do script
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      sucesso: true,
      registrosProcessados: Math.floor(Math.random() * 1000),
      tempoExecucao: Date.now(),
      parametros: script.parametros,
    };
  }

  /**
   * Formata a resposta do script
   */
  private formatScriptResponse(script: any): AuditoriaScriptResponse {
    return {
      id: script.id,
      nome: script.nome,
      descricao: script.descricao,
      tipo: script.tipo,
      status: script.status,
      executadoPor: script.executadoPor,
      parametros: script.parametros,
      resultado: script.resultado,
      erro: script.erro,
      duracaoMs: script.duracaoMs,
      criadoEm: script.criadoEm,
      executadoEm: script.executadoEm,
      Usuarios: script.Usuarios,
    };
  }

  /**
   * Obtém scripts agrupados por tipo
   */
  private async obterScriptsPorTipo() {
    const result = await prisma.auditoriaScripts.groupBy({
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
   * Obtém scripts agrupados por status
   */
  private async obterScriptsPorStatus() {
    const result = await prisma.auditoriaScripts.groupBy({
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
   * Obtém scripts agrupados por usuário
   */
  private async obterScriptsPorUsuario() {
    const result = await prisma.auditoriaScripts.groupBy({
      by: ['executadoPor'],
      _count: { executadoPor: true },
    });

    const usuarioIds = result.map((item) => item.executadoPor);
    const usuarios = await prisma.usuarios.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, nomeCompleto: true },
    });

    const usuarioMap = new Map(usuarios.map((u) => [u.id, u.nomeCompleto]));

    return result.map((item) => ({
      usuarioId: item.executadoPor,
      nomeCompleto: usuarioMap.get(item.executadoPor) || 'Usuário não encontrado',
      total: item._count.executadoPor,
    }));
  }

  /**
   * Obtém scripts agrupados por período
   */
  private async obterScriptsPorPeriodo() {
    const result = await prisma.auditoriaScripts.groupBy({
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
}

export const scriptsService = new ScriptsService();

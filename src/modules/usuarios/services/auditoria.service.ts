import { Injectable, Logger } from '@nestjs/common';
import { TipoAcao } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';

/**
 * 📝 Interface para criação de log de auditoria
 */
export interface CriarLogAuditoriaDto {
  usuarioId?: string;
  acao: TipoAcao | string;
  descricao: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * 📊 Interface para filtros de auditoria
 */
export interface FiltroAuditoriaDto {
  usuarioId?: string;
  acao?: TipoAcao;
  dataInicio?: Date;
  dataFim?: Date;
  pagina?: number;
  limite?: number;
}

/**
 * 📝 Service para gestão de auditoria e logs
 * Registra todas as ações importantes do sistema
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private database: DatabaseService) {}

  /**
   * ➕ Criar log de auditoria
   */
  async criarLog(dados: CriarLogAuditoriaDto): Promise<void> {
    try {
      await this.database.logAuditoria.create({
        data: {
          usuarioId: dados.usuarioId,
          acao: dados.acao as TipoAcao,
          descricao: dados.descricao,
          ipAddress: dados.ipAddress,
          userAgent: dados.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao criar log de auditoria:', error);
      // 🚨 Não propagar erro para não quebrar operação principal
    }
  }

  /**
   * 📋 Listar logs de auditoria com filtros
   */
  async listarLogs(filtros: FiltroAuditoriaDto = {}): Promise<{
    logs: any[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    try {
      const {
        usuarioId,
        acao,
        dataInicio,
        dataFim,
        pagina = 1,
        limite = 50,
      } = filtros;

      // 🔍 Construir filtros WHERE
      const where: any = {};

      if (usuarioId) {
        where.usuarioId = usuarioId;
      }

      if (acao) {
        where.acao = acao;
      }

      if (dataInicio || dataFim) {
        where.criadoEm = {};

        if (dataInicio) {
          where.criadoEm.gte = dataInicio;
        }

        if (dataFim) {
          where.criadoEm.lte = dataFim;
        }
      }

      // 📊 Calcular paginação
      const skip = (pagina - 1) * limite;

      // 📋 Buscar logs
      const [logs, total] = await Promise.all([
        this.database.logAuditoria.findMany({
          where,
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                email: true,
                matricula: true,
              },
            },
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: limite,
        }),
        this.database.logAuditoria.count({ where }),
      ]);

      const totalPaginas = Math.ceil(total / limite);

      return {
        logs,
        total,
        pagina,
        limite,
        totalPaginas,
      };
    } catch (error) {
      this.logger.error('Erro ao listar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar logs por usuário
   */
  async buscarLogsPorUsuario(
    usuarioId: string,
    limite: number = 20,
  ): Promise<any[]> {
    try {
      return await this.database.logAuditoria.findMany({
        where: { usuarioId },
        orderBy: { criadoEm: 'desc' },
        take: limite,
        select: {
          id: true,
          acao: true,
          descricao: true,
          ipAddress: true,
          criadoEm: true,
        },
      });
    } catch (error) {
      this.logger.error(`Erro ao buscar logs do usuário ${usuarioId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Obter estatísticas de auditoria
   */
  async obterEstatisticas(
    dataInicio?: Date,
    dataFim?: Date,
  ): Promise<{
    totalLogs: number;
    loginsPorDia: any[];
    acoesPorTipo: any[];
    usuariosAtivos: number;
  }> {
    try {
      // 🔍 Filtros de data
      const filtroData: any = {};
      if (dataInicio || dataFim) {
        filtroData.criadoEm = {};
        if (dataInicio) filtroData.criadoEm.gte = dataInicio;
        if (dataFim) filtroData.criadoEm.lte = dataFim;
      }

      // 📊 Executar consultas em paralelo
      const [totalLogs, loginsPorDia, acoesPorTipo, usuariosAtivos] =
        await Promise.all([
          // Total de logs
          this.database.logAuditoria.count({
            where: filtroData,
          }),

          // Logins por dia (últimos 7 dias)
          this.database.logAuditoria.groupBy({
            by: ['criadoEm'],
            where: {
              acao: TipoAcao.LOGIN,
              criadoEm: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
            _count: true,
          }),

          // Ações por tipo
          this.database.logAuditoria.groupBy({
            by: ['acao'],
            where: filtroData,
            _count: true,
            orderBy: {
              _count: {
                acao: 'desc',
              },
            },
          }),

          // Usuários únicos ativos
          this.database.logAuditoria
            .findMany({
              where: {
                acao: TipoAcao.LOGIN,
                criadoEm: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Últimos 30 dias
                },
              },
              select: { usuarioId: true },
              distinct: ['usuarioId'],
            })
            .then((logs) => logs.length),
        ]);

      return {
        totalLogs,
        loginsPorDia,
        acoesPorTipo,
        usuariosAtivos,
      };
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de auditoria:', error);
      throw error;
    }
  }

  /**
   * 🧹 Limpar logs antigos (manter apenas últimos 90 dias)
   */
  async limparLogsAntigos(): Promise<number> {
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);

      const resultado = await this.database.logAuditoria.deleteMany({
        where: {
          criadoEm: {
            lt: dataLimite,
          },
        },
      });

      this.logger.log(`Logs antigos removidos: ${resultado.count} registros`);

      return resultado.count;
    } catch (error) {
      this.logger.error('Erro ao limpar logs antigos:', error);
      throw error;
    }
  }

  /**
   * 🚨 Registrar tentativa suspeita
   */
  async registrarTentativaSuspeita(
    descricao: string,
    ipAddress?: string,
    userAgent?: string,
    usuarioId?: string,
  ): Promise<void> {
    await this.criarLog({
      usuarioId,
      acao: TipoAcao.TENTATIVA_SUSPEITA,
      descricao,
      ipAddress,
      userAgent,
    });

    this.logger.warn(
      `Tentativa suspeita detectada: ${descricao} - IP: ${ipAddress}`,
    );
  }
}

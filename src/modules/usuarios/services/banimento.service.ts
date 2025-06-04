import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Status, TipoBanimento } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import {
  AplicarBanimentoDto,
  RemoverBanimentoDto,
  FiltrarBanimentosDto,
} from '../dto/banimento.dto';
import { AuditoriaService } from './auditoria.service';

/**
 * 🚫 Service para gestão de banimentos
 * Controla aplicação, remoção e monitoramento de banimentos
 */
@Injectable()
export class BanimentoService {
  private readonly logger = new Logger(BanimentoService.name);

  constructor(
    private database: DatabaseService,
    private auditoriaService: AuditoriaService,
  ) {}

  /**
   * 🚫 Aplicar banimento a um usuário
   */
  async aplicarBanimento(
    usuarioId: string,
    aplicarBanimentoDto: AplicarBanimentoDto,
    adminId: string,
  ): Promise<any> {
    try {
      // 🔍 Verificar se usuário existe e não está já banido
      const usuario = await this.database.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          status: true,
          tipoBanimento: true,
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      if (usuario.status === Status.BANIDO) {
        throw new BadRequestException('Usuário já está banido');
      }

      // 📅 Calcular data de fim do banimento
      const dataInicio = new Date();
      let dataFim: Date | null = null;

      if (aplicarBanimentoDto.tipoBanimento !== TipoBanimento.PERMANENTE) {
        if (aplicarBanimentoDto.dataFimBanimento) {
          dataFim = new Date(aplicarBanimentoDto.dataFimBanimento);

          if (dataFim <= dataInicio) {
            throw new BadRequestException(
              'Data de fim deve ser posterior à data atual',
            );
          }
        } else {
          // 📅 Calcular automaticamente baseado no tipo
          dataFim = this.calcularDataFimBanimento(
            aplicarBanimentoDto.tipoBanimento,
          );
        }
      }

      // 💾 Aplicar banimento
      const usuarioBanido = await this.database.usuario.update({
        where: { id: usuarioId },
        data: {
          status: Status.BANIDO,
          tipoBanimento: aplicarBanimentoDto.tipoBanimento,
          dataInicioBanimento: dataInicio,
          dataFimBanimento: dataFim,
          motivoBanimento: aplicarBanimentoDto.motivoBanimento,
          banidoPor: adminId,
          refreshToken: null, // 🔐 Invalidar token de acesso
        },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          status: true,
          tipoBanimento: true,
          dataInicioBanimento: true,
          dataFimBanimento: true,
          motivoBanimento: true,
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId,
        acao: 'BANIMENTO_APLICADO',
        descricao: `Banimento aplicado: ${usuario.email} (${aplicarBanimentoDto.tipoBanimento}) - Motivo: ${aplicarBanimentoDto.motivoBanimento}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.warn(
        `Banimento aplicado: ${usuario.email} (${usuario.matricula}) - Tipo: ${aplicarBanimentoDto.tipoBanimento} - Admin: ${adminId}`,
      );

      return usuarioBanido;
    } catch (error) {
      this.logger.error(
        `Erro ao aplicar banimento ao usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔓 Remover banimento de um usuário
   */
  async removerBanimento(
    usuarioId: string,
    removerBanimentoDto: RemoverBanimentoDto,
    adminId: string,
  ): Promise<any> {
    try {
      // 🔍 Verificar se usuário existe e está banido
      const usuario = await this.database.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          status: true,
          tipoBanimento: true,
          motivoBanimento: true,
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      if (usuario.status !== Status.BANIDO) {
        throw new BadRequestException('Usuário não está banido');
      }

      // 💾 Remover banimento
      const usuarioLiberado = await this.database.usuario.update({
        where: { id: usuarioId },
        data: {
          status: Status.ATIVO,
          tipoBanimento: null,
          dataInicioBanimento: null,
          dataFimBanimento: null,
          motivoBanimento: null,
          banidoPor: null,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          status: true,
          atualizadoEm: true,
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId,
        acao: 'BANIMENTO_REMOVIDO',
        descricao: `Banimento removido: ${usuario.email} - Motivo da remoção: ${removerBanimentoDto.motivoRemocao}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Banimento removido: ${usuario.email} (${usuario.matricula}) - Admin: ${adminId}`,
      );

      return usuarioLiberado;
    } catch (error) {
      this.logger.error(
        `Erro ao remover banimento do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 📋 Listar usuários banidos
   */
  async listarBanimentos(filtros: FiltrarBanimentosDto = {}): Promise<{
    banimentos: any[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    try {
      const {
        tipoBanimento,
        banidoPor,
        status = 'todos',
        pagina = 1,
        limite = 10,
      } = filtros;

      // 🔍 Construir filtros WHERE
      const where: any = {
        status: Status.BANIDO,
      };

      if (tipoBanimento) {
        where.tipoBanimento = tipoBanimento;
      }

      if (banidoPor) {
        where.banidoPor = banidoPor;
      }

      // 📅 Filtrar por status do banimento
      if (status === 'ativo') {
        where.OR = [
          { dataFimBanimento: null }, // Permanente
          { dataFimBanimento: { gt: new Date() } }, // Temporário ativo
        ];
      } else if (status === 'expirado') {
        where.dataFimBanimento = {
          not: null,
          lte: new Date(),
        };
      }

      // 📊 Calcular paginação
      const skip = (pagina - 1) * limite;

      // 📋 Buscar banimentos
      const [banimentos, total] = await Promise.all([
        this.database.usuario.findMany({
          where,
          select: {
            id: true,
            nome: true,
            email: true,
            matricula: true,
            tipoBanimento: true,
            dataInicioBanimento: true,
            dataFimBanimento: true,
            motivoBanimento: true,
            banidoPor: true,
          },
          orderBy: { dataInicioBanimento: 'desc' },
          skip,
          take: limite,
        }),
        this.database.usuario.count({ where }),
      ]);

      // 🔍 Adicionar informações do admin que aplicou o banimento
      const banimentosComAdmin = await Promise.all(
        banimentos.map(async (banimento) => {
          let adminInfo = null;

          if (banimento.banidoPor) {
            adminInfo = await this.database.usuario.findUnique({
              where: { id: banimento.banidoPor },
              select: {
                id: true,
                nome: true,
                email: true,
              },
            });
          }

          return {
            ...banimento,
            adminBanimento: adminInfo,
            statusBanimento: this.verificarStatusBanimento(
              banimento.dataFimBanimento,
            ),
          };
        }),
      );

      const totalPaginas = Math.ceil(total / limite);

      return {
        banimentos: banimentosComAdmin,
        total,
        pagina,
        limite,
        totalPaginas,
      };
    } catch (error) {
      this.logger.error('Erro ao listar banimentos:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar detalhes de um banimento
   */
  async buscarBanimento(usuarioId: string): Promise<any> {
    try {
      const usuario = await this.database.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          status: true,
          tipoBanimento: true,
          dataInicioBanimento: true,
          dataFimBanimento: true,
          motivoBanimento: true,
          banidoPor: true,
        },
      });

      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      if (usuario.status !== Status.BANIDO) {
        throw new NotFoundException('Usuário não está banido');
      }

      // 🔍 Buscar informações do admin
      let adminInfo = null;
      if (usuario.banidoPor) {
        adminInfo = await this.database.usuario.findUnique({
          where: { id: usuario.banidoPor },
          select: {
            id: true,
            nome: true,
            email: true,
          },
        });
      }

      return {
        ...usuario,
        adminBanimento: adminInfo,
        statusBanimento: this.verificarStatusBanimento(
          usuario.dataFimBanimento,
        ),
        diasRestantes: this.calcularDiasRestantes(usuario.dataFimBanimento),
      };
    } catch (error) {
      this.logger.error(
        `Erro ao buscar banimento do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔄 Verificar e processar banimentos expirados
   */
  async processarBanimentosExpirados(): Promise<number> {
    try {
      // 🔍 Buscar banimentos expirados
      const banimentosExpirados = await this.database.usuario.findMany({
        where: {
          status: Status.BANIDO,
          dataFimBanimento: {
            not: null,
            lte: new Date(),
          },
        },
        select: {
          id: true,
          email: true,
          matricula: true,
        },
      });

      if (banimentosExpirados.length === 0) {
        return 0;
      }

      // 🔓 Remover banimentos expirados
      const idsExpirados = banimentosExpirados.map((u) => u.id);

      await this.database.usuario.updateMany({
        where: {
          id: { in: idsExpirados },
        },
        data: {
          status: Status.ATIVO,
          tipoBanimento: null,
          dataInicioBanimento: null,
          dataFimBanimento: null,
          motivoBanimento: null,
          banidoPor: null,
        },
      });

      // 📝 Logs de auditoria para cada banimento expirado
      for (const usuario of banimentosExpirados) {
        await this.auditoriaService.criarLog({
          usuarioId: usuario.id,
          acao: 'BANIMENTO_EXPIRADO',
          descricao: `Banimento expirado automaticamente: ${usuario.email}`,
          ipAddress: null,
          userAgent: null,
        });
      }

      this.logger.log(
        `Banimentos expirados processados: ${banimentosExpirados.length}`,
      );

      return banimentosExpirados.length;
    } catch (error) {
      this.logger.error('Erro ao processar banimentos expirados:', error);
      throw error;
    }
  }

  /**
   * 📊 Estatísticas de banimentos
   */
  async obterEstatisticas(): Promise<{
    totalBanidos: number;
    banimentosPorTipo: any[];
    banimentosAtivos: number;
    banimentosExpirados: number;
    banimentosPorMes: any[];
  }> {
    try {
      const [
        totalBanidos,
        banimentosPorTipo,
        banimentosAtivos,
        banimentosExpirados,
        banimentosPorMes,
      ] = await Promise.all([
        // Total de usuários banidos
        this.database.usuario.count({
          where: { status: Status.BANIDO },
        }),

        // Banimentos por tipo
        this.database.usuario.groupBy({
          by: ['tipoBanimento'],
          where: { status: Status.BANIDO },
          _count: true,
        }),

        // Banimentos ativos
        this.database.usuario.count({
          where: {
            status: Status.BANIDO,
            OR: [
              { dataFimBanimento: null },
              { dataFimBanimento: { gt: new Date() } },
            ],
          },
        }),

        // Banimentos expirados (mas ainda marcados como banidos)
        this.database.usuario.count({
          where: {
            status: Status.BANIDO,
            dataFimBanimento: {
              not: null,
              lte: new Date(),
            },
          },
        }),

        // Banimentos por mês (últimos 6 meses)
        this.database.usuario.groupBy({
          by: ['dataInicioBanimento'],
          where: {
            status: Status.BANIDO,
            dataInicioBanimento: {
              gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
            },
          },
          _count: true,
        }),
      ]);

      return {
        totalBanidos,
        banimentosPorTipo,
        banimentosAtivos,
        banimentosExpirados,
        banimentosPorMes,
      };
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de banimentos:', error);
      throw error;
    }
  }

  /**
   * 📅 Calcular data de fim do banimento baseado no tipo
   * @private
   */
  private calcularDataFimBanimento(tipoBanimento: TipoBanimento): Date {
    const agora = new Date();

    switch (tipoBanimento) {
      case TipoBanimento.TEMPORARIO_15_DIAS:
        agora.setDate(agora.getDate() + 15);
        break;
      case TipoBanimento.TEMPORARIO_30_DIAS:
        agora.setDate(agora.getDate() + 30);
        break;
      case TipoBanimento.TEMPORARIO_90_DIAS:
        agora.setDate(agora.getDate() + 90);
        break;
      case TipoBanimento.TEMPORARIO_120_DIAS:
        agora.setDate(agora.getDate() + 120);
        break;
      default:
        throw new BadRequestException(
          'Tipo de banimento inválido para cálculo automático',
        );
    }

    return agora;
  }

  /**
   * ✅ Verificar status atual do banimento
   * @private
   */
  private verificarStatusBanimento(
    dataFim: Date | null,
  ): 'ativo' | 'expirado' | 'permanente' {
    if (!dataFim) return 'permanente';

    return new Date() > dataFim ? 'expirado' : 'ativo';
  }

  /**
   * 📅 Calcular dias restantes do banimento
   * @private
   */
  private calcularDiasRestantes(dataFim: Date | null): number | null {
    if (!dataFim) return null;

    const agora = new Date();
    const diferenca = dataFim.getTime() - agora.getTime();

    return diferenca > 0 ? Math.ceil(diferenca / (1000 * 60 * 60 * 24)) : 0;
  }
}

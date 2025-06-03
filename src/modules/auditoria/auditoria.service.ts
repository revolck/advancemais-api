import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CriarLogAuditoriaDto } from './dto/log-auditoria.dto';

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private database: DatabaseService) {}

  async criarLog(dados: CriarLogAuditoriaDto): Promise<void> {
    try {
      await this.database.logAuditoria.create({
        data: {
          usuarioId: dados.usuarioId,
          acao: dados.acao,
          descricao: dados.descricao,
          ipAddress: dados.ipAddress,
          userAgent: dados.userAgent,
        },
      });

      this.logger.debug(
        `Log criado: ${dados.acao} - ${dados.descricao} - Usuario: ${dados.usuarioId || 'N/A'}`,
      );
    } catch (error) {
      this.logger.error('Erro ao criar log de auditoria:', error);
      // Não propagar erro para não afetar operação principal
    }
  }

  async buscarLogsPorUsuario(
    usuarioId: string,
    limite: number = 50,
    offset: number = 0,
  ) {
    return this.database.logAuditoria.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: limite,
      skip: offset,
      select: {
        id: true,
        acao: true,
        descricao: true,
        ipAddress: true,
        criadoEm: true,
      },
    });
  }

  async buscarLogsRecentes(limite: number = 100) {
    return this.database.logAuditoria.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
      include: {
        usuario: {
          select: {
            email: true,
            matricula: true,
          },
        },
      },
    });
  }

  async contarLogsPorAcao(dataInicio?: Date, dataFim?: Date) {
    const where: any = {};

    if (dataInicio || dataFim) {
      where.criadoEm = {};
      if (dataInicio) where.criadoEm.gte = dataInicio;
      if (dataFim) where.criadoEm.lte = dataFim;
    }

    return this.database.logAuditoria.groupBy({
      by: ['acao'],
      where,
      _count: {
        acao: true,
      },
    });
  }
}

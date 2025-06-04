import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';

/**
 * ⭐ Service para "Por que escolher a Advance"
 */
@Injectable()
export class PorqueEscolherAdvanceService {
  private readonly logger = new Logger(PorqueEscolherAdvanceService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todas as seções com boxes ordenados
   */
  async listarTodos() {
    try {
      return await this.database.porqueEscolherAdvance.findMany({
        include: {
          boxes: {
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar "Por que escolher Advance":', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar seção por ID com boxes
   */
  async buscarPorId(id: number) {
    try {
      const secao = await this.database.porqueEscolherAdvance.findUnique({
        where: { id },
        include: {
          boxes: {
            orderBy: { ordem: 'asc' },
          },
        },
      });

      if (!secao) {
        throw new NotFoundException(
          `Seção "Por que escolher Advance" com ID ${id} não encontrada`,
        );
      }

      return secao;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar "Por que escolher Advance" ${id}:`,
        error,
      );
      throw error;
    }
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';

/**
 * 🏢 Service para gestão das informações da empresa
 */
@Injectable()
export class EmpresaService {
  private readonly logger = new Logger(EmpresaService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todas as informações da empresa
   */
  async listarTodos() {
    try {
      return await this.database.empresa.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar informações da empresa:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar informação da empresa por ID
   */
  async buscarPorId(id: number) {
    try {
      const empresa = await this.database.empresa.findUnique({
        where: { id },
      });

      if (!empresa) {
        throw new NotFoundException(
          `Informação da empresa com ID ${id} não encontrada`,
        );
      }

      return empresa;
    } catch (error) {
      this.logger.error(`Erro ao buscar informação da empresa ${id}:`, error);
      throw error;
    }
  }
}

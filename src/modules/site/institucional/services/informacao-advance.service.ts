import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarInformacaoAdvanceDto } from '../dto/criar-informacao-advance.dto';
import { AtualizarInformacaoAdvanceDto } from '../dto/atualizar-informacao-advance.dto';

/**
 * 📊 Service para gestão das informações da Advance
 */
@Injectable()
export class InformacaoAdvanceService {
  private readonly logger = new Logger(InformacaoAdvanceService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todas as informações
   */
  async listarTodos() {
    try {
      return await this.database.informacaoAdvance.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar informações da Advance:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar informação por ID
   */
  async buscarPorId(id: number) {
    try {
      const informacao = await this.database.informacaoAdvance.findUnique({
        where: { id },
      });

      if (!informacao) {
        throw new NotFoundException(
          `Informação da Advance com ID ${id} não encontrada`,
        );
      }

      return informacao;
    } catch (error) {
      this.logger.error(`Erro ao buscar informação da Advance ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar nova informação
   */
  async criar(criarInformacaoAdvanceDto: CriarInformacaoAdvanceDto) {
    try {
      const informacao = await this.database.informacaoAdvance.create({
        data: criarInformacaoAdvanceDto,
      });

      this.logger.log(`Informação da Advance criada: ${informacao.id}`);
      return informacao;
    } catch (error) {
      this.logger.error('Erro ao criar informação da Advance:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar informação
   */
  async atualizar(
    id: number,
    atualizarInformacaoAdvanceDto: AtualizarInformacaoAdvanceDto,
  ) {
    try {
      await this.buscarPorId(id);

      const informacao = await this.database.informacaoAdvance.update({
        where: { id },
        data: atualizarInformacaoAdvanceDto,
      });

      this.logger.log(`Informação da Advance atualizada: ${informacao.id}`);
      return informacao;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar informação da Advance ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🗑️ Remover informação
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.informacaoAdvance.delete({
        where: { id },
      });

      this.logger.log(`Informação da Advance removida: ${id}`);
      return { message: 'Informação da Advance removida com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover informação da Advance ${id}:`, error);
      throw error;
    }
  }
}

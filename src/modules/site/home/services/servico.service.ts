import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { TipoServico } from '@prisma/client';
import { DatabaseService } from '../../../../database/database.service';
import { CriarServicoDto } from '../dto/criar-servico.dto';
import { AtualizarServicoDto } from '../dto/atualizar-servico.dto';

/**
 * 🛠️ Service para gestão de serviços
 */
@Injectable()
export class ServicoService {
  private readonly logger = new Logger(ServicoService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todos os serviços ativos
   */
  async listarTodos(tipo?: TipoServico) {
    try {
      const where: any = { ativo: true };

      if (tipo) {
        where.tipo = tipo;
      }

      return await this.database.servico.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar serviços:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar serviço por ID
   */
  async buscarPorId(id: number) {
    try {
      const servico = await this.database.servico.findUnique({
        where: { id },
      });

      if (!servico) {
        throw new NotFoundException(`Serviço com ID ${id} não encontrado`);
      }

      return servico;
    } catch (error) {
      this.logger.error(`Erro ao buscar serviço ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar novo serviço
   */
  async criar(criarServicoDto: CriarServicoDto) {
    try {
      const servico = await this.database.servico.create({
        data: criarServicoDto,
      });

      this.logger.log(`Serviço criado: ${servico.id} - ${servico.titulo}`);
      return servico;
    } catch (error) {
      this.logger.error('Erro ao criar serviço:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar serviço
   */
  async atualizar(id: number, atualizarServicoDto: AtualizarServicoDto) {
    try {
      await this.buscarPorId(id);

      const servico = await this.database.servico.update({
        where: { id },
        data: atualizarServicoDto,
      });

      this.logger.log(`Serviço atualizado: ${servico.id} - ${servico.titulo}`);
      return servico;
    } catch (error) {
      this.logger.error(`Erro ao atualizar serviço ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Remover serviço (soft delete)
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.servico.update({
        where: { id },
        data: { ativo: false },
      });

      this.logger.log(`Serviço removido: ${id}`);
      return { message: 'Serviço removido com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover serviço ${id}:`, error);
      throw error;
    }
  }
}

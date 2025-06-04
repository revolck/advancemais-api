import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarMercadoTrabalhoDto } from '../dto/criar-mercado-trabalho.dto';
import { AtualizarMercadoTrabalhoDto } from '../dto/atualizar-mercado-trabalho.dto';

/**
 * 💼 Service para mercado de trabalho
 */
@Injectable()
export class MercadoTrabalhoService {
  private readonly logger = new Logger(MercadoTrabalhoService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todos os mercados com destaques ordenados
   */
  async listarTodos() {
    try {
      return await this.database.mercadoTrabalho.findMany({
        include: {
          destaques: {
            orderBy: { ordem: 'asc' },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar mercados de trabalho:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar mercado por ID com destaques
   */
  async buscarPorId(id: number) {
    try {
      const mercado = await this.database.mercadoTrabalho.findUnique({
        where: { id },
        include: {
          destaques: {
            orderBy: { ordem: 'asc' },
          },
        },
      });

      if (!mercado) {
        throw new NotFoundException(
          `Mercado de trabalho com ID ${id} não encontrado`,
        );
      }

      return mercado;
    } catch (error) {
      this.logger.error(`Erro ao buscar mercado de trabalho ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar novo mercado com destaques
   */
  async criar(criarMercadoTrabalhoDto: CriarMercadoTrabalhoDto) {
    try {
      const mercado = await this.database.mercadoTrabalho.create({
        data: {
          titulo: criarMercadoTrabalhoDto.titulo,
          subtitulo: criarMercadoTrabalhoDto.subtitulo,
          destaques: {
            create:
              criarMercadoTrabalhoDto.destaques?.map((destaque, index) => ({
                numeroDestaque: destaque.numeroDestaque,
                descricaoDestaque: destaque.descricaoDestaque,
                ordem: destaque.ordem || index + 1,
              })) || [],
          },
        },
        include: {
          destaques: {
            orderBy: { ordem: 'asc' },
          },
        },
      });

      this.logger.log(
        `Mercado de trabalho criado: ${mercado.id} - ${mercado.titulo}`,
      );
      return mercado;
    } catch (error) {
      this.logger.error('Erro ao criar mercado de trabalho:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar mercado
   */
  async atualizar(
    id: number,
    atualizarMercadoTrabalhoDto: AtualizarMercadoTrabalhoDto,
  ) {
    try {
      await this.buscarPorId(id);

      // Se há destaques para atualizar, remover os antigos e criar novos
      const updateData: any = {
        titulo: atualizarMercadoTrabalhoDto.titulo,
        subtitulo: atualizarMercadoTrabalhoDto.subtitulo,
      };

      if (atualizarMercadoTrabalhoDto.destaques) {
        updateData.destaques = {
          deleteMany: {},
          create: atualizarMercadoTrabalhoDto.destaques.map(
            (destaque, index) => ({
              numeroDestaque: destaque.numeroDestaque,
              descricaoDestaque: destaque.descricaoDestaque,
              ordem: destaque.ordem || index + 1,
            }),
          ),
        };
      }

      const mercado = await this.database.mercadoTrabalho.update({
        where: { id },
        data: updateData,
        include: {
          destaques: {
            orderBy: { ordem: 'asc' },
          },
        },
      });

      this.logger.log(
        `Mercado de trabalho atualizado: ${mercado.id} - ${mercado.titulo}`,
      );
      return mercado;
    } catch (error) {
      this.logger.error(`Erro ao atualizar mercado de trabalho ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Remover mercado
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.mercadoTrabalho.delete({
        where: { id },
      });

      this.logger.log(`Mercado de trabalho removido: ${id}`);
      return { message: 'Mercado de trabalho removido com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover mercado de trabalho ${id}:`, error);
      throw error;
    }
  }
}

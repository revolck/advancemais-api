import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarBannerDto } from '../dto/criar-banner.dto';
import { AtualizarBannerDto } from '../dto/atualizar-banner.dto';

/**
 * 🖼️ Service para gestão de banners
 */
@Injectable()
export class BannerService {
  private readonly logger = new Logger(BannerService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todos os banners ativos ordenados por posição
   */
  async listarTodos() {
    try {
      return await this.database.banner.findMany({
        where: { ativo: true },
        orderBy: { position: 'asc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar banners:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar banner por ID
   */
  async buscarPorId(id: number) {
    try {
      const banner = await this.database.banner.findUnique({
        where: { id },
      });

      if (!banner) {
        throw new NotFoundException(`Banner com ID ${id} não encontrado`);
      }

      return banner;
    } catch (error) {
      this.logger.error(`Erro ao buscar banner ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar novo banner
   */
  async criar(criarBannerDto: CriarBannerDto) {
    try {
      const banner = await this.database.banner.create({
        data: criarBannerDto,
      });

      this.logger.log(
        `Banner criado: ${banner.id} - Posição ${banner.position}`,
      );
      return banner;
    } catch (error) {
      this.logger.error('Erro ao criar banner:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar banner
   */
  async atualizar(id: number, atualizarBannerDto: AtualizarBannerDto) {
    try {
      await this.buscarPorId(id);

      const banner = await this.database.banner.update({
        where: { id },
        data: atualizarBannerDto,
      });

      this.logger.log(`Banner atualizado: ${banner.id}`);
      return banner;
    } catch (error) {
      this.logger.error(`Erro ao atualizar banner ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Remover banner (soft delete)
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.banner.update({
        where: { id },
        data: { ativo: false },
      });

      this.logger.log(`Banner removido: ${id}`);
      return { message: 'Banner removido com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover banner ${id}:`, error);
      throw error;
    }
  }
}

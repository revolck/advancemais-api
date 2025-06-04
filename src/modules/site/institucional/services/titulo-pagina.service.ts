import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarTituloPaginaDto } from '../dto/criar-titulo-pagina.dto';
import { AtualizarTituloPaginaDto } from '../dto/atualizar-titulo-pagina.dto';

/**
 * 📄 Service para gestão de títulos de páginas
 */
@Injectable()
export class TituloPaginaService {
  private readonly logger = new Logger(TituloPaginaService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todos os títulos
   */
  async listarTodos() {
    try {
      return await this.database.tituloPagina.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar títulos de página:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar título por ID
   */
  async buscarPorId(id: number) {
    try {
      const titulo = await this.database.tituloPagina.findUnique({
        where: { id },
      });

      if (!titulo) {
        throw new NotFoundException(
          `Título de página com ID ${id} não encontrado`,
        );
      }

      return titulo;
    } catch (error) {
      this.logger.error(`Erro ao buscar título de página ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar novo título
   */
  async criar(criarTituloPaginaDto: CriarTituloPaginaDto) {
    try {
      const titulo = await this.database.tituloPagina.create({
        data: criarTituloPaginaDto,
      });

      this.logger.log(
        `Título de página criado: ${titulo.id} - ${titulo.titulo}`,
      );
      return titulo;
    } catch (error) {
      this.logger.error('Erro ao criar título de página:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar título
   */
  async atualizar(
    id: number,
    atualizarTituloPaginaDto: AtualizarTituloPaginaDto,
  ) {
    try {
      await this.buscarPorId(id);

      const titulo = await this.database.tituloPagina.update({
        where: { id },
        data: atualizarTituloPaginaDto,
      });

      this.logger.log(
        `Título de página atualizado: ${titulo.id} - ${titulo.titulo}`,
      );
      return titulo;
    } catch (error) {
      this.logger.error(`Erro ao atualizar título de página ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Remover título
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.tituloPagina.delete({
        where: { id },
      });

      this.logger.log(`Título de página removido: ${id}`);
      return { message: 'Título de página removido com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover título de página ${id}:`, error);
      throw error;
    }
  }
}

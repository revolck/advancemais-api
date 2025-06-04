import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarTituloPaginaCursosDto } from '../dto/criar-titulo-pagina-cursos.dto';
import { AtualizarTituloPaginaCursosDto } from '../dto/atualizar-titulo-pagina-cursos.dto';

/**
 * 📚 Service para títulos da página de cursos
 */
@Injectable()
export class TituloPaginaCursosService {
  private readonly logger = new Logger(TituloPaginaCursosService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todos os títulos
   */
  async listarTodos() {
    try {
      return await this.database.tituloPaginaCursos.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar títulos da página de cursos:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar título por ID
   */
  async buscarPorId(id: number) {
    try {
      const titulo = await this.database.tituloPaginaCursos.findUnique({
        where: { id },
      });

      if (!titulo) {
        throw new NotFoundException(
          `Título da página de cursos com ID ${id} não encontrado`,
        );
      }

      return titulo;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar título da página de cursos ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ➕ Criar novo título
   */
  async criar(criarTituloPaginaCursosDto: CriarTituloPaginaCursosDto) {
    try {
      const titulo = await this.database.tituloPaginaCursos.create({
        data: criarTituloPaginaCursosDto,
      });

      this.logger.log(
        `Título da página de cursos criado: ${titulo.id} - ${titulo.titulo}`,
      );
      return titulo;
    } catch (error) {
      this.logger.error('Erro ao criar título da página de cursos:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar título
   */
  async atualizar(
    id: number,
    atualizarTituloPaginaCursosDto: AtualizarTituloPaginaCursosDto,
  ) {
    try {
      await this.buscarPorId(id);

      const titulo = await this.database.tituloPaginaCursos.update({
        where: { id },
        data: atualizarTituloPaginaCursosDto,
      });

      this.logger.log(
        `Título da página de cursos atualizado: ${titulo.id} - ${titulo.titulo}`,
      );
      return titulo;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar título da página de cursos ${id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🗑️ Remover título
   */
  async remover(id: number) {
    try {
      await this.buscarPorId(id);

      await this.database.tituloPaginaCursos.delete({
        where: { id },
      });

      this.logger.log(`Título da página de cursos removido: ${id}`);
      return { message: 'Título da página de cursos removido com sucesso' };
    } catch (error) {
      this.logger.error(
        `Erro ao remover título da página de cursos ${id}:`,
        error,
      );
      throw error;
    }
  }
}

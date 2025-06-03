import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../database/database.service';
import { CriarSobreDto } from '../dto/criar-sobre.dto';
import { AtualizarSobreDto } from '../dto/atualizar-sobre.dto';

@Injectable()
export class SobreService {
  private readonly logger = new Logger(SobreService.name);

  constructor(private database: DatabaseService) {}

  /**
   * 📋 Listar todas as seções sobre
   */
  async listarTodos() {
    try {
      return await this.database.sobre.findMany({
        orderBy: { criadoEm: 'desc' },
      });
    } catch (error) {
      this.logger.error('Erro ao listar seções sobre:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar seção sobre por ID
   */
  async buscarPorId(id: number) {
    try {
      const sobre = await this.database.sobre.findUnique({
        where: { id },
      });

      if (!sobre) {
        throw new NotFoundException(`Seção sobre com ID ${id} não encontrada`);
      }

      return sobre;
    } catch (error) {
      this.logger.error(`Erro ao buscar seção sobre ${id}:`, error);
      throw error;
    }
  }

  /**
   * ➕ Criar nova seção sobre
   */
  async criar(criarSobreDto: CriarSobreDto) {
    try {
      const sobre = await this.database.sobre.create({
        data: criarSobreDto,
      });

      this.logger.log(`Seção sobre criada: ${sobre.id} - ${sobre.titulo}`);
      return sobre;
    } catch (error) {
      this.logger.error('Erro ao criar seção sobre:', error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar seção sobre
   */
  async atualizar(id: number, atualizarSobreDto: AtualizarSobreDto) {
    try {
      // Verificar se existe
      await this.buscarPorId(id);

      const sobre = await this.database.sobre.update({
        where: { id },
        data: atualizarSobreDto,
      });

      this.logger.log(`Seção sobre atualizada: ${sobre.id} - ${sobre.titulo}`);
      return sobre;
    } catch (error) {
      this.logger.error(`Erro ao atualizar seção sobre ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Remover seção sobre
   */
  async remover(id: number) {
    try {
      // Verificar se existe
      await this.buscarPorId(id);

      await this.database.sobre.delete({
        where: { id },
      });

      this.logger.log(`Seção sobre removida: ${id}`);
      return { message: 'Seção sobre removida com sucesso' };
    } catch (error) {
      this.logger.error(`Erro ao remover seção sobre ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🌱 Criar dados iniciais (seed)
   */
  async criarDadosIniciais() {
    try {
      const existente = await this.database.sobre.count();

      if (existente > 0) {
        this.logger.log('Dados iniciais da seção sobre já existem');
        return;
      }

      const dadosIniciais = {
        titulo: 'Acelere o crescimento do seu negócio',
        descricao:
          'Na Advance+, fornecemos soluções estratégicas em gestão de pessoas e recrutamento, focadas em elevar o desempenho e a competitividade da sua empresa. Nosso trabalho envolve identificar e desenvolver talentos, otimizar processos e fortalecer a cultura organizacional, reduzindo custos de rotatividade e aumentando a produtividade da equipe. Conte conosco para potencializar resultados e alcançar novos patamares de sucesso.',
        imagemUrl: 'https://advancerh.com.br/images/imagem_1_home.png',
      };

      const sobre = await this.database.sobre.create({
        data: dadosIniciais,
      });

      this.logger.log('Dados iniciais da seção sobre criados com sucesso');
      return sobre;
    } catch (error) {
      this.logger.error('Erro ao criar dados iniciais da seção sobre:', error);
      throw error;
    }
  }
}

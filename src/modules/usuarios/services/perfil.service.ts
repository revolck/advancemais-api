import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CriarPerfilDto, AtualizarPerfilDto } from '../dto/perfil.dto';
import { AuditoriaService } from './auditoria.service';
import { ValidacaoService } from './validacao.service';

/**
 * 📋 Service para gestão de perfis complementares
 * Gerencia dados adicionais dos usuários
 */
@Injectable()
export class PerfilService {
  private readonly logger = new Logger(PerfilService.name);

  constructor(
    private database: DatabaseService,
    private auditoriaService: AuditoriaService,
    private validacaoService: ValidacaoService,
  ) {}

  /**
   * ➕ Criar perfil complementar
   */
  async criar(usuarioId: string, criarPerfilDto: CriarPerfilDto): Promise<any> {
    try {
      // 🔍 Verificar se usuário existe
      const usuario = await this.database.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, email: true, tipoUsuario: true },
      });

      if (!usuario) {
        throw new NotFoundException('Usuário não encontrado');
      }

      // 📋 Verificar se já possui perfil
      const perfilExistente = await this.database.perfilUsuario.findUnique({
        where: { usuarioId },
      });

      if (perfilExistente) {
        throw new BadRequestException('Usuário já possui perfil criado');
      }

      // ✅ Validações específicas
      if (criarPerfilDto.cep) {
        this.validacaoService.validarCep(criarPerfilDto.cep);
      }

      // 💾 Criar perfil
      const perfil = await this.database.perfilUsuario.create({
        data: {
          usuarioId,
          ...criarPerfilDto,
        },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              matricula: true,
            },
          },
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId,
        acao: 'CRIACAO',
        descricao: `Perfil complementar criado para ${usuario.email}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(`Perfil criado para usuário: ${usuario.email}`);

      return perfil;
    } catch (error) {
      this.logger.error(
        `Erro ao criar perfil para usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🔍 Buscar perfil por usuário
   */
  async buscarPorUsuario(usuarioId: string): Promise<any> {
    try {
      const perfil = await this.database.perfilUsuario.findUnique({
        where: { usuarioId },
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              matricula: true,
              tipoUsuario: true,
            },
          },
        },
      });

      if (!perfil) {
        throw new NotFoundException(
          `Perfil não encontrado para o usuário ${usuarioId}`,
        );
      }

      return perfil;
    } catch (error) {
      this.logger.error(
        `Erro ao buscar perfil do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ✏️ Atualizar perfil
   */
  async atualizar(
    usuarioId: string,
    atualizarPerfilDto: AtualizarPerfilDto,
  ): Promise<any> {
    try {
      // 🔍 Verificar se perfil existe
      const perfilExistente = await this.database.perfilUsuario.findUnique({
        where: { usuarioId },
        include: {
          usuario: {
            select: { email: true },
          },
        },
      });

      if (!perfilExistente) {
        throw new NotFoundException('Perfil não encontrado');
      }

      // ✅ Validações específicas
      if (atualizarPerfilDto.cep) {
        this.validacaoService.validarCep(atualizarPerfilDto.cep);
      }

      // 💾 Atualizar perfil
      const perfil = await this.database.perfilUsuario.update({
        where: { usuarioId },
        data: atualizarPerfilDto,
        include: {
          usuario: {
            select: {
              id: true,
              nome: true,
              email: true,
              matricula: true,
            },
          },
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId,
        acao: 'ATUALIZACAO',
        descricao: `Perfil atualizado para ${perfilExistente.usuario.email}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Perfil atualizado para usuário: ${perfilExistente.usuario.email}`,
      );

      return perfil;
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar perfil do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🗑️ Excluir perfil
   */
  async excluir(usuarioId: string, adminId?: string): Promise<void> {
    try {
      const perfil = await this.buscarPorUsuario(usuarioId);

      await this.database.perfilUsuario.delete({
        where: { usuarioId },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId || usuarioId,
        acao: 'EXCLUSAO',
        descricao: `Perfil excluído para ${perfil.usuario.email}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(`Perfil excluído para usuário: ${perfil.usuario.email}`);
    } catch (error) {
      this.logger.error(
        `Erro ao excluir perfil do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🌐 Buscar endereço por CEP (integração futura com API)
   */
  async buscarEnderecoPorCep(cep: string): Promise<{
    cep: string;
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  }> {
    try {
      // ✅ Validar CEP
      this.validacaoService.validarCep(cep);

      // 🌐 Aqui seria feita a integração com API dos Correios ou ViaCEP
      // Por enquanto, retornar apenas o CEP validado

      this.logger.log(`Busca de endereço por CEP: ${cep}`);

      return {
        cep: cep.replace(/\D/g, ''),
        // logradouro: 'Integração futura',
        // bairro: 'Integração futura',
        // cidade: 'Integração futura',
        // estado: 'Integração futura',
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar endereço por CEP ${cep}:`, error);
      throw new BadRequestException('Erro ao buscar endereço por CEP');
    }
  }

  /**
   * 📊 Estatísticas de perfis
   */
  async obterEstatisticas(): Promise<{
    totalPerfis: number;
    perfisPorEstado: any[];
    perfisCompletos: number;
    perfisIncompletos: number;
  }> {
    try {
      const [totalPerfis, perfisPorEstado, perfisCompletos, perfisIncompletos] =
        await Promise.all([
          // Total de perfis
          this.database.perfilUsuario.count(),

          // Perfis por estado
          this.database.perfilUsuario.groupBy({
            by: ['estado'],
            _count: true,
            where: {
              estado: {
                not: null,
              },
            },
            orderBy: {
              _count: {
                estado: 'desc',
              },
            },
          }),

          // Perfis completos (com endereço)
          this.database.perfilUsuario.count({
            where: {
              AND: [
                { cep: { not: null } },
                { cidade: { not: null } },
                { estado: { not: null } },
              ],
            },
          }),

          // Perfis incompletos
          this.database.perfilUsuario.count({
            where: {
              OR: [{ cep: null }, { cidade: null }, { estado: null }],
            },
          }),
        ]);

      return {
        totalPerfis,
        perfisPorEstado,
        perfisCompletos,
        perfisIncompletos,
      };
    } catch (error) {
      this.logger.error('Erro ao obter estatísticas de perfis:', error);
      throw error;
    }
  }
}

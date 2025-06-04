import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Status, Role } from '@prisma/client';
import { DatabaseService } from '../../../database/database.service';
import { HashUtil } from '../../../utils/hash.util';
import { ValidationUtil } from '../../../utils/validation.util';
import { CriarUsuarioDto } from '../dto/criar-usuario.dto';
import {
  AtualizarUsuarioDto,
  AtualizarUsuarioAdminDto,
  FiltroUsuariosDto,
} from '../dto/atualizar-usuario.dto';
import { AuditoriaService } from './auditoria.service';
import { ValidacaoService } from './validacao.service';

// 🔧 Interface tipada para dados do usuário
interface UsuarioExistente {
  id: string;
  email: string;
  senha: string;
  matricula: string;
  nome: string | null;
  status: string;
}

/**
 * 👥 Service principal para gestão de usuários
 * Responsável por todas as operações CRUD e validações
 */
@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private database: DatabaseService,
    private auditoriaService: AuditoriaService,
    private validacaoService: ValidacaoService,
  ) {}

  /**
   * ➕ Criar novo usuário
   */
  async criar(
    criarUsuarioDto: CriarUsuarioDto,
    adminId?: string,
  ): Promise<any> {
    try {
      // 🔍 Validações de negócio
      await this.validacaoService.validarEmailUnico(criarUsuarioDto.email);

      if (criarUsuarioDto.cpf) {
        await this.validacaoService.validarCpfUnico(criarUsuarioDto.cpf);
      }

      if (criarUsuarioDto.cnpj) {
        await this.validacaoService.validarCnpjUnico(criarUsuarioDto.cnpj);
      }

      // 🔐 Hash da senha
      const senhaHash = await HashUtil.gerarHash(criarUsuarioDto.senha);

      // 🆔 Gerar matrícula única
      const matricula = await this.gerarMatriculaUnica();

      // 👤 Criar usuário
      const usuario = await this.database.usuario.create({
        data: {
          nome: criarUsuarioDto.nome,
          email: criarUsuarioDto.email,
          senha: senhaHash,
          matricula,
          tipoUsuario: criarUsuarioDto.tipoUsuario,
          role: criarUsuarioDto.role || Role.STUDENT,
          cpf: criarUsuarioDto.cpf,
          cnpj: criarUsuarioDto.cnpj,
          dataNasc: criarUsuarioDto.dataNasc
            ? new Date(criarUsuarioDto.dataNasc)
            : null,
          telefone: criarUsuarioDto.telefone,
          genero: criarUsuarioDto.genero,
          aceitarTermos: criarUsuarioDto.aceitarTermos,
          status: Status.ATIVO,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          tipoUsuario: true,
          role: true,
          status: true,
          cpf: true,
          cnpj: true,
          dataNasc: true,
          telefone: true,
          genero: true,
          criadoEm: true,
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId || usuario.id,
        acao: 'CRIACAO',
        descricao: `Usuário criado: ${usuario.email} (${usuario.matricula})`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Usuário criado: ${usuario.email} (${usuario.matricula})`,
      );

      return usuario;
    } catch (error) {
      this.logger.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * 📋 Listar usuários com filtros e paginação
   */
  async listar(filtros: FiltroUsuariosDto = {}): Promise<{
    usuarios: any[];
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
  }> {
    try {
      const {
        nome,
        email,
        matricula,
        role,
        status,
        pagina = 1,
        limite = 10,
      } = filtros;

      // 🔍 Construir filtros WHERE
      const where: any = {};

      if (nome) {
        where.nome = { contains: nome, mode: 'insensitive' };
      }

      if (email) {
        where.email = { contains: email, mode: 'insensitive' };
      }

      if (matricula) {
        where.matricula = { contains: matricula, mode: 'insensitive' };
      }

      if (role) {
        where.role = role;
      }

      if (status) {
        where.status = status;
      }

      // 📊 Calcular paginação
      const skip = (pagina - 1) * limite;

      // 📋 Buscar usuários
      const [usuarios, total] = await Promise.all([
        this.database.usuario.findMany({
          where,
          select: {
            id: true,
            nome: true,
            email: true,
            matricula: true,
            tipoUsuario: true,
            role: true,
            status: true,
            ultimoLogin: true,
            criadoEm: true,
            tipoBanimento: true,
            dataFimBanimento: true,
          },
          orderBy: { criadoEm: 'desc' },
          skip,
          take: limite,
        }),
        this.database.usuario.count({ where }),
      ]);

      const totalPaginas = Math.ceil(total / limite);

      return {
        usuarios,
        total,
        pagina,
        limite,
        totalPaginas,
      };
    } catch (error) {
      this.logger.error('Erro ao listar usuários:', error);
      throw error;
    }
  }

  /**
   * 🔍 Buscar usuário por ID
   */
  async buscarPorId(id: string): Promise<any> {
    try {
      const usuario = await this.database.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          tipoUsuario: true,
          role: true,
          status: true,
          cpf: true,
          cnpj: true,
          dataNasc: true,
          telefone: true,
          genero: true,
          aceitarTermos: true,
          ultimoLogin: true,
          criadoEm: true,
          atualizadoEm: true,
          tipoBanimento: true,
          dataInicioBanimento: true,
          dataFimBanimento: true,
          motivoBanimento: true,
          perfil: true,
        },
      });

      if (!usuario) {
        throw new NotFoundException(`Usuário com ID ${id} não encontrado`);
      }

      return usuario;
    } catch (error) {
      this.logger.error(`Erro ao buscar usuário ${id}:`, error);
      throw error;
    }
  }

  /**
   * ✏️ Atualizar usuário
   */
  async atualizar(
    id: string,
    atualizarUsuarioDto: AtualizarUsuarioDto,
    usuarioLogadoId: string,
  ): Promise<any> {
    try {
      // 🔍 Verificar se usuário existe
      const usuarioExistente = await this.buscarPorId(id);

      // 🛡️ Verificar permissões (usuário só pode editar próprio perfil)
      if (id !== usuarioLogadoId) {
        throw new UnauthorizedException(
          'Você só pode editar seu próprio perfil',
        );
      }

      const dadosAtualizacao: any = { ...atualizarUsuarioDto };

      // 🔐 Tratar alteração de senha
      if (atualizarUsuarioDto.novaSenha) {
        if (!atualizarUsuarioDto.senhaAtual) {
          throw new BadRequestException(
            'Senha atual é obrigatória para alteração',
          );
        }

        // ✅ Verificar senha atual
        const senhaValida = await HashUtil.verificarHash(
          (usuarioExistente as UsuarioExistente).senha, // 🔧 CORREÇÃO: cast explícito
          atualizarUsuarioDto.senhaAtual,
        );

        if (!senhaValida) {
          throw new BadRequestException('Senha atual incorreta');
        }

        dadosAtualizacao.senha = await HashUtil.gerarHash(
          atualizarUsuarioDto.novaSenha,
        );
        delete dadosAtualizacao.novaSenha;
        delete dadosAtualizacao.senhaAtual;
      }

      // 💾 Atualizar usuário
      const usuario = await this.database.usuario.update({
        where: { id },
        data: dadosAtualizacao,
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          tipoUsuario: true,
          role: true,
          status: true,
          dataNasc: true,
          telefone: true,
          genero: true,
          atualizadoEm: true,
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: id,
        acao: 'ATUALIZACAO',
        descricao: `Perfil atualizado: ${usuario.email}`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Usuário atualizado: ${usuario.email} (${usuario.matricula})`,
      );

      return usuario;
    } catch (error) {
      this.logger.error(`Erro ao atualizar usuário ${id}:`, error);
      throw error;
    }
  }

  /**
   * 👮 Atualizar usuário (admin)
   */
  async atualizarAdmin(
    id: string,
    atualizarUsuarioAdminDto: AtualizarUsuarioAdminDto,
    adminId: string,
  ): Promise<any> {
    try {
      // 🔍 Verificar se usuário existe
      await this.buscarPorId(id);

      // 🔍 Validar matrícula única se alterada
      if (atualizarUsuarioAdminDto.matricula) {
        const matriculaExiste = await this.database.usuario.findFirst({
          where: {
            matricula: atualizarUsuarioAdminDto.matricula,
            NOT: { id },
          },
        });

        if (matriculaExiste) {
          throw new ConflictException('Matrícula já está em uso');
        }
      }

      // 💾 Atualizar usuário
      const usuario = await this.database.usuario.update({
        where: { id },
        data: atualizarUsuarioAdminDto,
        select: {
          id: true,
          nome: true,
          email: true,
          matricula: true,
          tipoUsuario: true,
          role: true,
          status: true,
          atualizadoEm: true,
        },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId,
        acao: 'ATUALIZACAO',
        descricao: `Usuário atualizado por admin: ${usuario.email} (${usuario.matricula})`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Usuário atualizado por admin: ${usuario.email} (${usuario.matricula})`,
      );

      return usuario;
    } catch (error) {
      this.logger.error(`Erro ao atualizar usuário ${id} por admin:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Excluir usuário (soft delete)
   */
  async excluir(id: string, adminId: string): Promise<void> {
    try {
      const usuario = await this.buscarPorId(id);

      // 💾 Marcar como inativo (soft delete)
      await this.database.usuario.update({
        where: { id },
        data: { status: Status.INATIVO },
      });

      // 📝 Log de auditoria
      await this.auditoriaService.criarLog({
        usuarioId: adminId,
        acao: 'EXCLUSAO',
        descricao: `Usuário excluído: ${usuario.email} (${usuario.matricula})`,
        ipAddress: null,
        userAgent: null,
      });

      this.logger.log(
        `Usuário excluído: ${usuario.email} (${usuario.matricula})`,
      );
    } catch (error) {
      this.logger.error(`Erro ao excluir usuário ${id}:`, error);
      throw error;
    }
  }

  /**
   * 🆔 Gerar matrícula única
   * @private
   */
  private async gerarMatriculaUnica(): Promise<string> {
    let matricula: string;
    let existe = true;

    while (existe) {
      matricula = ValidationUtil.gerarMatricula();

      const usuario = await this.database.usuario.findUnique({
        where: { matricula },
      });

      existe = !!usuario;
    }

    return matricula!;
  }
}

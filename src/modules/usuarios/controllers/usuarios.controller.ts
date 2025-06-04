import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/auth.decorator';
import {
  AdminOnly,
  ManagerOnly,
} from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/types/request.interface';
import { UsuariosService } from '../services/usuarios.service';
import { CriarUsuarioDto } from '../dto/criar-usuario.dto';
import {
  AtualizarUsuarioDto,
  AtualizarUsuarioAdminDto,
  FiltroUsuariosDto,
} from '../dto/atualizar-usuario.dto';

/**
 * 👥 Controller para gestão de usuários
 *
 * Endpoints disponíveis:
 * - CRUD completo de usuários
 * - Filtros e busca avançada
 * - Operações administrativas
 */
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * ➕ Criar novo usuário
   * POST /api/v1/usuarios
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criar(
    @Body() criarUsuarioDto: CriarUsuarioDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usuariosService.criar(criarUsuarioDto, admin.id);
  }

  /**
   * 📋 Listar usuários com filtros
   * GET /api/v1/usuarios
   *
   * 🛡️ Acesso: Gestores e administradores
   *
   * Query params:
   * - nome: filtro por nome
   * - email: filtro por email
   * - matricula: filtro por matrícula
   * - role: filtro por role
   * - status: filtro por status
   * - pagina: número da página (padrão: 1)
   * - limite: itens por página (padrão: 10, máx: 100)
   */
  @ManagerOnly()
  @Get()
  async listar(@Query() filtros: FiltroUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  /**
   * 👤 Obter perfil do usuário logado
   * GET /api/v1/usuarios/me
   *
   * 🛡️ Acesso: Usuário autenticado
   */
  @Get('me')
  async meuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.usuariosService.buscarPorId(user.id);
  }

  /**
   * 🔍 Buscar usuário por ID
   * GET /api/v1/usuarios/:id
   *
   * 🛡️ Acesso: Gestores e administradores
   */
  @ManagerOnly()
  @Get(':id')
  async buscarPorId(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.buscarPorId(id);
  }

  /**
   * ✏️ Atualizar próprio perfil
   * PATCH /api/v1/usuarios/me
   *
   * 🛡️ Acesso: Usuário autenticado (apenas próprio perfil)
   */
  @Patch('me')
  async atualizarMeuPerfil(
    @Body() atualizarUsuarioDto: AtualizarUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuariosService.atualizar(
      user.id,
      atualizarUsuarioDto,
      user.id,
    );
  }

  /**
   * 👮 Atualizar usuário (admin)
   * PATCH /api/v1/usuarios/:id
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Patch(':id')
  async atualizarAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() atualizarUsuarioAdminDto: AtualizarUsuarioAdminDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usuariosService.atualizarAdmin(
      id,
      atualizarUsuarioAdminDto,
      admin.id,
    );
  }

  /**
   * 🗑️ Excluir usuário (soft delete)
   * DELETE /api/v1/usuarios/:id
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluir(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usuariosService.excluir(id, admin.id);
  }

  /**
   * 📊 Estatísticas gerais (futuro)
   * GET /api/v1/usuarios/stats
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Get('stats')
  async obterEstatisticas() {
    // TODO: Implementar service de estatísticas
    return {
      message: 'Endpoint de estatísticas em desenvolvimento',
      timestamp: new Date().toISOString(),
    };
  }
}

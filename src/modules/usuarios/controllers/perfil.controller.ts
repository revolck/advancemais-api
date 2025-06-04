import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/auth.decorator';
import {
  AdminOnly,
  ManagerOnly,
} from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/types/request.interface';
import { PerfilService } from '../services/perfil.service';
import { CriarPerfilDto, AtualizarPerfilDto } from '../dto/perfil.dto';

/**
 * 📋 Controller para gestão de perfis complementares
 *
 * Gerencia dados adicionais dos usuários como:
 * - Endereço completo
 * - Dados empresariais (PJ)
 * - Informações complementares
 */
@Controller('usuarios/perfil')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  /**
   * ➕ Criar perfil complementar
   * POST /api/v1/usuarios/perfil/me
   *
   * 🛡️ Acesso: Usuário autenticado (próprio perfil)
   */
  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  async criarMeuPerfil(
    @Body() criarPerfilDto: CriarPerfilDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.perfilService.criar(user.id, criarPerfilDto);
  }

  /**
   * ➕ Criar perfil para usuário específico (admin)
   * POST /api/v1/usuarios/perfil/:usuarioId
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Post(':usuarioId')
  @HttpCode(HttpStatus.CREATED)
  async criarPerfil(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() criarPerfilDto: CriarPerfilDto,
  ) {
    return this.perfilService.criar(usuarioId, criarPerfilDto);
  }

  /**
   * 🔍 Buscar meu perfil
   * GET /api/v1/usuarios/perfil/me
   *
   * 🛡️ Acesso: Usuário autenticado
   */
  @Get('me')
  async meuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.perfilService.buscarPorUsuario(user.id);
  }

  /**
   * 🔍 Buscar perfil por usuário (admin)
   * GET /api/v1/usuarios/perfil/:usuarioId
   *
   * 🛡️ Acesso: Gestores e administradores
   */
  @ManagerOnly()
  @Get(':usuarioId')
  async buscarPerfil(@Param('usuarioId', ParseUUIDPipe) usuarioId: string) {
    return this.perfilService.buscarPorUsuario(usuarioId);
  }

  /**
   * ✏️ Atualizar meu perfil
   * PATCH /api/v1/usuarios/perfil/me
   *
   * 🛡️ Acesso: Usuário autenticado
   */
  @Patch('me')
  async atualizarMeuPerfil(
    @Body() atualizarPerfilDto: AtualizarPerfilDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.perfilService.atualizar(user.id, atualizarPerfilDto);
  }

  /**
   * ✏️ Atualizar perfil de usuário (admin)
   * PATCH /api/v1/usuarios/perfil/:usuarioId
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Patch(':usuarioId')
  async atualizarPerfil(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() atualizarPerfilDto: AtualizarPerfilDto,
  ) {
    return this.perfilService.atualizar(usuarioId, atualizarPerfilDto);
  }

  /**
   * 🗑️ Excluir meu perfil
   * DELETE /api/v1/usuarios/perfil/me
   *
   * 🛡️ Acesso: Usuário autenticado
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluirMeuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.perfilService.excluir(user.id);
  }

  /**
   * 🗑️ Excluir perfil de usuário (admin)
   * DELETE /api/v1/usuarios/perfil/:usuarioId
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Delete(':usuarioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async excluirPerfil(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.perfilService.excluir(usuarioId, admin.id);
  }

  /**
   * 🌐 Buscar endereço por CEP
   * GET /api/v1/usuarios/perfil/cep/:cep
   *
   * 🛡️ Acesso: Usuário autenticado
   *
   * Utilitário para preenchimento automático de endereço
   */
  @Get('cep/:cep')
  async buscarEnderecoPorCep(@Param('cep') cep: string) {
    return this.perfilService.buscarEnderecoPorCep(cep);
  }

  /**
   * 📊 Estatísticas de perfis
   * GET /api/v1/usuarios/perfil/stats
   *
   * 🛡️ Acesso: Gestores e administradores
   */
  @ManagerOnly()
  @Get('stats')
  async obterEstatisticas() {
    return this.perfilService.obterEstatisticas();
  }
}

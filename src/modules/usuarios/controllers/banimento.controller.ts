import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/auth.decorator';
import { AdminOnly } from '../../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../../common/types/request.interface';
import { BanimentoService } from '../services/banimento.service';
import {
  AplicarBanimentoDto,
  RemoverBanimentoDto,
  FiltrarBanimentosDto,
} from '../dto/banimento.dto';

/**
 * 🚫 Controller para gestão de banimentos
 *
 * Endpoints para:
 * - Aplicar banimentos (temporários e permanentes)
 * - Remover banimentos
 * - Listar e monitorar banimentos
 * - Processamento automático de expiração
 */
@Controller('usuarios/banimentos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BanimentoController {
  constructor(private readonly banimentoService: BanimentoService) {}

  /**
   * 🚫 Aplicar banimento a um usuário
   * POST /api/v1/usuarios/banimentos/:usuarioId
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Post(':usuarioId')
  @HttpCode(HttpStatus.CREATED)
  async aplicarBanimento(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() aplicarBanimentoDto: AplicarBanimentoDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.banimentoService.aplicarBanimento(
      usuarioId,
      aplicarBanimentoDto,
      admin.id,
    );
  }

  /**
   * 🔓 Remover banimento de um usuário
   * PATCH /api/v1/usuarios/banimentos/:usuarioId/remover
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Patch(':usuarioId/remover')
  async removerBanimento(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Body() removerBanimentoDto: RemoverBanimentoDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.banimentoService.removerBanimento(
      usuarioId,
      removerBanimentoDto,
      admin.id,
    );
  }

  /**
   * 📋 Listar todos os banimentos
   * GET /api/v1/usuarios/banimentos
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Query params:
   * - tipoBanimento: filtro por tipo (TEMPORARIO_15_DIAS, PERMANENTE, etc.)
   * - banidoPor: filtro por admin que aplicou o banimento
   * - status: filtro por status (ativo, expirado, todos)
   * - pagina: número da página (padrão: 1)
   * - limite: itens por página (padrão: 10, máx: 100)
   */
  @AdminOnly()
  @Get()
  async listarBanimentos(@Query() filtros: FiltrarBanimentosDto) {
    return this.banimentoService.listarBanimentos(filtros);
  }

  /**
   * 🔍 Buscar detalhes de um banimento específico
   * GET /api/v1/usuarios/banimentos/:usuarioId
   *
   * 🛡️ Acesso: Apenas administradores
   */
  @AdminOnly()
  @Get(':usuarioId')
  async buscarBanimento(@Param('usuarioId', ParseUUIDPipe) usuarioId: string) {
    return this.banimentoService.buscarBanimento(usuarioId);
  }

  /**
   * 🔄 Processar banimentos expirados
   * POST /api/v1/usuarios/banimentos/processar-expirados
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Endpoint manual para forçar processamento de banimentos expirados.
   * Normalmente executado automaticamente por job/cron.
   */
  @AdminOnly()
  @Post('processar-expirados')
  async processarBanimentosExpirados() {
    const processados =
      await this.banimentoService.processarBanimentosExpirados();

    return {
      message: 'Banimentos expirados processados com sucesso',
      banimentosProcessados: processados,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 📊 Estatísticas de banimentos
   * GET /api/v1/usuarios/banimentos/stats
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Retorna métricas sobre banimentos:
   * - Total de usuários banidos
   * - Distribuição por tipo de banimento
   * - Banimentos ativos vs expirados
   * - Tendências mensais
   */
  @AdminOnly()
  @Get('stats')
  async obterEstatisticas() {
    return this.banimentoService.obterEstatisticas();
  }
}

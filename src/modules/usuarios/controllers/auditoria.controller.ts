import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
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
import {
  AuditoriaService,
  FiltroAuditoriaDto,
} from '../services/auditoria.service';
import { TipoAcao } from '@prisma/client';

/**
 * 📝 Controller para auditoria e logs do sistema
 *
 * Endpoints para:
 * - Consultar logs de auditoria
 * - Obter estatísticas de uso
 * - Monitorar atividades suspeitas
 * - Relatórios de conformidade
 */
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  /**
   * 📋 Listar logs de auditoria
   * GET /api/v1/auditoria
   *
   * 🛡️ Acesso: Gestores e administradores
   *
   * Query params:
   * - usuarioId: filtro por usuário específico
   * - acao: filtro por tipo de ação (LOGIN, LOGOUT, CRIACAO, etc.)
   * - dataInicio: data inicial (ISO string)
   * - dataFim: data final (ISO string)
   * - pagina: número da página (padrão: 1)
   * - limite: itens por página (padrão: 50, máx: 500)
   */
  @ManagerOnly()
  @Get()
  async listarLogs(@Query() filtros: FiltroAuditoriaDto) {
    // 🔧 Converter strings para tipos apropriados
    const filtrosProcessados: FiltroAuditoriaDto = {
      ...filtros,
      dataInicio: filtros.dataInicio
        ? new Date(filtros.dataInicio as string) // 🔧 CORREÇÃO: cast explícito
        : undefined,
      dataFim: filtros.dataFim
        ? new Date(filtros.dataFim as string) // 🔧 CORREÇÃO: cast explícito
        : undefined,
      acao: filtros.acao as TipoAcao,
    };

    return this.auditoriaService.listarLogs(filtrosProcessados);
  }

  /**
   * 🔍 Buscar logs por usuário específico
   * GET /api/v1/auditoria/usuario/:usuarioId
   *
   * 🛡️ Acesso: Gestores e administradores
   *
   * Query params:
   * - limite: número máximo de logs (padrão: 20, máx: 100)
   */
  @ManagerOnly()
  @Get('usuario/:usuarioId')
  async buscarLogsPorUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query('limite', ParseIntPipe) limite: number = 20,
  ) {
    const limiteSeguro = Math.min(limite, 100);
    return this.auditoriaService.buscarLogsPorUsuario(usuarioId, limiteSeguro);
  }

  /**
   * 👤 Meus logs de atividade
   * GET /api/v1/auditoria/me
   *
   * 🛡️ Acesso: Usuário autenticado (próprios logs)
   *
   * Query params:
   * - limite: número máximo de logs (padrão: 10, máx: 50)
   */
  @Get('me')
  async meusLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limite', ParseIntPipe) limite: number = 10,
  ) {
    const limiteSeguro = Math.min(limite, 50);
    return this.auditoriaService.buscarLogsPorUsuario(user.id, limiteSeguro);
  }

  /**
   * 📊 Estatísticas de auditoria
   * GET /api/v1/auditoria/stats
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Query params:
   * - dataInicio: data inicial para estatísticas (ISO string)
   * - dataFim: data final para estatísticas (ISO string)
   */
  @AdminOnly()
  @Get('stats')
  async obterEstatisticas(
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const filtros = {
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    };

    return this.auditoriaService.obterEstatisticas(
      filtros.dataInicio,
      filtros.dataFim,
    );
  }

  /**
   * 🧹 Limpar logs antigos
   * POST /api/v1/auditoria/limpar-antigos
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Remove logs com mais de 90 dias para manter performance.
   * ⚠️ Operação irreversível!
   */
  @AdminOnly()
  @Post('limpar-antigos')
  @HttpCode(HttpStatus.OK)
  async limparLogsAntigos(@CurrentUser() admin: AuthenticatedUser) {
    const logsRemovidos = await this.auditoriaService.limparLogsAntigos();

    // 📝 Log da operação de limpeza
    await this.auditoriaService.criarLog({
      usuarioId: admin.id,
      acao: 'EXCLUSAO',
      descricao: `Limpeza de logs antigos executada - ${logsRemovidos} registros removidos`,
      ipAddress: null,
      userAgent: null,
    });

    return {
      message: 'Limpeza de logs antigos executada com sucesso',
      logsRemovidos,
      executadoPor: admin.email,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🚨 Relatório de atividades suspeitas
   * GET /api/v1/auditoria/suspeitas
   *
   * 🛡️ Acesso: Apenas administradores
   *
   * Query params:
   * - dias: número de dias para análise (padrão: 7, máx: 30)
   */
  @AdminOnly()
  @Get('suspeitas')
  async relatorioAtividadesSuspeitas(
    @Query('dias', ParseIntPipe) dias: number = 7,
  ) {
    const diasSeguro = Math.min(Math.max(dias, 1), 30);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasSeguro);

    const logs = await this.auditoriaService.listarLogs({
      acao: TipoAcao.TENTATIVA_SUSPEITA,
      dataInicio,
      limite: 100,
    });

    return {
      periodo: `Últimos ${diasSeguro} dias`,
      totalAtividades: logs.total,
      atividades: logs.logs.map((log) => ({
        id: log.id,
        descricao: log.descricao,
        ipAddress: log.ipAddress,
        timestamp: log.criadoEm,
        usuario: log.usuario
          ? {
              id: log.usuario.id,
              email: log.usuario.email,
              nome: log.usuario.nome,
            }
          : null,
      })),
      geradoEm: new Date().toISOString(),
    };
  }

  /**
   * 📈 Relatório de logins por período
   * GET /api/v1/auditoria/relatorio-logins
   *
   * 🛡️ Acesso: Gestores e administradores
   *
   * Query params:
   * - dias: número de dias para análise (padrão: 30, máx: 90)
   */
  @ManagerOnly()
  @Get('relatorio-logins')
  async relatorioLogins(@Query('dias', ParseIntPipe) dias: number = 30) {
    const diasSeguro = Math.min(Math.max(dias, 1), 90);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasSeguro);

    const logs = await this.auditoriaService.listarLogs({
      acao: TipoAcao.LOGIN,
      dataInicio,
      limite: 1000,
    });

    // 📊 Agrupar por dia
    const loginsPorDia = logs.logs.reduce(
      (acc, log) => {
        const dia = log.criadoEm.toISOString().split('T')[0];
        acc[dia] = (acc[dia] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 👥 Usuários únicos
    const usuariosUnicos = new Set(
      logs.logs.filter((log) => log.usuarioId).map((log) => log.usuarioId),
    ).size;

    return {
      periodo: `Últimos ${diasSeguro} dias`,
      totalLogins: logs.total,
      usuariosUnicos,
      loginsPorDia,
      geradoEm: new Date().toISOString(),
    };
  }
}

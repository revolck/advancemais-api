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
import { AuditoriaService } from '../services/auditoria.service';
import { FiltroAuditoriaDto } from '../dto/filtro-auditoria.dto';
import { TipoAcao } from '@prisma/client';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @ManagerOnly()
  @Get()
  async listarLogs(@Query() filtros: FiltroAuditoriaDto) {
    return this.auditoriaService.listarLogs(filtros);
  }

  @ManagerOnly()
  @Get('usuario/:usuarioId')
  async buscarLogsPorUsuario(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Query('limite', ParseIntPipe) limite: number = 20,
  ) {
    const limiteSeguro = Math.min(limite, 100);
    return this.auditoriaService.buscarLogsPorUsuario(usuarioId, limiteSeguro);
  }

  @Get('me')
  async meusLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limite', ParseIntPipe) limite: number = 10,
  ) {
    const limiteSeguro = Math.min(limite, 50);
    return this.auditoriaService.buscarLogsPorUsuario(user.id, limiteSeguro);
  }

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

  @AdminOnly()
  @Post('limpar-antigos')
  @HttpCode(HttpStatus.OK)
  async limparLogsAntigos(@CurrentUser() admin: AuthenticatedUser) {
    const logsRemovidos = await this.auditoriaService.limparLogsAntigos();

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

    const loginsPorDia = logs.logs.reduce(
      (acc, log) => {
        const dia = log.criadoEm.toISOString().split('T')[0];
        acc[dia] = (acc[dia] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

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

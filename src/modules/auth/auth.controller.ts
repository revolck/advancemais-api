import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedUser } from '../../common/types/request.interface';

/**
 * 🔐 Controller de autenticação
 *
 * Endpoints para:
 * - Login e logout
 * - Renovação de tokens
 * - Informações do usuário logado
 */
@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 🔐 Endpoint de login
   * POST /api/v1/auth/login
   *
   * 🌐 Acesso público (sem autenticação)
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Ip() _ipAddress: string, // 🔧 CORREÇÃO: prefixo _ para indicar não utilizado
    @Headers('user-agent') _userAgent: string, // 🔧 CORREÇÃO: prefixo _ para indicar não utilizado
  ): Promise<AuthResponseDto> {
    // TODO: Implementar rate limiting por IP
    // TODO: Registrar tentativas de login para auditoria
    // TODO: Utilizar ipAddress e userAgent para logs de segurança

    return this.authService.login(loginDto);
  }

  /**
   * 🔄 Endpoint para renovar access token
   * POST /api/v1/auth/refresh
   *
   * 🌐 Acesso público (validação via refresh token)
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  /**
   * 🚪 Endpoint de logout
   * POST /api/v1/auth/logout
   *
   * 🔒 Requer autenticação JWT
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.authService.logout(user.id);
  }

  /**
   * 👤 Endpoint para obter dados do usuário logado
   * GET /api/v1/auth/me
   *
   * 🔒 Requer autenticação JWT
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      matricula: user.matricula,
      nome: user.nome,
      tipoUsuario: user.tipoUsuario,
      role: user.role,
      status: user.status,

      // 🚫 Informações de banimento (se aplicável)
      banimento: user.tipoBanimento
        ? {
            tipo: user.tipoBanimento,
            dataFim: user.dataFimBanimento,
            status: this.verificarStatusBanimento(user.dataFimBanimento),
          }
        : null,
    };
  }

  /**
   * ✅ Verificar se token é válido
   * GET /api/v1/auth/verify
   *
   * 🔒 Requer autenticação JWT
   *
   * Endpoint útil para SPAs verificarem se o token ainda é válido
   */
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@CurrentUser() user: AuthenticatedUser) {
    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🔐 Verificar força da sessão (futuro)
   * GET /api/v1/auth/session-info
   *
   * 🔒 Requer autenticação JWT
   */
  @Get('session-info')
  @HttpCode(HttpStatus.OK)
  async getSessionInfo(
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    // TODO: Implementar verificação de múltiplas sessões
    // TODO: Detectar mudanças de IP/User-Agent

    return {
      usuario: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      sessao: {
        ipAddress,
        userAgent,
        // TODO: Adicionar informações da sessão atual
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ⏰ Verificar status do banimento
   * @private
   */
  private verificarStatusBanimento(
    dataFim: Date | null,
  ): 'ativo' | 'expirado' | 'permanente' {
    if (!dataFim) return 'permanente';

    return new Date() > dataFim ? 'expirado' : 'ativo';
  }
}

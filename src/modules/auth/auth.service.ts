import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { HashUtil } from '../../utils/hash.util';
import { JwtUtil } from '../../utils/jwt.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private database: DatabaseService,
    private configService: ConfigService,
  ) {}

  /**
   * 🔐 Realiza login do usuário
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, senha } = loginDto;

    try {
      // Buscar usuário no banco MySQL
      const usuario = await this.database.usuario.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          senha: true,
          matricula: true,
          tipoUsuario: true,
          status: true,
          nome: true,
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // Verificar se usuário está ativo
      if (usuario.status !== 'ATIVO') {
        throw new UnauthorizedException('Usuário inativo');
      }

      // Verificar senha
      const senhaValida = await HashUtil.verificarHash(usuario.senha, senha);
      if (!senhaValida) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // Obter configurações JWT
      const jwtSecret = this.configService.get<string>('jwt.secret');
      const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn');
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
      const refreshExpiresIn = this.configService.get<string>(
        'jwt.refreshExpiresIn',
      );

      if (!jwtSecret || !refreshSecret) {
        this.logger.error('Configurações JWT não encontradas');
        throw new InternalServerErrorException('Erro interno de configuração');
      }

      // Gerar tokens
      const accessToken = await JwtUtil.gerarToken(
        {
          sub: usuario.id,
          email: usuario.email,
          tipoUsuario: usuario.tipoUsuario,
          matricula: usuario.matricula,
        },
        jwtSecret,
        jwtExpiresIn || '15m',
      );

      const refreshToken = await JwtUtil.gerarRefreshToken(
        usuario.id,
        refreshSecret,
        refreshExpiresIn || '7d',
      );

      // Salvar refresh token no banco
      await this.database.usuario.update({
        where: { id: usuario.id },
        data: {
          refreshToken,
          ultimoLogin: new Date(),
        },
      });

      this.logger.log(
        `Login realizado: ${usuario.email} (${usuario.matricula})`,
      );

      return {
        accessToken,
        refreshToken,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          matricula: usuario.matricula,
          tipoUsuario: usuario.tipoUsuario,
          nome: usuario.nome,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Erro no login:', error);
      throw new InternalServerErrorException('Erro interno no servidor');
    }
  }

  /**
   * 🔄 Atualiza access token usando refresh token
   */
  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;

    try {
      // Obter configurações
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

      if (!refreshSecret) {
        throw new InternalServerErrorException(
          'Configuração de refresh token não encontrada',
        );
      }

      // Verificar refresh token
      const payload = await JwtUtil.verificarToken(refreshToken, refreshSecret);

      // Buscar usuário
      const usuario = await this.database.usuario.findUnique({
        where: {
          id: payload.sub,
          refreshToken,
        },
        select: {
          id: true,
          email: true,
          matricula: true,
          tipoUsuario: true,
          status: true,
          nome: true,
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (usuario.status !== 'ATIVO') {
        throw new UnauthorizedException('Usuário inativo');
      }

      // Obter configurações JWT
      const jwtSecret = this.configService.get<string>('jwt.secret');
      const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn');
      const refreshExpiresIn = this.configService.get<string>(
        'jwt.refreshExpiresIn',
      );

      if (!jwtSecret) {
        throw new InternalServerErrorException(
          'Configuração JWT não encontrada',
        );
      }

      // Gerar novos tokens
      const accessToken = await JwtUtil.gerarToken(
        {
          sub: usuario.id,
          email: usuario.email,
          tipoUsuario: usuario.tipoUsuario,
          matricula: usuario.matricula,
        },
        jwtSecret,
        jwtExpiresIn || '15m',
      );

      const newRefreshToken = await JwtUtil.gerarRefreshToken(
        usuario.id,
        refreshSecret,
        refreshExpiresIn || '7d',
      );

      // Atualizar refresh token no banco
      await this.database.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          matricula: usuario.matricula,
          tipoUsuario: usuario.tipoUsuario,
          nome: usuario.nome,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  /**
   * 🚪 Realiza logout do usuário
   */
  async logout(userId: string): Promise<void> {
    try {
      await this.database.usuario.update({
        where: { id: userId },
        data: { refreshToken: null },
      });

      this.logger.log(`Logout realizado: ${userId}`);
    } catch (error) {
      this.logger.error('Erro no logout:', error);
      throw new InternalServerErrorException('Erro ao realizar logout');
    }
  }
}

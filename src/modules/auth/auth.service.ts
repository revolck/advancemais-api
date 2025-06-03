// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { HashUtil } from '../../utils/hash.util';
import { JwtUtil } from '../../utils/jwt.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private database: DatabaseService,
    private configService: ConfigService,
    private auditoriaService: AuditoriaService,
  ) {}

  async login(
    loginDto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, senha } = loginDto;

    // Buscar usuário
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
      // Log de tentativa de login com email inexistente
      await this.auditoriaService.criarLog({
        acao: 'ACESSO_NEGADO',
        descricao: `Tentativa de login com email não cadastrado: ${email}`,
        ipAddress: ip,
        userAgent,
      });

      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Verificar se usuário está ativo
    if (usuario.status !== 'ATIVO') {
      await this.auditoriaService.criarLog({
        usuarioId: usuario.id,
        acao: 'ACESSO_NEGADO',
        descricao: 'Tentativa de login com usuário inativo',
        ipAddress: ip,
        userAgent,
      });

      throw new UnauthorizedException('Usuário inativo');
    }

    // Verificar senha
    const senhaValida = await HashUtil.verificarHash(usuario.senha, senha);
    if (!senhaValida) {
      await this.auditoriaService.criarLog({
        usuarioId: usuario.id,
        acao: 'ACESSO_NEGADO',
        descricao: 'Tentativa de login com senha incorreta',
        ipAddress: ip,
        userAgent,
      });

      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Gerar tokens
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
    );

    const accessToken = await JwtUtil.gerarToken(
      {
        sub: usuario.id,
        email: usuario.email,
        tipoUsuario: usuario.tipoUsuario,
        matricula: usuario.matricula,
      },
      jwtSecret,
      jwtExpiresIn,
    );

    const refreshToken = await JwtUtil.gerarRefreshToken(
      usuario.id,
      refreshSecret,
      refreshExpiresIn,
    );

    // Salvar refresh token no banco
    await this.database.usuario.update({
      where: { id: usuario.id },
      data: {
        refreshToken,
        ultimoLogin: new Date(),
      },
    });

    // Log de login bem-sucedido
    await this.auditoriaService.criarLog({
      usuarioId: usuario.id,
      acao: 'LOGIN',
      descricao: `Login realizado com sucesso`,
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`Login realizado: ${usuario.email} (${usuario.matricula})`);

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
  }

  async refreshToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verificar refresh token
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
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

      // Gerar novos tokens
      const jwtSecret = this.configService.get<string>('jwt.secret');
      const jwtExpiresIn = this.configService.get<string>('jwt.expiresIn');
      const refreshExpiresIn = this.configService.get<string>(
        'jwt.refreshExpiresIn',
      );

      const accessToken = await JwtUtil.gerarToken(
        {
          sub: usuario.id,
          email: usuario.email,
          tipoUsuario: usuario.tipoUsuario,
          matricula: usuario.matricula,
        },
        jwtSecret,
        jwtExpiresIn,
      );

      const newRefreshToken = await JwtUtil.gerarRefreshToken(
        usuario.id,
        refreshSecret,
        refreshExpiresIn,
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
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  async logout(userId: string, ip?: string, userAgent?: string): Promise<void> {
    // Remover refresh token
    await this.database.usuario.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    // Log de logout
    await this.auditoriaService.criarLog({
      usuarioId: userId,
      acao: 'LOGOUT',
      descricao: 'Logout realizado',
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`Logout realizado: ${userId}`);
  }

  async validateUser(email: string, senha: string): Promise<any> {
    const usuario = await this.database.usuario.findUnique({
      where: { email },
    });

    if (usuario && (await HashUtil.verificarHash(usuario.senha, senha))) {
      const { senha: _, ...result } = usuario;
      return result;
    }

    return null;
  }
}

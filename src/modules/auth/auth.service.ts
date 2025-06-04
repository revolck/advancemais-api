import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Status, TipoBanimento } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { HashUtil } from '../../utils/hash.util';
import { JwtUtil } from '../../utils/jwt.util';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

// 🔧 Interface tipada para dados do usuário
interface UsuarioData {
  id: string;
  email: string;
  senha?: string;
  matricula: string;
  nome: string | null;
  tipoUsuario: string;
  role: string;
  status: string;
  tipoBanimento?: string | null;
  dataInicioBanimento?: Date | null;
  dataFimBanimento?: Date | null;
  motivoBanimento?: string | null;
  banidoPor?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private database: DatabaseService,
    private configService: ConfigService,
  ) {}

  /**
   * 🔐 Realiza login do usuário com validações de banimento
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, senha } = loginDto;

    try {
      // Buscar usuário no banco com todos os campos necessários
      const usuario = await this.database.usuario.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          senha: true,
          matricula: true,
          nome: true,
          tipoUsuario: true,
          role: true,
          status: true,
          tipoBanimento: true,
          dataInicioBanimento: true,
          dataFimBanimento: true,
          motivoBanimento: true,
          banidoPor: true,
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // 🚫 Verificar status do usuário
      if (usuario.status === Status.INATIVO) {
        throw new UnauthorizedException('Conta inativa. Contate o suporte.');
      }

      // 🚫 Verificar banimento
      await this.verificarBanimento(usuario as UsuarioData);

      // 🔒 Verificar senha
      const senhaValida = await HashUtil.verificarHash(usuario.senha!, senha);
      if (!senhaValida) {
        // 📝 Log da tentativa de login inválida para auditoria
        await this.criarLogAuditoria(
          usuario.id,
          'TENTATIVA_SUSPEITA',
          `Tentativa de login com senha incorreta`,
          null,
        );
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // 🎫 Gerar tokens
      const tokens = await this.gerarTokens(usuario as UsuarioData);

      // 📝 Atualizar último login e salvar refresh token
      await this.database.usuario.update({
        where: { id: usuario.id },
        data: {
          refreshToken: tokens.refreshToken,
          ultimoLogin: new Date(),
        },
      });

      // 📝 Log de login bem-sucedido
      await this.criarLogAuditoria(
        usuario.id,
        'LOGIN',
        'Login realizado com sucesso',
        null,
      );

      this.logger.log(
        `Login realizado: ${usuario.email} (${usuario.matricula}) - Role: ${usuario.role}`,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          matricula: usuario.matricula,
          nome: usuario.nome,
          tipoUsuario: usuario.tipoUsuario as any,
          role: usuario.role as any,
          status: usuario.status as any,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
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
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');

      if (!refreshSecret) {
        throw new InternalServerErrorException(
          'Configuração de refresh token não encontrada',
        );
      }

      // 🔍 Verificar refresh token
      const payload = await JwtUtil.verificarToken(refreshToken, refreshSecret);

      // 🔍 Buscar usuário
      const usuario = await this.database.usuario.findUnique({
        where: {
          id: payload.sub,
          refreshToken,
        },
        select: {
          id: true,
          email: true,
          matricula: true,
          nome: true,
          tipoUsuario: true,
          role: true,
          status: true,
          tipoBanimento: true,
          dataInicioBanimento: true,
          dataFimBanimento: true,
          motivoBanimento: true,
          banidoPor: true,
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      // 🚫 Verificar status e banimento
      if (usuario.status === Status.INATIVO) {
        throw new UnauthorizedException('Conta inativa');
      }

      await this.verificarBanimento(usuario as UsuarioData);

      // 🎫 Gerar novos tokens
      const tokens = await this.gerarTokens(usuario as UsuarioData);

      // 💾 Atualizar refresh token no banco
      await this.database.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          matricula: usuario.matricula,
          nome: usuario.nome,
          tipoUsuario: usuario.tipoUsuario as any,
          role: usuario.role as any,
          status: usuario.status as any,
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

      // 📝 Log de logout
      await this.criarLogAuditoria(userId, 'LOGOUT', 'Logout realizado', null);

      this.logger.log(`Logout realizado: ${userId}`);
    } catch (error) {
      this.logger.error('Erro no logout:', error);
      throw new InternalServerErrorException('Erro ao realizar logout');
    }
  }

  /**
   * 🚫 Verifica se o usuário está banido
   * @private
   */
  private async verificarBanimento(usuario: UsuarioData): Promise<void> {
    if (usuario.status === Status.BANIDO) {
      // 📅 Verificar se o banimento expirou
      if (
        usuario.dataFimBanimento &&
        new Date() > new Date(usuario.dataFimBanimento)
      ) {
        // 🔓 Remover banimento expirado
        await this.database.usuario.update({
          where: { id: usuario.id },
          data: {
            status: Status.ATIVO,
            tipoBanimento: null,
            dataInicioBanimento: null,
            dataFimBanimento: null,
            motivoBanimento: null,
            banidoPor: null,
          },
        });

        // 📝 Log da remoção do banimento
        await this.criarLogAuditoria(
          usuario.id,
          'BANIMENTO_EXPIRADO',
          'Banimento expirado automaticamente',
          null,
        );

        this.logger.log(
          `Banimento expirado removido para usuário: ${usuario.email}`,
        );
        return;
      }

      // 🚫 Banimento ainda ativo
      const motivoCompleto = this.construirMensagemBanimento(usuario);
      throw new ForbiddenException(motivoCompleto);
    }
  }

  /**
   * 📝 Constrói mensagem detalhada de banimento
   * @private
   */
  private construirMensagemBanimento(usuario: UsuarioData): string {
    let mensagem = 'Conta banida.';

    if (usuario.motivoBanimento) {
      mensagem += ` Motivo: ${usuario.motivoBanimento}`;
    }

    if (usuario.dataFimBanimento) {
      const dataFim = new Date(usuario.dataFimBanimento).toLocaleDateString(
        'pt-BR',
      );
      mensagem += ` Banimento válido até: ${dataFim}`;
    } else if (usuario.tipoBanimento === TipoBanimento.PERMANENTE) {
      mensagem += ' Banimento permanente.';
    }

    mensagem += ' Contate o suporte para mais informações.';
    return mensagem;
  }

  /**
   * 🎫 Gera tokens JWT para o usuário
   * @private
   */
  private async gerarTokens(usuario: UsuarioData): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
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

    const accessToken = await JwtUtil.gerarToken(
      {
        sub: usuario.id,
        email: usuario.email,
        tipoUsuario: usuario.tipoUsuario as any,
        matricula: usuario.matricula,
        role: usuario.role as any,
        status: usuario.status as any,
      },
      jwtSecret,
      jwtExpiresIn || '15m',
    );

    const refreshToken = await JwtUtil.gerarRefreshToken(
      usuario.id,
      refreshSecret,
      refreshExpiresIn || '7d',
    );

    return { accessToken, refreshToken };
  }

  /**
   * 📝 Cria log de auditoria
   * @private
   */
  private async criarLogAuditoria(
    usuarioId: string,
    acao: string,
    descricao: string,
    ipAddress: string | null,
  ): Promise<void> {
    try {
      await this.database.logAuditoria.create({
        data: {
          usuarioId,
          acao: acao as any,
          descricao,
          ipAddress,
          userAgent: null,
        },
      });
    } catch (error) {
      this.logger.error('Erro ao criar log de auditoria:', error);
    }
  }
}

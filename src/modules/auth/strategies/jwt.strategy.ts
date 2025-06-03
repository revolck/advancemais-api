import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../../database/database.service';
import { JwtPayload } from '../../../utils/jwt.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private database: DatabaseService,
  ) {
    const jwtSecret = configService.get<string>('jwt.secret');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET não configurado no ambiente');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * ✅ Valida payload do JWT e retorna dados do usuário
   * 🔧 CORREÇÃO: Agora o database.usuario existe porque DatabaseService herda do PrismaClient
   */
  async validate(payload: JwtPayload) {
    try {
      const usuario = await this.database.usuario.findUnique({
        where: { id: payload.sub },
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
        throw new UnauthorizedException('Usuário não encontrado');
      }

      if (usuario.status !== 'ATIVO') {
        throw new UnauthorizedException('Usuário inativo');
      }

      return usuario;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}

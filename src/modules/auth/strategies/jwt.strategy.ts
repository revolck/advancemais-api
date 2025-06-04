import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Status } from '@prisma/client';
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
   * ✅ Valida payload do JWT e retorna dados completos do usuário
   * Incluindo verificações de status e banimento
   */
  async validate(payload: JwtPayload) {
    try {
      const usuario = await this.database.usuario.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          matricula: true,
          nome: true,
          tipoUsuario: true,
          role: true,
          status: true,
          tipoBanimento: true,
          dataFimBanimento: true,
          banidoPor: true,
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Usuário não encontrado');
      }

      // 🚫 Verificar se usuário está ativo
      if (usuario.status === Status.INATIVO) {
        throw new UnauthorizedException('Conta inativa');
      }

      // 🚫 Verificar banimento
      if (usuario.status === Status.BANIDO) {
        // 📅 Verificar se banimento expirou
        if (
          usuario.dataFimBanimento &&
          new Date() > new Date(usuario.dataFimBanimento)
        ) {
          // 🔓 Atualizar status para ativo (banimento expirado)
          await this.database.usuario.update({
            where: { id: usuario.id },
            data: {
              status: Status.ATIVO,
              tipoBanimento: null,
              dataFimBanimento: null,
              banidoPor: null,
            },
          });

          // ✅ Permitir acesso com status atualizado
          return {
            id: usuario.id,
            email: usuario.email,
            matricula: usuario.matricula,
            nome: usuario.nome,
            tipoUsuario: usuario.tipoUsuario,
            role: usuario.role,
            status: Status.ATIVO,
            tipoBanimento: null,
            dataFimBanimento: null,
            banidoPor: null,
          };
        } else {
          // 🚫 Banimento ainda ativo
          throw new UnauthorizedException('Conta banida');
        }
      }

      // ✅ Retornar dados do usuário válido
      return {
        id: usuario.id,
        email: usuario.email,
        matricula: usuario.matricula,
        nome: usuario.nome,
        tipoUsuario: usuario.tipoUsuario,
        role: usuario.role,
        status: usuario.status,
        tipoBanimento: usuario.tipoBanimento,
        dataFimBanimento: usuario.dataFimBanimento,
        banidoPor: usuario.banidoPor,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido');
    }
  }
}

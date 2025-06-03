import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string; // ID do usuário
  email: string; // Email do usuário
  tipoUsuario: string; // Tipo do usuário
  matricula: string; // Matrícula única
  iat?: number; // Issued at
  exp?: number; // Expires at
}

export class JwtUtil {
  private static textEncoder = new TextEncoder();

  /**
   * 🔐 Gera token JWT assinado usando jose
   */
  static async gerarToken(
    payload: Omit<JwtPayload, 'iat' | 'exp'>,
    secret: string,
    expiresIn: string = '15m',
  ): Promise<string> {
    const secretKey = this.textEncoder.encode(secret);

    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secretKey);
  }

  /**
   * ✅ Verifica e decodifica token JWT
   */
  static async verificarToken(
    token: string,
    secret: string,
  ): Promise<JwtPayload> {
    const secretKey = this.textEncoder.encode(secret);

    try {
      const { payload } = await jwtVerify(token, secretKey);

      // Validar propriedades necessárias e converter corretamente
      if (
        typeof payload.sub === 'string' &&
        typeof payload.email === 'string' &&
        typeof payload.tipoUsuario === 'string' &&
        typeof payload.matricula === 'string'
      ) {
        return {
          sub: payload.sub,
          email: payload.email,
          tipoUsuario: payload.tipoUsuario,
          matricula: payload.matricula,
          iat: payload.iat,
          exp: payload.exp,
        };
      }

      throw new Error(
        'Payload do token não contém as propriedades necessárias',
      );
    } catch (error) {
      throw new Error(`Token JWT inválido: ${error.message}`);
    }
  }

  /**
   * 🔄 Gera refresh token
   */
  static async gerarRefreshToken(
    userId: string,
    secret: string,
    expiresIn: string = '7d',
  ): Promise<string> {
    const secretKey = this.textEncoder.encode(secret);

    return new SignJWT({ sub: userId, type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secretKey);
  }
}

import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  tipoUsuario: string;
  matricula: string;
  iat?: number;
  exp?: number;
}

export class JwtUtil {
  private static textEncoder = new TextEncoder();

  /**
   * Gera token JWT usando jose
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
   * Verifica e decodifica token JWT
   */
  static async verificarToken(
    token: string,
    secret: string,
  ): Promise<JwtPayload> {
    const secretKey = this.textEncoder.encode(secret);

    try {
      const { payload } = await jwtVerify(token, secretKey);
      return payload as JwtPayload;
    } catch (error) {
      throw new Error(`Token inválido: ${error.message}`);
    }
  }

  /**
   * Gera refresh token
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

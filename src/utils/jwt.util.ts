import { SignJWT, jwtVerify } from 'jose';
import { Role, Status, TipoUsuario } from '@prisma/client';

/**
 * 🎫 Interface do payload JWT
 * Contém informações essenciais do usuário para o token
 */
export interface JwtPayload {
  sub: string; // ID do usuário
  email: string; // Email do usuário
  tipoUsuario: TipoUsuario; // Tipo do usuário (PF/PJ)
  matricula: string; // Matrícula única
  role: Role; // Role do usuário no sistema
  status: Status; // Status atual do usuário
  iat?: number; // Issued at
  exp?: number; // Expires at
}

/**
 * 🔧 Utilitário para manipulação de tokens JWT
 * Utiliza a biblioteca jose para maior segurança
 */
export class JwtUtil {
  private static textEncoder = new TextEncoder();

  /**
   * 🔐 Gera token JWT assinado usando jose
   * @param payload - Dados do usuário para incluir no token
   * @param secret - Chave secreta para assinatura
   * @param expiresIn - Tempo de expiração (ex: '15m', '1h', '7d')
   * @returns Token JWT assinado
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
   * @param token - Token JWT para verificar
   * @param secret - Chave secreta para verificação
   * @returns Payload decodificado e validado
   */
  static async verificarToken(
    token: string,
    secret: string,
  ): Promise<JwtPayload> {
    const secretKey = this.textEncoder.encode(secret);

    try {
      const { payload } = await jwtVerify(token, secretKey);

      // 🔍 Validar propriedades necessárias e converter corretamente
      if (
        typeof payload.sub === 'string' &&
        typeof payload.email === 'string' &&
        typeof payload.tipoUsuario === 'string' &&
        typeof payload.matricula === 'string' &&
        typeof payload.role === 'string' &&
        typeof payload.status === 'string'
      ) {
        return {
          sub: payload.sub,
          email: payload.email,
          tipoUsuario: payload.tipoUsuario as TipoUsuario,
          matricula: payload.matricula,
          role: payload.role as Role,
          status: payload.status as Status,
          iat: payload.iat,
          exp: payload.exp,
        };
      }

      throw new Error(
        'Payload do token não contém as propriedades necessárias',
      );
    } catch (err) {
      // 🔧 CORREÇÃO: variável renomeada
      throw new Error(`Token JWT inválido: ${err.message}`);
    }
  }

  /**
   * 🔄 Gera refresh token simplificado
   * @param userId - ID do usuário
   * @param secret - Chave secreta para assinatura
   * @param expiresIn - Tempo de expiração (ex: '7d', '30d')
   * @returns Refresh token JWT
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

  /**
   * 📊 Decodifica token sem verificar assinatura (apenas para debug)
   * ⚠️ NÃO usar em produção para validação
   * @param token - Token JWT para decodificar
   * @returns Payload decodificado (não verificado)
   */
  static decodificarToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token JWT malformado');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      );
      return payload;
    } catch (err) {
      // 🔧 CORREÇÃO: variável renomeada
      throw new Error(`Erro ao decodificar token: ${err.message}`);
    }
  }

  /**
   * ⏰ Verifica se o token está expirado
   * @param token - Token JWT para verificar
   * @returns true se o token estiver expirado
   */
  static isTokenExpirado(token: string): boolean {
    try {
      const payload = this.decodificarToken(token);
      if (!payload.exp) return false;

      const agora = Math.floor(Date.now() / 1000);
      return payload.exp < agora;
    } catch {
      return true; // Considerar expirado se não conseguir decodificar
    }
  }
}

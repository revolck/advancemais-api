import { google } from 'googleapis';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

const oauthLogger = logger.child({ module: 'GoogleOAuth' });

// Configuração OAuth 2.0
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Construir URL de callback dinamicamente (não precisa estar no .env)
function getRedirectUri(): string {
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${apiUrl}/api/v1/auth/google/callback`;
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Criptografar token (AES-256)
 */
function encryptToken(token: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'secret', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografar token (AES-256)
 */
function decryptToken(encryptedToken: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'secret', 'salt', 32);
  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Service de integração Google OAuth
 */
export const googleOAuthService = {
  /**
   * Gerar URL de autorização Google
   */
  generateAuthUrl(usuarioId: string): string {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error(
        'Google OAuth não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET',
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      getRedirectUri(),
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Força refresh token
      state: usuarioId, // Passar usuarioId no state para recuperar no callback
    });

    oauthLogger.info('[OAUTH] URL de autorização gerada', { usuarioId });

    return authUrl;
  },

  /**
   * Processar callback do Google OAuth
   */
  async handleCallback(code: string, usuarioId: string) {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      getRedirectUri(),
    );

    // Trocar code por tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Tokens do Google inválidos');
    }

    // Criptografar tokens antes de salvar
    const accessTokenEncrypted = encryptToken(tokens.access_token);
    const refreshTokenEncrypted = encryptToken(tokens.refresh_token);

    // Salvar no banco
    const usuario = await prisma.usuarios.update({
      where: { id: usuarioId },
      data: {
        googleAccessToken: accessTokenEncrypted,
        googleRefreshToken: refreshTokenEncrypted,
        googleCalendarId: 'primary',
        googleTokenExpiraEm: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    oauthLogger.info('[OAUTH] Google conectado com sucesso', { usuarioId });

    // TODO: Sincronizar aulas ao vivo existentes
    // await this.sincronizarAulasExistentes(usuarioId);

    return { success: true, message: 'Google conectado com sucesso!' };
  },

  /**
   * Desconectar Google
   */
  async disconnect(usuarioId: string) {
    await prisma.usuarios.update({
      where: { id: usuarioId },
      data: {
        googleAccessToken: null,
        googleRefreshToken: null,
        googleCalendarId: null,
        googleTokenExpiraEm: null,
      },
    });

    oauthLogger.info('[OAUTH] Google desconectado', { usuarioId });

    return { success: true, message: 'Google desconectado' };
  },

  /**
   * Verificar status da conexão
   */
  async getStatus(usuarioId: string) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      select: {
        googleCalendarId: true,
        googleTokenExpiraEm: true,
      },
    });

    const conectado = !!usuario?.googleCalendarId;
    const expirado = usuario?.googleTokenExpiraEm
      ? new Date() > usuario.googleTokenExpiraEm
      : false;

    return {
      conectado,
      expirado,
      calendarId: usuario?.googleCalendarId,
      expiraEm: usuario?.googleTokenExpiraEm?.toISOString() || null,
    };
  },

  /**
   * Obter OAuth2Client configurado (com renovação automática)
   */
  async getOAuth2Client(usuarioId: string) {
    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuarioId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiraEm: true,
      },
    });

    if (!usuario?.googleAccessToken || !usuario?.googleRefreshToken) {
      throw new Error('Google não conectado. Conecte sua conta primeiro.');
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      getRedirectUri(),
    );

    // Descriptografar tokens
    const accessToken = decryptToken(usuario.googleAccessToken);
    const refreshToken = decryptToken(usuario.googleRefreshToken);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Verificar se token expirou e renovar automaticamente
    if (usuario.googleTokenExpiraEm && new Date() > usuario.googleTokenExpiraEm) {
      oauthLogger.info('[OAUTH] Token expirado, renovando...', { usuarioId });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        const newAccessTokenEncrypted = encryptToken(credentials.access_token);

        await prisma.usuarios.update({
          where: { id: usuarioId },
          data: {
            googleAccessToken: newAccessTokenEncrypted,
            googleTokenExpiraEm: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });

        oauthLogger.info('[OAUTH] Token renovado com sucesso', { usuarioId });
      }
    }

    return oauth2Client;
  },
};

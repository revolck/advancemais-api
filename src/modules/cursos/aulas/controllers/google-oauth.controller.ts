import { Request, Response } from 'express';
import { googleOAuthService } from '../services/google-oauth.service';
import { serverConfig } from '@/config/env';
import { logger } from '@/utils/logger';

const frontendUrl = serverConfig.frontendUrl.replace(/\/+$/, '');

const DEFAULT_RETURN_TO = '/dashboard/configuracoes';

/**
 * Só aceita caminhos relativos internos (começando com "/", nunca "//" nem contendo
 * "://") — evita que `returnTo` seja usado para um open redirect.
 */
function isSafeReturnPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.includes('://')
  );
}

/** Extrai `{usuarioId, returnTo}` do `state` gerado por `generateAuthUrl`. */
function parseState(state: string): { usuarioId: string; returnTo: string } {
  const [usuarioId, encodedReturnTo] = state.split('::');
  const decoded = encodedReturnTo ? decodeURIComponent(encodedReturnTo) : null;
  const returnTo = isSafeReturnPath(decoded) ? decoded : DEFAULT_RETURN_TO;
  return { usuarioId, returnTo };
}

export class GoogleOAuthController {
  /**
   * GET /api/v1/auth/google/connect
   * Iniciar processo de OAuth
   */
  static connect = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user!.id;
      const returnToParam = req.query.returnTo;
      const returnTo = isSafeReturnPath(returnToParam) ? returnToParam : undefined;

      const authUrl = await googleOAuthService.generateAuthUrl(usuarioId, returnTo);

      res.json({
        success: true,
        authUrl,
      });
    } catch (error: any) {
      logger.error('[GOOGLE_CONNECT_ERROR]', { error: error?.message });
      res.status(500).json({
        success: false,
        code: 'GOOGLE_CONNECT_ERROR',
        message: error?.message || 'Erro ao gerar URL de conexão',
      });
    }
  };

  /**
   * GET /api/v1/auth/google/callback
   * Callback após autorização
   */
  static callback = async (req: Request, res: Response) => {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PARAMS',
        message: 'Código ou state ausente',
      });
    }

    const { usuarioId, returnTo } = parseState(state);

    try {
      await googleOAuthService.handleCallback(code, usuarioId);

      // Redirecionar para o frontend, de volta pra onde a conexão foi iniciada
      res.redirect(`${frontendUrl}${returnTo}?google=conectado`);
    } catch (error: any) {
      logger.error('[GOOGLE_CALLBACK_ERROR]', { error: error?.message });
      res.redirect(`${frontendUrl}${returnTo}?google=erro`);
    }
  };

  /**
   * POST /api/v1/auth/google/disconnect
   * Desconectar Google
   */
  static disconnect = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user!.id;

      await googleOAuthService.disconnect(usuarioId);

      res.json({
        success: true,
        message: 'Google desconectado com sucesso',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'GOOGLE_DISCONNECT_ERROR',
        message: error?.message || 'Erro ao desconectar',
      });
    }
  };

  /**
   * GET /api/v1/auth/google/status
   * Verificar status da conexão
   */
  static status = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user!.id;

      const status = await googleOAuthService.getStatus(usuarioId);

      res.json({
        success: true,
        ...status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'GOOGLE_STATUS_ERROR',
        message: error?.message || 'Erro ao verificar status',
      });
    }
  };
}

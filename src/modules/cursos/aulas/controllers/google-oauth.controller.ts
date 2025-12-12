import { Request, Response } from 'express';
import { googleOAuthService } from '../services/google-oauth.service';
import { logger } from '@/utils/logger';

export class GoogleOAuthController {
  /**
   * GET /api/v1/auth/google/connect
   * Iniciar processo de OAuth
   */
  static connect = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user!.id;
      const authUrl = googleOAuthService.generateAuthUrl(usuarioId);

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
    try {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_PARAMS',
          message: 'Código ou state ausente',
        });
      }

      const usuarioId = state; // state contém o usuarioId

      await googleOAuthService.handleCallback(code, usuarioId);

      // Redirecionar para o frontend
      res.redirect(`${process.env.FRONTEND_URL}/dashboard/configuracoes?google=conectado`);
    } catch (error: any) {
      logger.error('[GOOGLE_CALLBACK_ERROR]', { error: error?.message });
      res.redirect(`${process.env.FRONTEND_URL}/dashboard/configuracoes?google=erro`);
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

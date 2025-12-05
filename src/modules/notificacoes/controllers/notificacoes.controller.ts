import { Request, Response } from 'express';
import { notificacoesService } from '../services/notificacoes.service';
import {
  listNotificacoesSchema,
  marcarComoLidaSchema,
  marcarTodasComoLidasSchema,
  arquivarNotificacoesSchema,
} from '../validators/notificacoes.schema';
import { ZodError } from 'zod';

export class NotificacoesController {
  /**
   * GET /api/v1/notificacoes
   * Lista notificações do usuário autenticado
   */
  static async list(req: Request, res: Response) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const query = listNotificacoesSchema.parse(req.query);
      const result = await notificacoesService.list(usuarioId, query);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação',
          issues: error.errors,
        });
      }

      console.error('Erro ao listar notificações:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro ao listar notificações',
      });
    }
  }

  /**
   * GET /api/v1/notificacoes/contador
   * Retorna contador de notificações não lidas
   */
  static async contador(req: Request, res: Response) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const result = await notificacoesService.contarNaoLidas(usuarioId);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Erro ao contar notificações:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro ao contar notificações',
      });
    }
  }

  /**
   * PUT /api/v1/notificacoes/lidas
   * Marca notificações específicas como lidas
   */
  static async marcarComoLida(req: Request, res: Response) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const input = marcarComoLidaSchema.parse(req.body);
      const result = await notificacoesService.marcarComoLida(usuarioId, input);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação',
          issues: error.errors,
        });
      }

      console.error('Erro ao marcar notificações como lidas:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro ao marcar notificações como lidas',
      });
    }
  }

  /**
   * PUT /api/v1/notificacoes/lidas/todas
   * Marca todas as notificações como lidas
   */
  static async marcarTodasComoLidas(req: Request, res: Response) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const input = marcarTodasComoLidasSchema.parse(req.body);
      const result = await notificacoesService.marcarTodasComoLidas(usuarioId, input);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação',
          issues: error.errors,
        });
      }

      console.error('Erro ao marcar todas notificações como lidas:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro ao marcar todas notificações como lidas',
      });
    }
  }

  /**
   * PUT /api/v1/notificacoes/arquivar
   * Arquiva notificações específicas
   */
  static async arquivar(req: Request, res: Response) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado',
        });
      }

      const input = arquivarNotificacoesSchema.parse(req.body);
      const result = await notificacoesService.arquivar(usuarioId, input);

      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação',
          issues: error.errors,
        });
      }

      console.error('Erro ao arquivar notificações:', error);
      return res.status(500).json({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Erro ao arquivar notificações',
      });
    }
  }
}


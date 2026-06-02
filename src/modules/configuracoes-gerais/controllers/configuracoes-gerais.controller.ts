import type { Request, Response } from 'express';
import { configuracoesGeraisService } from '../services/configuracoes-gerais.service';
import { logger } from '@/utils/logger';

const controllerLogger = logger.child({ module: 'ConfiguracoesGeraisController' });

function getStatusCode(error: unknown): number {
  const statusCode = Number((error as any)?.statusCode || (error as any)?.status || 500);
  return Number.isFinite(statusCode) ? statusCode : 500;
}

function sendError(res: Response, error: unknown) {
  const statusCode = getStatusCode(error);
  return res.status(statusCode).json({
    success: false,
    code: (error as any)?.code || 'CONFIGURACOES_GERAIS_ERROR',
    message:
      error instanceof Error
        ? error.message
        : 'Não foi possível processar a configuração no momento.',
  });
}

export class ConfiguracoesGeraisController {
  static async list(req: Request, res: Response) {
    try {
      const data = await configuracoesGeraisService.listAll();
      return res.json({ success: true, data });
    } catch (error) {
      controllerLogger.error({ err: error, userId: req.user?.id }, 'Erro ao listar configurações');
      return sendError(res, error);
    }
  }

  static async updateCategory(req: Request, res: Response) {
    try {
      const data = await configuracoesGeraisService.updateCategory(
        req.params.categoria,
        req.body ?? {},
        req,
      );
      return res.json({ success: true, data });
    } catch (error) {
      controllerLogger.error(
        { err: error, category: req.params.categoria, userId: req.user?.id },
        'Erro ao atualizar configuração',
      );
      return sendError(res, error);
    }
  }

  static async testCategory(req: Request, res: Response) {
    try {
      const data = await configuracoesGeraisService.testCategory(req.params.categoria);
      return res.json({ success: true, data });
    } catch (error) {
      controllerLogger.error(
        { err: error, category: req.params.categoria, userId: req.user?.id },
        'Erro ao testar configuração',
      );
      return sendError(res, error);
    }
  }

  static async history(req: Request, res: Response) {
    try {
      const data = await configuracoesGeraisService.listHistory({
        page: Number(req.query.page || 1),
        pageSize: Number(req.query.pageSize || 20),
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      controllerLogger.error({ err: error, userId: req.user?.id }, 'Erro ao listar histórico');
      return sendError(res, error);
    }
  }

  static async publicMercadoPago(req: Request, res: Response) {
    try {
      const data = await configuracoesGeraisService.getPublicMercadoPagoConfig();
      return res.json({ success: true, data });
    } catch (error) {
      controllerLogger.error({ err: error }, 'Erro ao obter configuração pública Mercado Pago');
      return sendError(res, error);
    }
  }
}

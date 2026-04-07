import type { Request, Response } from 'express';

import { instrutorOverviewService } from '../services/overview.service';

export const instrutorOverviewController = {
  async get(req: Request, res: Response) {
    try {
      const user = (req as any).user as { id?: string } | undefined;
      const instrutorId = user?.id;

      if (!instrutorId) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Token inválido ou ausente.',
        });
      }

      const data = await instrutorOverviewService.getOverview(instrutorId);

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: 'INSTRUTOR_SCOPE_ERROR',
        message: 'Erro ao carregar visão geral do instrutor.',
        error: error?.message,
      });
    }
  },
};

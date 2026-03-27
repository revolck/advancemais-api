import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { logger } from '@/utils/logger';
import { dashboardFinanceiroService } from '../services/financeiro.service';
import { dashboardFinanceiroFiltersSchema } from '../validators/financeiro.schema';

const financeiroControllerLogger = logger.child({ module: 'DashboardFinanceiroController' });

export const financeiroController = {
  getResumo: async (req: Request, res: Response) => {
    try {
      const filters = dashboardFinanceiroFiltersSchema.parse(req.query);
      const data = await dashboardFinanceiroService.obterDashboard(filters);

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      financeiroControllerLogger.error(
        { err: error, query: req.query },
        'Erro ao carregar dashboard financeiro',
      );

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'DASHBOARD_FINANCEIRO_INVALID_FILTERS',
          message: 'Os filtros informados para o dashboard financeiro são inválidos.',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      return res.status(error?.statusCode || 500).json({
        success: false,
        code: error?.code || 'DASHBOARD_FINANCEIRO_ERROR',
        message: error?.message || 'Não foi possível carregar o dashboard financeiro.',
      });
    }
  },

  getFiltros: async (_req: Request, res: Response) => {
    const data = dashboardFinanceiroService.obterFiltrosDisponiveis();

    return res.json({
      success: true,
      data,
    });
  },
};

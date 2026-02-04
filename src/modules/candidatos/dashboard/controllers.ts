/**
 * Controller de Dashboard para ALUNO_CANDIDATO
 */

import { Request, Response } from 'express';
import { candidatoDashboardService } from './services';

export const CandidatoDashboardController = {
  getDashboard: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id;
      if (!usuarioId) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const dashboard = await candidatoDashboardService.getDashboard(String(usuarioId));
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'DASHBOARD_ERROR',
        message: error?.message || 'Erro ao buscar dashboard do candidato',
      });
    }
  },
};

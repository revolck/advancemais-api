import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { metricasService } from '../services/metricas.service';

const metricasControllerLogger = logger.child({ module: 'MetricasController' });

export class MetricasController {
  /**
   * Retorna métricas consolidadas para o dashboard do Setor de Vagas
   */
  static getMetricas = async (_req: Request, res: Response) => {
    try {
      const result = await metricasService.getMetricas();
      res.json(result);
    } catch (error) {
      metricasControllerLogger.error({ err: error }, 'Erro ao buscar métricas');
      res.status(500).json({
        success: false,
        code: 'METRICAS_ERROR',
        message: 'Erro ao buscar métricas',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };
}

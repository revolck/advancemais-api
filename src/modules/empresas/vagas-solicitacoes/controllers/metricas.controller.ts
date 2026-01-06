import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { metricasService } from '../services/metricas.service';
import { Roles } from '@prisma/client';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';
import { prisma } from '@/config/prisma';

const metricasControllerLogger = logger.child({ module: 'MetricasController' });

export class MetricasController {
  /**
   * Retorna métricas consolidadas para o dashboard do Setor de Vagas
   */
  static getMetricas = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { id?: string; role?: Roles } | undefined;
      const isRecruiter = user?.role === Roles.RECRUTADOR;

      if (isRecruiter && !user?.id) {
        return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      }

      const vagaIds = isRecruiter
        ? await recrutadorVagasService.listVagaIds(String(user.id))
        : undefined;

      if (isRecruiter && vagaIds && vagaIds.length === 0) {
        return res.json({
          metricasGerais: {
            totalEmpresas: 0,
            empresasAtivas: 0,
            totalVagas: 0,
            vagasAbertas: 0,
            vagasPendentes: 0,
            vagasEncerradas: 0,
            totalCandidatos: 0,
            candidatosEmProcesso: 0,
            candidatosContratados: 0,
            solicitacoesPendentes: 0,
            solicitacoesAprovadasHoje: 0,
            solicitacoesRejeitadasHoje: 0,
          },
        });
      }

      const empresaUsuarioIds = isRecruiter
        ? await prisma.empresasVagas
            .findMany({
              where: { id: { in: vagaIds! } },
              distinct: ['usuarioId'],
              select: { usuarioId: true },
            })
            .then((rows) => rows.map((row) => row.usuarioId))
        : undefined;

      const result = await metricasService.getMetricas({ empresaUsuarioIds, vagaIds });
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

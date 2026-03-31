import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { ZodError } from 'zod';

import { entrevistasOverviewService } from '../services/overview.service';
import { entrevistasOverviewQuerySchema } from '../validators/overview.schema';

export const entrevistasOverviewController = {
  async list(req: Request, res: Response) {
    try {
      const viewerId = req.user?.id as string | undefined;
      const viewerRole = req.user?.role as Roles | undefined;

      if (!viewerId || !viewerRole) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
      }

      const filters = entrevistasOverviewQuerySchema.parse(req.query);
      const result = await entrevistasOverviewService.list({
        ...filters,
        viewerId,
        viewerRole,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'INTERVIEWS_INVALID_FILTERS',
          message: 'Os filtros informados para a listagem de entrevistas são inválidos.',
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      if (error?.status === 403 || error?.code === 'INSUFFICIENT_PERMISSIONS') {
        return res.status(403).json({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Sem permissão para acessar as entrevistas.',
        });
      }

      return res.status(500).json({
        success: false,
        code: 'INTERVIEWS_OVERVIEW_ERROR',
        message: 'Não foi possível carregar a listagem de entrevistas.',
      });
    }
  },
};

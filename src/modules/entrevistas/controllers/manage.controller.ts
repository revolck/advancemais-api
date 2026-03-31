import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { ZodError } from 'zod';

import { entrevistasManageService } from '../services/manage.service';
import {
  createEntrevistaSchema,
  entrevistasOpcoesCandidatosQuerySchema,
  entrevistasOpcoesVagasQuerySchema,
} from '../validators/overview.schema';

const getViewer = (req: Request) => ({
  viewerId: req.user?.id as string | undefined,
  viewerRole: req.user?.role as Roles | undefined,
});

const getForbiddenResponse = () => ({
  success: false,
  code: 'INSUFFICIENT_PERMISSIONS',
  message: 'Sem permissão para criar entrevistas.',
});

const handleCommonError = (res: Response, error: any, options?: { invalidCode?: string }) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      code: options?.invalidCode ?? 'INTERVIEWS_INVALID_FILTERS',
      message:
        options?.invalidCode === 'INTERVIEW_INVALID_PAYLOAD'
          ? 'Os dados informados para criar a entrevista são inválidos.'
          : 'Os filtros informados para entrevistas são inválidos.',
      errors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (error?.status === 403 || error?.code === 'INSUFFICIENT_PERMISSIONS') {
    return res.status(403).json(getForbiddenResponse());
  }

  if (error?.status === 404) {
    return res.status(404).json({
      success: false,
      code: error.code ?? 'NOT_FOUND',
      message: error.message ?? 'Recurso não encontrado.',
    });
  }

  if (error?.status === 409) {
    return res.status(409).json({
      success: false,
      code: error.code ?? 'CONFLICT',
      message: error.message ?? 'Conflito ao processar entrevista.',
    });
  }

  if (error?.status === 400) {
    return res.status(400).json({
      success: false,
      code: error.code ?? options?.invalidCode ?? 'INTERVIEW_INVALID_PAYLOAD',
      message: error.message ?? 'Os dados informados para entrevistas são inválidos.',
    });
  }

  return res.status(500).json({
    success: false,
    code: error?.code ?? 'INTERVIEW_CREATE_ERROR',
    message: error?.message ?? 'Não foi possível processar a solicitação de entrevistas.',
  });
};

export const entrevistasManageController = {
  async listEmpresas(req: Request, res: Response) {
    try {
      const { viewerId, viewerRole } = getViewer(req);

      if (!viewerId || !viewerRole) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
      }

      const result = await entrevistasManageService.listEmpresas({ viewerId, viewerRole });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleCommonError(res, error);
    }
  },

  async listVagas(req: Request, res: Response) {
    try {
      const { viewerId, viewerRole } = getViewer(req);

      if (!viewerId || !viewerRole) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
      }

      const query = entrevistasOpcoesVagasQuerySchema.parse(req.query);
      const result = await entrevistasManageService.listVagas({
        ...query,
        viewerId,
        viewerRole,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleCommonError(res, error);
    }
  },

  async listCandidatos(req: Request, res: Response) {
    try {
      const { viewerId, viewerRole } = getViewer(req);

      if (!viewerId || !viewerRole) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
      }

      const query = entrevistasOpcoesCandidatosQuerySchema.parse(req.query);
      const result = await entrevistasManageService.listCandidatos({
        ...query,
        viewerId,
        viewerRole,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleCommonError(res, error);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { viewerId, viewerRole } = getViewer(req);

      if (!viewerId || !viewerRole) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        });
      }

      const payload = createEntrevistaSchema.parse(req.body);
      const result = await entrevistasManageService.create({
        ...payload,
        viewerId,
        viewerRole,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return handleCommonError(res, error, { invalidCode: 'INTERVIEW_INVALID_PAYLOAD' });
    }
  },
};

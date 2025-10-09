import { Request, Response } from 'express';
import { Roles } from '@prisma/client';
import { ZodError } from 'zod';

import { candidaturasService } from './services';
import { candidaturasOverviewService } from './services/overview.service';
import { candidaturasOverviewQuerySchema } from './validators/overview.schema';

export const CandidaturasController = {
  listMine: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.query.usuarioId;
      if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const { vagaId, status } = req.query as any;
      const statusList = Array.isArray(status) ? status : status ? [status] : [];
      const items = await candidaturasService.listMine({
        usuarioId: String(usuarioId),
        vagaId: vagaId as string | undefined,
        status: statusList as any,
      });
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ success: false, code: 'LIST_MINE_ERROR', message: error?.message });
    }
  },

  listReceived: async (req: Request, res: Response) => {
    try {
      const empresaUsuarioId = (req as any).user?.id || req.query.empresaUsuarioId;
      if (!empresaUsuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const { vagaId, status } = req.query as any;
      const statusList = Array.isArray(status) ? status : status ? [status] : [];
      const items = await candidaturasService.listReceived({
        empresaUsuarioId: String(empresaUsuarioId),
        vagaId: vagaId as string | undefined,
        status: statusList as any,
      });
      res.json(items);
    } catch (error: any) {
      res
        .status(500)
        .json({ success: false, code: 'LIST_RECEIVED_ERROR', message: error?.message });
    }
  },
  overview: async (req: Request, res: Response) => {
    const user = (req as any).user;
    const allowedRoles = [
      Roles.EMPRESA,
      Roles.ADMIN,
      Roles.MODERADOR,
      Roles.RECRUTADOR,
      Roles.PSICOLOGO,
    ];

    if (!user?.id || !user?.role) {
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    }

    const viewerRole = user.role as Roles;

    if (!allowedRoles.includes(viewerRole)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN' });
    }

    try {
      const query = candidaturasOverviewQuerySchema.parse(req.query);

      const result = await candidaturasOverviewService.list({
        ...query,
        viewerId: String(user.id),
        viewerRole,
      });

      return res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros inválidos para listar o overview de candidaturas',
          issues: error.flatten().fieldErrors,
        });
      }

      return res.status(500).json({
        success: false,
        code: 'CANDIDATURAS_OVERVIEW_ERROR',
        message: error instanceof Error ? error.message : 'Erro ao gerar overview de candidaturas',
      });
    }
  },
  apply: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.body.usuarioId;
      const role: Roles = (req as any).user?.role || Roles.ALUNO_CANDIDATO;
      const { vagaId, curriculoId, consentimentos } = req.body as any;
      if (!usuarioId || !vagaId || !curriculoId)
        return res.status(400).json({ success: false, code: 'VALIDATION_ERROR' });
      const created = await candidaturasService.apply({
        usuarioId: String(usuarioId),
        role,
        vagaId,
        curriculoId,
        consentimentos,
      });
      res.status(201).json({ success: true, candidatura: created });
    } catch (error: any) {
      if (error?.code === 'FORBIDDEN')
        return res.status(403).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'CURRICULO_INVALIDO')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'VAGA_NOT_FOUND')
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'VAGA_LIMIT_CANDIDATURAS')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      res.status(500).json({ success: false, code: 'APPLY_ERROR', message: error?.message });
    }
  },
};

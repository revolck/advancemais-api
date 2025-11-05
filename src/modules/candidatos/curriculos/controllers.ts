import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { curriculosService } from './services';
import { curriculoCreateSchema, curriculoUpdateSchema } from './validators';
import { Roles } from '@prisma/client';

export const CurriculosController = {
  list: async (req: Request, res: Response) => {
    const usuarioId = (req as any).user?.id || req.query.usuarioId;
    if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const items = await curriculosService.listOwn(String(usuarioId));
    res.json(items);
  },

  get: async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const curriculoId = req.params.id;

    // Admin/Moderador podem ver qualquer currículo
    if (userRole === Roles.ADMIN || userRole === Roles.MODERADOR) {
      const item = await curriculosService.findById(curriculoId);
      if (!item) return res.status(404).json({ success: false, code: 'NOT_FOUND' });
      return res.json(item);
    }

    // Candidato só pode ver seus próprios currículos
    const usuarioId = userId || req.query.usuarioId;
    if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const item = await curriculosService.getOwn(String(usuarioId), curriculoId);
    if (!item) return res.status(404).json({ success: false, code: 'NOT_FOUND' });
    res.json(item);
  },

  create: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.body.usuarioId;
      const role: Roles = (req as any).user?.role || Roles.ALUNO_CANDIDATO;
      if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const payload = curriculoCreateSchema.parse(req.body);
      const created = await curriculosService.create(String(usuarioId), role, payload);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      if (error?.code === 'CURRICULO_LIMIT')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'FORBIDDEN')
        return res.status(403).json({ success: false, code: error.code, message: error.message });
      res.status(500).json({ success: false, code: 'CREATE_ERROR', message: error?.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.body.usuarioId;
      if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      const payload = curriculoUpdateSchema.parse(req.body);
      const updated = await curriculosService.update(String(usuarioId), req.params.id, payload);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError)
        return res
          .status(400)
          .json({ success: false, code: 'VALIDATION_ERROR', issues: error.flatten().fieldErrors });
      if (error?.code === 'NOT_FOUND')
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      if (error?.code === 'CURRICULO_PRINCIPAL_REQUIRED')
        return res.status(400).json({ success: false, code: error.code, message: error.message });
      res.status(500).json({ success: false, code: 'UPDATE_ERROR', message: error?.message });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).user?.id || req.query.usuarioId;
      if (!usuarioId) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
      await curriculosService.remove(String(usuarioId), req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND')
        return res.status(404).json({ success: false, code: error.code, message: error.message });
      res.status(500).json({ success: false, code: 'DELETE_ERROR', message: error?.message });
    }
  },
};

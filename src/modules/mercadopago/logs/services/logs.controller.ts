import { Request, Response } from 'express';
import { prisma } from '@/config/prisma';

export const logsController = {
  list: async (req: Request, res: Response) => {
    try {
      const isAdmin = ['ADMIN', 'MODERADOR'].includes((req.user as any)?.role);
      const { usuarioId, empresasPlanoId, tipo, page, pageSize, startDate, endDate } =
        req.query as any;
      const where: any = {};
      if (usuarioId && isAdmin) where.usuarioId = usuarioId;
      if (!isAdmin) where.usuarioId = (req.user as any)?.id;
      if (empresasPlanoId) where.empresasPlanoId = empresasPlanoId;
      if (tipo) where.tipo = tipo;
      const range: any = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          range.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          range.lte = end;
        }
      }
      if (Object.keys(range).length > 0) {
        where.criadoEm = range;
      }
      const take = pageSize ? Math.min(100, Math.max(1, parseInt(pageSize))) : 20;
      const skip = page ? (Math.max(1, parseInt(page)) - 1) * take : 0;
      const [items, total] = await Promise.all([
        prisma.logsPagamentosDeAssinaturas.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          take,
          skip,
        }),
        prisma.logsPagamentosDeAssinaturas.count({ where }),
      ]);
      res.json({ items, total, page: page ? parseInt(page) : 1, pageSize: take });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'LOGS_LIST_ERROR',
        message: 'Erro ao listar logs',
        error: error?.message,
      });
    }
  },
  get: async (req: Request, res: Response) => {
    try {
      const isAdmin = ['ADMIN', 'MODERADOR'].includes((req.user as any)?.role);
      const item = await prisma.logsPagamentosDeAssinaturas.findUnique({
        where: { id: req.params.id },
      });
      if (!item) return res.status(404).json({ success: false, code: 'LOG_NOT_FOUND' });
      if (!isAdmin && item.usuarioId !== (req.user as any)?.id) {
        return res.status(403).json({ success: false, code: 'FORBIDDEN' });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        code: 'LOGS_GET_ERROR',
        message: 'Erro ao obter log',
        error: error?.message,
      });
    }
  },
};

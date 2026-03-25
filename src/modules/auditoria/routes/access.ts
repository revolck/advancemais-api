import type { NextFunction, Request, Response } from 'express';
import { Roles } from '@prisma/client';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

const auditoriaAdminRoles: Roles[] = [Roles.ADMIN];

const requireAuditoriaAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.role || !auditoriaAdminRoles.includes(req.user.role as Roles)) {
    return res.status(403).json({
      success: false,
      code: 'AUDITORIA_ACCESS_DENIED',
      message: 'Sem permissão para acessar os dados de auditoria.',
    });
  }

  return next();
};

export const auditoriaAdminOnlyMiddleware = [
  supabaseAuthMiddleware(),
  requireAuditoriaAdminAccess,
] as const;

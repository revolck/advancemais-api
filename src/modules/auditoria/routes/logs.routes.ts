import { Router } from 'express';
import { Roles } from '@prisma/client';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

import { logsController } from '../controllers/logs.controller';

const logsRoutes = Router();
const auditDashboardRoles: Roles[] = [Roles.ADMIN, Roles.MODERADOR];

logsRoutes.use(supabaseAuthMiddleware());
logsRoutes.use((req, res, next) => {
  if (!req.user?.role || !auditDashboardRoles.includes(req.user.role as Roles)) {
    return res.status(403).json({
      success: false,
      code: 'AUDITORIA_ACCESS_DENIED',
      message: 'Sem permissão para acessar o histórico de auditoria.',
    });
  }

  return next();
});

logsRoutes.get('/', logsController.list);
logsRoutes.get('/:id', logsController.get);

export { logsRoutes };

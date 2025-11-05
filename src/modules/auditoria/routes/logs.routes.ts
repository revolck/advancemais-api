import { Router } from 'express';
import { logsController } from '../controllers/logs.controller';
import { authMiddleware } from '@/modules/usuarios/middlewares/auth-middleware';

const logsRoutes = Router();

// Aplicar middleware de autenticação em todas as rotas
logsRoutes.use(authMiddleware);

// Aplicar middleware de permissões para auditoria

// Rotas para logs de auditoria
logsRoutes.get('/', logsController.list);
logsRoutes.get('/:id', logsController.get);

export { logsRoutes };

import { Router } from 'express';
import { scriptsController } from '../controllers/scripts.controller';
import { authMiddleware } from '@/modules/usuarios/middlewares/auth-middleware';

const scriptsRoutes = Router();

// Aplicar middleware de autenticação em todas as rotas
scriptsRoutes.use(authMiddleware);

// Aplicar middleware de permissões para auditoria

// Rotas para scripts de auditoria
scriptsRoutes.get('/', scriptsController.list);
scriptsRoutes.get('/:id', scriptsController.get);

export { scriptsRoutes };

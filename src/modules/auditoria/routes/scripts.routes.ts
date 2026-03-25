import { Router } from 'express';
import { auditoriaAdminOnlyMiddleware } from './access';
import { scriptsController } from '../controllers/scripts.controller';

const scriptsRoutes = Router();

scriptsRoutes.use(...auditoriaAdminOnlyMiddleware);

// Rotas para scripts de auditoria
scriptsRoutes.get('/', scriptsController.list);
scriptsRoutes.get('/:id', scriptsController.get);

export { scriptsRoutes };

import { Router } from 'express';
import { auditoriaAdminOnlyMiddleware } from './access';
import { assinaturasController } from '../controllers/assinaturas.controller';

const assinaturasRoutes = Router();

assinaturasRoutes.use(...auditoriaAdminOnlyMiddleware);

// Rotas para auditoria de assinaturas
assinaturasRoutes.get('/', assinaturasController.list);
assinaturasRoutes.get('/:id', assinaturasController.get);

export { assinaturasRoutes };

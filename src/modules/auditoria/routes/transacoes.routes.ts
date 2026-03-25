import { Router } from 'express';
import { auditoriaAdminOnlyMiddleware } from './access';
import { transacoesController } from '../controllers/transacoes.controller';

const transacoesRoutes = Router();

transacoesRoutes.use(...auditoriaAdminOnlyMiddleware);

// Rotas para transações de auditoria
transacoesRoutes.get('/', transacoesController.list);
transacoesRoutes.get('/:id', transacoesController.get);

export { transacoesRoutes };

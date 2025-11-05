import { Router } from 'express';
import { transacoesController } from '../controllers/transacoes.controller';
import { authMiddleware } from '@/modules/usuarios/middlewares/auth-middleware';

const transacoesRoutes = Router();

// Aplicar middleware de autenticação em todas as rotas
transacoesRoutes.use(authMiddleware);

// Aplicar middleware de permissões para auditoria

// Rotas para transações de auditoria
transacoesRoutes.get('/', transacoesController.list);
transacoesRoutes.get('/:id', transacoesController.get);

export { transacoesRoutes };

import { Router } from 'express';
import { assinaturasController } from '../controllers/assinaturas.controller';
import { authMiddleware } from '@/modules/usuarios/middlewares/auth-middleware';

const assinaturasRoutes = Router();

// Aplicar middleware de autenticação em todas as rotas
assinaturasRoutes.use(authMiddleware);

// Aplicar middleware de permissões para auditoria

// Rotas para auditoria de assinaturas
assinaturasRoutes.get('/', assinaturasController.list);
assinaturasRoutes.get('/:id', assinaturasController.get);

export { assinaturasRoutes };

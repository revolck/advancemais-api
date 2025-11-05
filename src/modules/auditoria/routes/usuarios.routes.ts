import { Router } from 'express';
import { usuariosController } from '../controllers/usuarios.controller';
import { authMiddleware } from '@/modules/usuarios/middlewares/auth-middleware';

const usuariosRoutes = Router();

// Aplicar middleware de autenticação em todas as rotas
usuariosRoutes.use(authMiddleware);

// Aplicar middleware de permissões para auditoria

// Rotas para histórico de usuários
usuariosRoutes.get('/:usuarioId/historico', usuariosController.listUserHistory);

export { usuariosRoutes };

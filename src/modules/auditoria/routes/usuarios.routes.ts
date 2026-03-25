import { Router } from 'express';
import { auditoriaAdminOnlyMiddleware } from './access';
import { usuariosController } from '../controllers/usuarios.controller';

const usuariosRoutes = Router();

usuariosRoutes.use(...auditoriaAdminOnlyMiddleware);

// Rotas para histórico de usuários
usuariosRoutes.get('/:usuarioId/historico', usuariosController.listUserHistory);

export { usuariosRoutes };

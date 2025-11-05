/**
 * Rotas para histórico de usuários
 * @module auditoria/routes/usuarios
 */

import { Router } from 'express';
import { usuariosController } from '../controllers/usuarios.controller';

const router = Router();

// Histórico completo do usuário
router.get('/:usuarioId/historico', usuariosController.getHistorico);

// Histórico de login
router.get('/:usuarioId/login', usuariosController.getLogin);

// Histórico de alterações de perfil
router.get('/:usuarioId/perfil', usuariosController.getPerfil);

// Histórico de ações
router.get('/:usuarioId/acoes', usuariosController.getAcoes);

// Histórico de acessos
router.get('/:usuarioId/acessos', usuariosController.getAcessos);

// Estatísticas do usuário
router.get('/:usuarioId/estatisticas', usuariosController.getEstatisticas);

// Resumo de atividade
router.get('/:usuarioId/resumo', usuariosController.getResumo);

export { router as usuariosRoutes };

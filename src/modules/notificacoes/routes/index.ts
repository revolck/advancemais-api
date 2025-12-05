import { Router } from 'express';
import { NotificacoesController } from '../controllers/notificacoes.controller';
import { supabaseAuthMiddleware } from '../../usuarios/auth/supabase-middleware';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(supabaseAuthMiddleware());

/**
 * @route GET /api/v1/notificacoes
 * @desc Lista notificações do usuário autenticado
 * @access Autenticado
 */
router.get('/', asyncHandler(NotificacoesController.list));

/**
 * @route GET /api/v1/notificacoes/contador
 * @desc Retorna contador de notificações não lidas
 * @access Autenticado
 */
router.get('/contador', asyncHandler(NotificacoesController.contador));

/**
 * @route PUT /api/v1/notificacoes/lidas
 * @desc Marca notificações específicas como lidas
 * @access Autenticado
 */
router.put('/lidas', asyncHandler(NotificacoesController.marcarComoLida));

/**
 * @route PUT /api/v1/notificacoes/lidas/todas
 * @desc Marca todas as notificações como lidas
 * @access Autenticado
 */
router.put('/lidas/todas', asyncHandler(NotificacoesController.marcarTodasComoLidas));

/**
 * @route PUT /api/v1/notificacoes/arquivar
 * @desc Arquiva notificações específicas
 * @access Autenticado
 */
router.put('/arquivar', asyncHandler(NotificacoesController.arquivar));

export { router as notificacoesRoutes };


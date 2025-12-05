import { Router } from 'express';
import { RequerimentosController } from '../controllers/requerimentos.controller';
import { supabaseAuthMiddleware } from '../../usuarios/auth/supabase-middleware';
import { asyncHandler } from '../../../utils/asyncHandler';

const router = Router();

// Todas as rotas requerem autenticação
router.use(supabaseAuthMiddleware());

// =====================================
// ROTAS DO USUÁRIO
// =====================================

// Listar requerimentos do usuário
router.get('/', asyncHandler(RequerimentosController.listar));

// Criar novo requerimento
router.post('/', asyncHandler(RequerimentosController.criar));

// Solicitar reembolso (direito de arrependimento - 7 dias)
router.post('/reembolso', asyncHandler(RequerimentosController.solicitarReembolso));

// Verificar elegibilidade para reembolso
router.get('/elegibilidade-reembolso/:planoId', asyncHandler(RequerimentosController.verificarElegibilidadeReembolso));

// Obter requerimento por ID
router.get('/:id', asyncHandler(RequerimentosController.obterPorId));

// Adicionar comentário ao requerimento
router.post('/:id/comentario', asyncHandler(RequerimentosController.adicionarComentario));

// Cancelar requerimento
router.put('/:id/cancelar', asyncHandler(RequerimentosController.cancelar));

// =====================================
// ROTAS DE ADMIN
// =====================================

// Listar todos os requerimentos (admin)
router.get('/admin/lista', asyncHandler(RequerimentosController.listarAdmin));

// Métricas de requerimentos (admin)
router.get('/admin/metricas', asyncHandler(RequerimentosController.metricas));

// Atualizar requerimento (admin)
router.put('/:id/admin', asyncHandler(RequerimentosController.atualizarAdmin));

export const requerimentosRoutes = router;


/**
 * Rotas para transações de auditoria
 * @module auditoria/routes/transacoes
 */

import { Router } from 'express';
import { transacoesController } from '../controllers/transacoes.controller';

const router = Router();

// Middleware de permissão para todas as rotas

// Listar transações
router.get('/', transacoesController.list);

// Obter transação específica
router.get('/:id', transacoesController.get);

// Transações por usuário
router.get('/usuario/:usuarioId', transacoesController.getByUsuario);

// Transações por empresa
router.get('/empresa/:empresaId', transacoesController.getByEmpresa);

// Estatísticas
router.get('/estatisticas', transacoesController.getEstatisticas);

// Resumo financeiro
router.get('/resumo', transacoesController.getResumo);

// Middleware de permissão para operações de escrita

// Registrar transação
router.post('/', transacoesController.create);

// Atualizar status da transação
router.patch('/:id/status', transacoesController.updateStatus);

export { router as transacoesRoutes };

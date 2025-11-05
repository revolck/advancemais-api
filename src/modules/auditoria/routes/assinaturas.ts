/**
 * Rotas para assinaturas de auditoria
 * @module auditoria/routes/assinaturas
 */

import { Router } from 'express';
import { assinaturasController } from '../controllers/assinaturas.controller';

const router = Router();

// Middleware de permissão para todas as rotas

// Logs de assinaturas
router.get('/logs', assinaturasController.getLogs);

// Logs de pagamentos
router.get('/pagamentos', assinaturasController.getPagamentos);

// Logs de planos
router.get('/planos', assinaturasController.getPlanos);

// Estatísticas
router.get('/estatisticas', assinaturasController.getEstatisticas);

// Resumo
router.get('/resumo', assinaturasController.getResumo);

export { router as assinaturasRoutes };

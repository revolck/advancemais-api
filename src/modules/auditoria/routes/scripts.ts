/**
 * Rotas para scripts de auditoria
 * @module auditoria/routes/scripts
 */

import { Router } from 'express';
import { scriptsController } from '../controllers/scripts.controller';

const router = Router();

// Middleware de permissão para todas as rotas

// Listar scripts
router.get('/', scriptsController.list);

// Obter script específico
router.get('/:id', scriptsController.get);

// Estatísticas
router.get('/estatisticas', scriptsController.getEstatisticas);

// Middleware de permissão para operações de escrita

// Registrar script
router.post('/', scriptsController.create);

// Executar script
router.post('/:id/executar', scriptsController.executar);

// Cancelar script
router.post('/:id/cancelar', scriptsController.cancelar);

export { router as scriptsRoutes };

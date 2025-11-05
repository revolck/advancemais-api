/**
 * Rotas para logs de auditoria
 * @module auditoria/routes/logs
 */

import { Router } from 'express';
import { logsController } from '../controllers/logs.controller';

const router = Router();

// Middleware de permissão para todas as rotas

// Listar logs
router.get('/', logsController.list);

// Obter log específico
router.get('/:id', logsController.get);

// Logs por usuário
router.get('/usuario/:usuarioId', logsController.getByUsuario);

// Logs por entidade
router.get('/entidade/:entidadeId', logsController.getByEntidade);

// Logs de erro
router.get('/erro', logsController.getErros);

// Logs de acesso
router.get('/acesso', logsController.getAcessos);

// Logs de alteração
router.get('/alteracao', logsController.getAlteracoes);

// Estatísticas
router.get('/estatisticas', logsController.getEstatisticas);

// Exportar logs
router.get('/exportar', logsController.exportar);

export { router as logsRoutes };

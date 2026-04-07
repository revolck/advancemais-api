import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { instrutorOverviewController } from '../controllers/overview.controller';

const router = Router();

router.use(supabaseAuthMiddleware([Roles.INSTRUTOR]));

/**
 * @openapi
 * /api/v1/instrutor/overview:
 *   get:
 *     summary: Visão geral escopada do instrutor
 *     tags: [Instrutor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visão geral carregada com sucesso
 *       401:
 *         description: Token inválido ou ausente
 *       403:
 *         description: Acesso negado
 *       500:
 *         description: Erro ao carregar visão geral do instrutor
 */
router.get('/overview', instrutorOverviewController.get);

export { router as instrutorRoutes };

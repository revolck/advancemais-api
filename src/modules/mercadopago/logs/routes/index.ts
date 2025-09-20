import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { logsController } from '../services/logs.controller';

const router = Router();
const empresaRoles = [Roles.ADMIN, Roles.MODERADOR, Roles.EMPRESA, Roles.RECRUTADOR];

/**
 * @openapi
 * /api/v1/mercadopago/logs:
 *   get:
 *     summary: Listar logs de pagamentos/assinaturas
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: usuarioId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: empresasPlanoId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: tipo
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, example: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, example: 20 }
 *     responses:
 *       200:
 *         description: Lista de logs
 */
router.get('/', supabaseAuthMiddleware(empresaRoles), logsController.list);

/**
 * @openapi
 * /api/v1/mercadopago/logs/{id}:
 *   get:
 *     summary: Obter log por ID
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Log encontrado
 */
router.get('/:id', supabaseAuthMiddleware(empresaRoles), logsController.get);

export { router as logsRoutes };


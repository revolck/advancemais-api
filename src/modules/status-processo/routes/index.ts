import { Router } from 'express';
import { StatusProcessoController } from '../controllers/status-processo.controller';
import {
  validate,
  statusProcessoFiltersSchema,
  createStatusProcessoSchema,
  updateStatusProcessoSchema,
  statusProcessoIdSchema,
} from '../validators/status-processo.schema';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

const router = Router();
const statusProcessoController = new StatusProcessoController();

// Middleware de timeout para evitar loops infinitos
const timeoutMiddleware = (timeoutMs: number = 10000) => {
  return (req: any, res: any, next: any) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Timeout: A requisição demorou muito para processar.',
          code: 'REQUEST_TIMEOUT',
        });
      }
    }, timeoutMs);

    // Limpa o timeout quando a resposta é enviada
    const originalSend = res.send;
    res.send = function (data: any) {
      clearTimeout(timeout);
      return originalSend.call(this, data);
    };

    next();
  };
};

// Middleware de autenticação simples e rápido
const quickAuthMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token de autorização necessário',
      code: 'MISSING_TOKEN',
    });
  }

  // Se há token, usa o middleware completo
  return supabaseAuthMiddleware()(req, res, next);
};

// Middleware de autenticação para todas as rotas com timeout
router.use(timeoutMiddleware(5000)); // Reduzido para 5 segundos
router.use(quickAuthMiddleware);

// Middleware de autorização para ADMIN e MODERADOR
router.use((req, res, next) => {
  const userRole = (req as any).user?.role;
  if (!['ADMIN', 'MODERADOR'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message:
        'Acesso negado. Apenas administradores e moderadores podem gerenciar status de processo.',
      code: 'INSUFFICIENT_PERMISSIONS',
      requiredRoles: ['ADMIN', 'MODERADOR'],
      userRole: userRole || 'NÃO_DEFINIDO',
      correlationId: (req as any).id,
      timestamp: new Date().toISOString(),
    });
  }
  next();
});

/**
 * @swagger
 * /api/v1/status-processo:
 *   get:
 *     summary: Listar status de processo
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ativo
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo/inativo
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome, código ou descrição
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Tamanho da página
 *     responses:
 *       200:
 *         description: Lista de status retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusProcessoListResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/',
  validate(statusProcessoFiltersSchema),
  statusProcessoController.list.bind(statusProcessoController),
);

/**
 * @swagger
 * /api/v1/status-processo:
 *   post:
 *     summary: Criar novo status de processo
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStatusProcessoInput'
 *     responses:
 *       201:
 *         description: Status criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusProcessoResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  '/',
  validate(createStatusProcessoSchema),
  statusProcessoController.create.bind(statusProcessoController),
);

/**
 * @swagger
 * /api/v1/status-processo/default:
 *   get:
 *     summary: Obter status padrão
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status padrão retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusProcessoResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/default', statusProcessoController.getDefault.bind(statusProcessoController));

/**
 * @swagger
 * /api/v1/status-processo/active:
 *   get:
 *     summary: Listar todos os status ativos
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de status ativos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StatusProcessoResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/active', statusProcessoController.getAllActive.bind(statusProcessoController));

/**
 * @swagger
 * /api/v1/status-processo/{id}:
 *   get:
 *     summary: Buscar status por ID
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do status
 *     responses:
 *       200:
 *         description: Status retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusProcessoResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  '/:id',
  validate(statusProcessoIdSchema),
  statusProcessoController.getById.bind(statusProcessoController),
);

/**
 * @swagger
 * /api/v1/status-processo/{id}:
 *   put:
 *     summary: Atualizar status de processo
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do status
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStatusProcessoInput'
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatusProcessoResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  '/:id',
  validate(updateStatusProcessoSchema),
  statusProcessoController.update.bind(statusProcessoController),
);

/**
 * @swagger
 * /api/v1/status-processo/{id}:
 *   delete:
 *     summary: Remover status de processo
 *     tags: [Status Processo]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do status
 *     responses:
 *       200:
 *         description: Status removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Status removido com sucesso.
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  '/:id',
  validate(statusProcessoIdSchema),
  statusProcessoController.delete.bind(statusProcessoController),
);

export { router as statusProcessoRoutes };

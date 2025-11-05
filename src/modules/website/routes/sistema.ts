import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { SistemaController } from '../controllers/sistema.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/website/sistema:
 *   get:
 *     summary: Listar conteúdos "Sistema"
 *     tags: [Website]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteSistema'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/sistema"
 */
router.get('/', publicCache, SistemaController.list);

/**
 * @openapi
 * /api/v1/website/sistema/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conteúdo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSistema'
 *       404:
 *         description: Conteúdo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/sistema/{id}"
 */
router.get('/:id', publicCache, SistemaController.get);

/**
 * @openapi
 * /api/v1/website/sistema:
 *   post:
 *     summary: Criar conteúdo "Sistema"
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteSistemaCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSistema'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/sistema" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"T","descricao":"D","subtitulo":"S","etapa1Titulo":"E1","etapa1Descricao":"D1","etapa2Titulo":"E2","etapa2Descricao":"D2","etapa3Titulo":"E3","etapa3Descricao":"D3"}'
 */
router.post('/', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), SistemaController.create);

/**
 * @openapi
 * /api/v1/website/sistema/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Sistema"
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteSistemaUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSistema'
 *       404:
 *         description: Conteúdo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/sistema/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"Atual"}'
 */
router.put('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), SistemaController.update);

/**
 * @openapi
 * /api/v1/website/sistema/{id}:
 *   delete:
 *     summary: Remover conteúdo "Sistema"
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Conteúdo removido
 *       404:
 *         description: Conteúdo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/website/sistema/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), SistemaController.remove);

export { router as sistemaRoutes };

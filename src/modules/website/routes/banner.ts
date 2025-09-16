import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import multer from 'multer';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { BannerController } from '../controllers/banner.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/banner:
 *   get:
 *     summary: Listar banners
 *     tags: [Website - Banner]
 *     responses:
 *       200:
 *         description: Lista de banners
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteBanner'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/banner"
 */
router.get('/', publicCache, BannerController.list);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   get:
 *     summary: Obter banner por ID da ordem
 *     tags: [Website - Banner]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do banner
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Banner encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBanner'
 *       404:
 *         description: Banner não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/banner/{ordemId}"
 */
router.get('/:id', publicCache, BannerController.get);

/**
 * @openapi
 * /api/v1/website/banner:
 *   post:
 *     summary: Criar banner
 *     tags: [Website - Banner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteBannerCreateInput'
 *     responses:
 *       201:
 *         description: Banner criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBanner'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/banner" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@banner.png" \\
 *            -F "link=https://example.com" \\
 *            -F "status=true"
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  BannerController.create,
);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   put:
 *     summary: Atualizar banner
 *     tags: [Website - Banner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID do banner
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteBannerUpdateInput'
 *     responses:
 *       200:
 *         description: Banner atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBanner'
 *       404:
 *         description: Banner não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/banner/{bannerId}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "link=https://example.com" \\
 *            -F "status=false" \\
 *            -F "ordem=2"
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  BannerController.update,
);

/**
 * @openapi
 * /api/v1/website/banner/{id}/reorder:
 *   put:
 *     summary: Reordenar banner
 *     description: Altera a posição do banner utilizando o ID da ordem. Caso a nova posição esteja ocupada, os demais banners serão ajustados automaticamente.
 *     tags: [Website - Banner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do banner
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteBannerReorderInput'
 *     responses:
 *       200:
 *         description: Banner reordenado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBanner'
 *       404:
 *         description: Banner não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/banner/{ordemId}/reorder" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"ordem":2}'
 */
router.put(
  '/:id/reorder',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  BannerController.reorder,
);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   delete:
 *     summary: Remover banner
 *     tags: [Website - Banner]
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
 *         description: Banner removido
 *       404:
 *         description: Banner não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/banner/{bannerId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), BannerController.remove);

export { router as bannerRoutes };

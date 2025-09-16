import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import multer from 'multer';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { ImagemLoginController } from '../controllers/imagemLogin.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/imagem-login:
 *   get:
 *     summary: Listar imagens de login
 *     tags: [Website - ImagemLogin]
 *     responses:
 *       200:
 *         description: Lista de imagens
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteImagemLogin'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/imagem-login"
 */
router.get('/', publicCache, ImagemLoginController.list);

/**
 * @openapi
 * /api/v1/website/imagem-login/{id}:
 *   get:
 *     summary: Obter imagem de login por ID
 *     tags: [Website - ImagemLogin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Imagem encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteImagemLogin'
 *       404:
 *         description: Imagem não encontrada
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
 *           curl -X GET "http://localhost:3000/api/v1/website/imagem-login/{id}"
 */
router.get('/:id', publicCache, ImagemLoginController.get);

/**
 * @openapi
 * /api/v1/website/imagem-login:
 *   post:
 *     summary: Criar imagem de login
 *     tags: [Website - ImagemLogin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteImagemLoginCreateInput'
 *     responses:
 *       201:
 *         description: Imagem criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteImagemLogin'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/imagem-login" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@login.png" \\
 *            -F "link=https://example.com"
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  ImagemLoginController.create,
);

/**
 * @openapi
 * /api/v1/website/imagem-login/{id}:
 *   put:
 *     summary: Atualizar imagem de login
 *     tags: [Website - ImagemLogin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteImagemLoginUpdateInput'
 *     responses:
 *       200:
 *         description: Imagem atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteImagemLogin'
 *       404:
 *         description: Imagem não encontrada
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/imagem-login/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "link=https://example.com" \\
 *            -F "imagem=@login.png"
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  ImagemLoginController.update,
);

/**
 * @openapi
 * /api/v1/website/imagem-login/{id}:
 *   delete:
 *     summary: Remover imagem de login
 *     tags: [Website - ImagemLogin]
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
 *         description: Imagem removida
 *       404:
 *         description: Imagem não encontrada
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/imagem-login/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), ImagemLoginController.remove);

export { router as imagemLoginRoutes };

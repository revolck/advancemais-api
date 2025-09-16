import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import multer from 'multer';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { LogoEnterpriseController } from '../controllers/logoEnterprise.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/logo-enterprises:
 *   get:
 *     summary: Listar logos de empresas
 *     tags: [Website - LogoEnterprises]
 *     responses:
 *       200:
 *         description: Lista de logos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteLogoEnterprise'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/logo-enterprises"
 */
router.get('/', publicCache, LogoEnterpriseController.list);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   get:
 *     summary: Obter logo por ID da ordem
 *     tags: [Website - LogoEnterprises]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do logo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logo encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteLogoEnterprise'
 *       404:
 *         description: Logo não encontrada
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
 *           curl -X GET "http://localhost:3000/api/v1/website/logo-enterprises/{id}"
 */
router.get('/:id', publicCache, LogoEnterpriseController.get);

/**
 * @openapi
 * /api/v1/website/logo-enterprises:
 *   post:
 *     summary: Criar logo de empresa
 *     description: Cria um novo logo. O campo `status` aceita booleano (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - LogoEnterprises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteLogoEnterpriseCreateInput'
 *     responses:
 *       201:
 *         description: Logo criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteLogoEnterprise'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/logo-enterprises" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@logo.png" \\
 *            -F "nome=Minha Empresa" \\
 *            -F "website=https://empresa.com" \\
 *            -F "status=true"
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  LogoEnterpriseController.create,
);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   put:
 *     summary: Atualizar logo de empresa
 *     description: Atualiza dados do logo utilizando o ID do logo. Permite alterar a ordem dos logos, reordenando automaticamente os demais. O campo `status` aceita booleano (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - LogoEnterprises]
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
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteLogoEnterpriseUpdateInput'
 *     responses:
 *       200:
 *         description: Logo atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteLogoEnterprise'
 *       404:
 *         description: Logo não encontrada
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/logo-enterprises/{logoId}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@logo.png" \\
 *            -F "nome=Atualizada" \\
 *            -F "website=https://empresa.com" \\
 *            -F "status=false" \\
 *            -F "ordem=2"
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  LogoEnterpriseController.update,
);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}/reorder:
 *   put:
 *     summary: Reordenar logo de empresa
 *     description: Altera a posição do logo utilizando o ID da ordem. Caso a nova posição esteja ocupada, os demais logos serão ajustados automaticamente.
 *     tags: [Website - LogoEnterprises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do logo
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteLogoEnterpriseReorderInput'
 *     responses:
 *       200:
 *         description: Logo reordenado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteLogoEnterprise'
 *       404:
 *         description: Logo não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/logo-enterprises/{ordemId}/reorder" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"ordem":2}'
 */
router.put(
  '/:id/reorder',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  LogoEnterpriseController.reorder,
);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   delete:
 *     summary: Remover logo de empresa
 *     tags: [Website - LogoEnterprises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID do logo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Logo removida
 *       404:
 *         description: Logo não encontrada
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/logo-enterprises/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  LogoEnterpriseController.remove,
);

export { router as logoEnterpriseRoutes };

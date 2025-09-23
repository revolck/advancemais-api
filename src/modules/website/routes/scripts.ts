import { Router } from 'express';

import { publicCache } from '../../../middlewares/cache-control';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { WebsiteScriptsController } from '../controllers/scripts.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/website/scripts:
 *   get:
 *     summary: Listar scripts e pixels configurados para o website
 *     tags: [Website - Scripts]
 *     parameters:
 *       - in: query
 *         name: aplicacao
 *         description: Filtro pelo contexto de uso do script
 *         schema:
 *           $ref: '#/components/schemas/WebsiteScriptAplicacao'
 *       - in: query
 *         name: orientacao
 *         description: Filtro pela área onde o script será injetado
 *         schema:
 *           $ref: '#/components/schemas/WebsiteScriptOrientation'
 *       - in: query
 *         name: status
 *         description: Filtro pelo status de publicação
 *         schema:
 *           oneOf:
 *             - $ref: '#/components/schemas/WebsiteStatus'
 *             - type: boolean
 *     responses:
 *       200:
 *         description: Lista de scripts cadastrados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteScript'
 *       400:
 *         description: Parâmetros inválidos
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
 *           curl -X GET "http://localhost:3000/api/v1/website/scripts?aplicacao=WEBSITE&orientacao=HEADER"
 */
router.get('/', publicCache, WebsiteScriptsController.list);

/**
 * @openapi
 * /api/v1/website/scripts/{id}:
 *   get:
 *     summary: Obter um script específico por ID
 *     tags: [Website - Scripts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Script localizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteScript'
 *       404:
 *         description: Script não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/scripts/{id}"
 */
router.get('/:id', publicCache, WebsiteScriptsController.get);

/**
 * @openapi
 * /api/v1/website/scripts:
 *   post:
 *     summary: Cadastrar um novo script para o website
 *     tags: [Website - Scripts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteScriptCreateInput'
 *     responses:
 *       201:
 *         description: Script criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteScript'
 *       400:
 *         description: Dados inválidos
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
 *           curl -X POST "http://localhost:3000/api/v1/website/scripts" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"nome":"Facebook Pixel","codigo":"<script>...</script>","aplicacao":"WEBSITE","orientacao":"HEADER","status":"PUBLICADO"}'
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  WebsiteScriptsController.create,
);

/**
 * @openapi
 * /api/v1/website/scripts/{id}:
 *   put:
 *     summary: Atualizar um script existente
 *     tags: [Website - Scripts]
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
 *             $ref: '#/components/schemas/WebsiteScriptUpdateInput'
 *     responses:
 *       200:
 *         description: Script atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteScript'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Script não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/scripts/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"status":false,"aplicacao":"DASHBOARD"}'
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  WebsiteScriptsController.update,
);

/**
 * @openapi
 * /api/v1/website/scripts/{id}:
 *   delete:
 *     summary: Remover um script cadastrado
 *     tags: [Website - Scripts]
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
 *         description: Script removido
 *       404:
 *         description: Script não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/scripts/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  WebsiteScriptsController.remove,
);

export { router as websiteScriptsRoutes };

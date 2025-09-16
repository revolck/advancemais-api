import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { TreinamentosInCompanyController } from '../controllers/treinamentosInCompany.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/website/treinamentos-in-company:
 *   get:
 *     summary: Listar conteúdos "TreinamentosInCompany"
 *     tags: [Website - TreinamentosInCompany]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteTreinamentosInCompany'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/treinamentos-in-company"
 */
router.get('/', publicCache, TreinamentosInCompanyController.list);

/**
 * @openapi
 * /api/v1/website/treinamentos-in-company/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - TreinamentosInCompany]
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
 *               $ref: '#/components/schemas/WebsiteTreinamentosInCompany'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/treinamentos-in-company/{id}"
 */
router.get('/:id', publicCache, TreinamentosInCompanyController.get);

/**
 * @openapi
 * /api/v1/website/treinamentos-in-company:
 *   post:
 *     summary: Criar conteúdo "TreinamentosInCompany"
 *     tags: [Website - TreinamentosInCompany]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTreinamentosInCompanyCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTreinamentosInCompany'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/treinamentos-in-company" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"Novo","icone1":"icon1","descricao1":"Desc1","icone2":"icon2","descricao2":"Desc2","icone3":"icon3","descricao3":"Desc3","icone4":"icon4","descricao4":"Desc4","icone5":"icon5","descricao5":"Desc5"}'
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  TreinamentosInCompanyController.create,
);

/**
 * @openapi
 * /api/v1/website/treinamentos-in-company/{id}:
 *   put:
 *     summary: Atualizar conteúdo "TreinamentosInCompany"
 *     tags: [Website - TreinamentosInCompany]
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
 *             $ref: '#/components/schemas/WebsiteTreinamentosInCompanyUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTreinamentosInCompany'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/treinamentos-in-company/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"Atual"}'
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  TreinamentosInCompanyController.update,
);

/**
 * @openapi
 * /api/v1/website/treinamentos-in-company/{id}:
 *   delete:
 *     summary: Remover conteúdo "TreinamentosInCompany"
 *     tags: [Website - TreinamentosInCompany]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/treinamentos-in-company/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  TreinamentosInCompanyController.remove,
);

export { router as treinamentosInCompanyRoutes };

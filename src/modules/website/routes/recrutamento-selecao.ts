import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import multer from 'multer';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { RecrutamentoSelecaoController } from '../controllers/recrutamentoSelecao.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/recrutamento-selecao:
 *   get:
 *     summary: Listar conteúdos "RecrutamentoSelecao"
 *     tags: [Website - RecrutamentoSelecao]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteRecrutamentoSelecao'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/recrutamento-selecao"
 */
router.get('/', publicCache, RecrutamentoSelecaoController.list);

/**
 * @openapi
 * /api/v1/website/recrutamento-selecao/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - RecrutamentoSelecao]
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
 *               $ref: '#/components/schemas/WebsiteRecrutamentoSelecao'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/recrutamento-selecao/{id}"
 */
router.get('/:id', publicCache, RecrutamentoSelecaoController.get);

/**
 * @openapi
 * /api/v1/website/recrutamento-selecao:
 *   post:
 *     summary: Criar conteúdo "RecrutamentoSelecao"
 *     tags: [Website - RecrutamentoSelecao]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteRecrutamentoSelecaoCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteRecrutamentoSelecao'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/recrutamento-selecao" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "imagem=@image.png" \
 *            -F "titulo=Novo" \
 *            -F "descricao=Desc"
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  RecrutamentoSelecaoController.create,
);

/**
 * @openapi
 * /api/v1/website/recrutamento-selecao/{id}:
 *   put:
 *     summary: Atualizar conteúdo "RecrutamentoSelecao"
 *     tags: [Website - RecrutamentoSelecao]
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
 *             $ref: '#/components/schemas/WebsiteRecrutamentoSelecaoUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteRecrutamentoSelecao'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/recrutamento-selecao/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "titulo=Atual" \
 *            -F "descricao=Atual"
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.single('imagem'),
  RecrutamentoSelecaoController.update,
);

/**
 * @openapi
 * /api/v1/website/recrutamento-selecao/{id}:
 *   delete:
 *     summary: Remover conteúdo "RecrutamentoSelecao"
 *     tags: [Website - RecrutamentoSelecao]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/recrutamento-selecao/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  RecrutamentoSelecaoController.remove,
);

export { router as recrutamentoSelecaoRoutes };

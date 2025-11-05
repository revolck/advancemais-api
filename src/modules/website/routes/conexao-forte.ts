import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import multer from 'multer';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { ConexaoForteController } from '../controllers/conexaoForte.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/conexao-forte:
 *   get:
 *     summary: Listar conteúdos "ConexaoForte"
 *     tags: [Website]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteConexaoForte'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/conexao-forte"
 */
router.get('/', publicCache, ConexaoForteController.list);

/**
 * @openapi
 * /api/v1/website/conexao-forte/{id}:
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
 *               $ref: '#/components/schemas/WebsiteConexaoForte'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/conexao-forte/{id}"
 */
router.get('/:id', publicCache, ConexaoForteController.get);

/**
 * @openapi
 * /api/v1/website/conexao-forte:
 *   post:
 *     summary: Criar conteúdo "ConexaoForte"
 *     tags: [Website]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteConexaoForteCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteConexaoForte'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/conexao-forte" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "imagem1=@1.png" \
 *            -F "titulo=Novo" \
 *            -F "descricao=Desc"
 */
router.post(
  '/',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.fields([
    { name: 'imagem1' },
    { name: 'imagem2' },
    { name: 'imagem3' },
    { name: 'imagem4' },
  ]),
  ConexaoForteController.create,
);

/**
 * @openapi
 * /api/v1/website/conexao-forte/{id}:
 *   put:
 *     summary: Atualizar conteúdo "ConexaoForte"
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
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteConexaoForteUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteConexaoForte'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/conexao-forte/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "titulo=Atual" \
 *            -F "descricao=Atual"
 */
router.put(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  upload.fields([
    { name: 'imagem1' },
    { name: 'imagem2' },
    { name: 'imagem3' },
    { name: 'imagem4' },
  ]),
  ConexaoForteController.update,
);

/**
 * @openapi
 * /api/v1/website/conexao-forte/{id}:
 *   delete:
 *     summary: Remover conteúdo "ConexaoForte"
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/conexao-forte/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:id',
  supabaseAuthMiddleware(['ADMIN', 'MODERADOR']),
  ConexaoForteController.remove,
);

export { router as conexaoForteRoutes };

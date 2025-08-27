import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { RecrutamentoController } from "../controllers/recrutamento.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/recrutamento:
 *   get:
 *     summary: Listar conteúdos "Recrutamento"
 *     tags: [Website - Recrutamento]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteRecrutamento'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/recrutamento"
 */
router.get("/", RecrutamentoController.list);

/**
 * @openapi
 * /api/v1/website/recrutamento/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Recrutamento]
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
 *               $ref: '#/components/schemas/WebsiteRecrutamento'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/recrutamento/{id}"
 */
router.get("/:id", RecrutamentoController.get);

/**
 * @openapi
 * /api/v1/website/recrutamento:
 *   post:
 *     summary: Criar conteúdo "Recrutamento"
 *     tags: [Website - Recrutamento]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteRecrutamentoCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteRecrutamento'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/recrutamento" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@recrutamento.png" \\
 *            -F "titulo=Novo" \\
 *            -F "descricao=Conteudo" \\
 *            -F "buttonUrl=https://example.com" \\
 *            -F "buttonLabel=Saiba mais"
*/
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  RecrutamentoController.create
);

/**
 * @openapi
 * /api/v1/website/recrutamento/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Recrutamento"
 *     tags: [Website - Recrutamento]
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
 *             $ref: '#/components/schemas/WebsiteRecrutamentoUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteRecrutamento'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/recrutamento/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@recrutamento.png" \\
 *            -F "titulo=Atualizado" \\
 *            -F "descricao=Atualizada" \\
 *            -F "buttonUrl=https://example.com" \\
 *            -F "buttonLabel=Saiba mais"
*/
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  RecrutamentoController.update
);

/**
 * @openapi
 * /api/v1/website/recrutamento/{id}:
 *   delete:
 *     summary: Remover conteúdo "Recrutamento"
 *     tags: [Website - Recrutamento]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/recrutamento/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
*/
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  RecrutamentoController.remove
);

export { router as recrutamentoRoutes };

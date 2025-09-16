import { Router } from "express";
import { publicCache } from "../../../middlewares/cache-control";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { ConsultoriaController } from "../controllers/consultoria.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/consultoria:
 *   get:
 *     summary: Listar conteúdos "Consultoria"
 *     tags: [Website - Consultoria]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteConsultoria'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/consultoria"
 */
router.get("/", publicCache, ConsultoriaController.list);

/**
 * @openapi
 * /api/v1/website/consultoria/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Consultoria]
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
 *               $ref: '#/components/schemas/WebsiteConsultoria'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/consultoria/{id}"
 */
router.get("/:id", publicCache, ConsultoriaController.get);

/**
 * @openapi
 * /api/v1/website/consultoria:
 *   post:
 *     summary: Criar conteúdo "Consultoria"
 *     tags: [Website - Consultoria]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteConsultoriaCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteConsultoria'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/consultoria" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@consultoria.png" \\
 *            -F "titulo=Novo" \\
 *            -F "descricao=Conteudo" \\
 *            -F "buttonUrl=https://example.com" \\
 *            -F "buttonLabel=Saiba mais"
*/
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  ConsultoriaController.create
);

/**
 * @openapi
 * /api/v1/website/consultoria/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Consultoria"
 *     tags: [Website - Consultoria]
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
 *             $ref: '#/components/schemas/WebsiteConsultoriaUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteConsultoria'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/consultoria/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@consultoria.png" \\
 *            -F "titulo=Atualizado" \\
 *            -F "descricao=Atualizada" \\
 *            -F "buttonUrl=https://example.com" \\
 *            -F "buttonLabel=Saiba mais"
*/
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  ConsultoriaController.update
);

/**
 * @openapi
 * /api/v1/website/consultoria/{id}:
 *   delete:
 *     summary: Remover conteúdo "Consultoria"
 *     tags: [Website - Consultoria]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/consultoria/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
*/
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  ConsultoriaController.remove
);

export { router as consultoriaRoutes };

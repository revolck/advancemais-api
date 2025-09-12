import { Router } from "express";
import { rateLimitMiddleware } from "../../../middlewares/rate-limit";
import { publicCache } from "../../../middlewares/cache-control";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SobreController } from "../controllers/sobre.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/sobre:
 *   get:
 *     summary: Listar conteúdos "Sobre"
 *     tags: [Website - Sobre]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteSobre'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre"
 */
router.get("/", rateLimitMiddleware, publicCache, SobreController.list);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Sobre]
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
 *               $ref: '#/components/schemas/WebsiteSobre'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre/{id}"
 */
router.get("/:id", rateLimitMiddleware, publicCache, SobreController.get);

/**
 * @openapi
 * /api/v1/website/sobre:
 *   post:
 *     summary: Criar conteúdo "Sobre"
 *     tags: [Website - Sobre]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteSobreCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSobre'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/sobre" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Novo","descricao":"Conteudo","imagemUrl":"https://cdn.example.com/sobre.jpg"}'
*/
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.create
);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Sobre"
 *     tags: [Website - Sobre]
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
 *             $ref: '#/components/schemas/WebsiteSobreUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSobre'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/sobre/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Atualizado","descricao":"Atualizada","imagemUrl":"https://cdn.example.com/sobre.jpg"}'
*/
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.update
);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   delete:
 *     summary: Remover conteúdo "Sobre"
 *     tags: [Website - Sobre]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/sobre/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
*/
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.remove
);

export { router as sobreRoutes };

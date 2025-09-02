import { Router } from "express";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { HeaderPageController } from "../controllers/header-pages.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/header-pages:
 *   get:
 *     summary: Listar cabeçalhos de páginas
 *     tags: [Website - Header Pages]
 *     responses:
 *       200:
 *         description: Lista de cabeçalhos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteHeaderPage'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/header-pages"
 */
router.get("/", HeaderPageController.list);

/**
 * @openapi
 * /api/v1/website/header-pages/{id}:
 *   get:
 *     summary: Obter cabeçalho de página por ID
 *     tags: [Website - Header Pages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cabeçalho encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteHeaderPage'
 *       404:
 *         description: Cabeçalho não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/header-pages/{id}"
 */
router.get("/:id", HeaderPageController.get);

/**
 * @openapi
 * /api/v1/website/header-pages:
 *   post:
 *     summary: Criar cabeçalho de página
 *     tags: [Website - Header Pages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteHeaderPageCreateInput'
 *     responses:
 *       201:
 *         description: Cabeçalho criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteHeaderPage'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/header-pages" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"subtitulo":"Sub","titulo":"Titulo","descricao":"Desc","imagemUrl":"https://cdn.example.com/img.jpg","buttonLabel":"Saiba mais","buttonLink":"https://example.com","page":"SOBRE"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  HeaderPageController.create
);

/**
 * @openapi
 * /api/v1/website/header-pages/{id}:
 *   put:
 *     summary: Atualizar cabeçalho de página
 *     tags: [Website - Header Pages]
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
 *             $ref: '#/components/schemas/WebsiteHeaderPageUpdateInput'
 *     responses:
 *       200:
 *         description: Cabeçalho atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteHeaderPage'
 *       404:
 *         description: Cabeçalho não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/header-pages/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Novo titulo"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  HeaderPageController.update
);

/**
 * @openapi
 * /api/v1/website/header-pages/{id}:
 *   delete:
 *     summary: Remover cabeçalho de página
 *     tags: [Website - Header Pages]
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
 *         description: Cabeçalho removido
 *       404:
 *         description: Cabeçalho não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/header-pages/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  HeaderPageController.remove
);

export { router as headerPagesRoutes };

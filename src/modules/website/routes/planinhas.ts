import { Router } from "express";
import { publicCache } from "../../../middlewares/cache-control";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { PlaninhasController } from "../controllers/planinhas.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/planinhas:
 *   get:
 *     summary: Listar conteúdos "Planinhas"
 *     tags: [Website - Planinhas]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsitePlaninhas'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/planinhas"
 */
router.get("/", publicCache, PlaninhasController.list);

/**
 * @openapi
 * /api/v1/website/planinhas/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Planinhas]
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
 *               $ref: '#/components/schemas/WebsitePlaninhas'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/planinhas/{id}"
 */
router.get("/:id", publicCache, PlaninhasController.get);

/**
 * @openapi
 * /api/v1/website/planinhas:
 *   post:
 *     summary: Criar conteúdo "Planinhas"
 *     tags: [Website - Planinhas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsitePlaninhasCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsitePlaninhas'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/planinhas" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"T","descricao":"D","icone1":"i1","titulo1":"t1","descricao1":"d1","icone2":"i2","titulo2":"t2","descricao2":"d2","icone3":"i3","titulo3":"t3","descricao3":"d3"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  PlaninhasController.create
);

/**
 * @openapi
 * /api/v1/website/planinhas/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Planinhas"
 *     tags: [Website - Planinhas]
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
 *             $ref: '#/components/schemas/WebsitePlaninhasUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsitePlaninhas'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/planinhas/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"Atual"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  PlaninhasController.update
);

/**
 * @openapi
 * /api/v1/website/planinhas/{id}:
 *   delete:
 *     summary: Remover conteúdo "Planinhas"
 *     tags: [Website - Planinhas]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/planinhas/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  PlaninhasController.remove
);

export { router as planinhasRoutes };


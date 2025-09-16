import { Router } from "express";
import { publicCache } from "../../../middlewares/cache-control";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { DepoimentosController } from "../controllers/depoimentos.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/depoimentos:
 *   get:
 *     summary: Listar depoimentos
 *     tags: [Website - Depoimentos]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/WebsiteStatus'
 *         description: Filtra depoimentos por status (PUBLICADO ou RASCUNHO)
 *     responses:
 *       200:
 *         description: Lista de depoimentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteDepoimento'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/depoimentos"
 */
router.get("/", publicCache, DepoimentosController.list);

/**
 * @openapi
 * /api/v1/website/depoimentos/{id}:
 *   get:
 *     summary: Obter depoimento por ID da ordem
 *     tags: [Website - Depoimentos]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do depoimento
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Depoimento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDepoimento'
 *       404:
 *         description: Depoimento não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/depoimentos/{ordemId}"
 */
router.get("/:id", publicCache, DepoimentosController.get);

/**
 * @openapi
 * /api/v1/website/depoimentos:
 *   post:
 *     summary: Criar depoimento
 *     description: Cria um novo depoimento. O campo `status` representa o estado de publicação e aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - Depoimentos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteDepoimentoCreateInput'
 *     responses:
 *       201:
 *         description: Depoimento criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDepoimento'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/depoimentos" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"depoimento":"Excelente serviço","nome":"Fulano","cargo":"Gerente","fotoUrl":"https://cdn.example.com/foto.jpg","status":"PUBLICADO"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DepoimentosController.create
);

/**
 * @openapi
 * /api/v1/website/depoimentos/{id}:
 *   put:
 *     summary: Atualizar depoimento
 *     description: Atualiza um depoimento. O campo `status` representa o estado de publicação e aceita boolean (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - Depoimentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID do depoimento
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteDepoimentoUpdateInput'
 *     responses:
 *       200:
 *         description: Depoimento atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDepoimento'
 *       404:
 *         description: Depoimento não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/depoimentos/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"depoimento":"Texto","status":"RASCUNHO"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DepoimentosController.update
);

/**
 * @openapi
 * /api/v1/website/depoimentos/{id}/reorder:
 *   put:
 *     summary: Reordenar depoimento
 *     description: Altera a posição do depoimento utilizando o ID da ordem. Caso a nova posição esteja ocupada, os demais serão ajustados automaticamente.
 *     tags: [Website - Depoimentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do depoimento
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteDepoimentoReorderInput'
 *     responses:
 *       200:
 *         description: Depoimento reordenado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDepoimento'
 *       404:
 *         description: Depoimento não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/depoimentos/{ordemId}/reorder" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"ordem":2}'
 */
router.put(
  "/:id/reorder",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DepoimentosController.reorder
);

/**
 * @openapi
 * /api/v1/website/depoimentos/{id}:
 *   delete:
 *     summary: Remover depoimento
 *     tags: [Website - Depoimentos]
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
 *         description: Depoimento removido
 *       404:
 *         description: Depoimento não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/depoimentos/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DepoimentosController.remove
);

export { router as depoimentosRoutes };


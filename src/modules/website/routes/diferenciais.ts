import { Router } from "express";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { DiferenciaisController } from "../controllers/diferenciais.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/diferenciais:
 *   get:
 *     summary: Listar conteúdos "Diferenciais"
 *     tags: [Website - Diferenciais]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteDiferenciais'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/diferenciais"
 */
router.get("/", DiferenciaisController.list);

/**
 * @openapi
 * /api/v1/website/diferenciais/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Diferenciais]
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
 *               $ref: '#/components/schemas/WebsiteDiferenciais'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/diferenciais/{id}"
 */
router.get("/:id", DiferenciaisController.get);

/**
 * @openapi
 * /api/v1/website/diferenciais:
 *   post:
 *     summary: Criar conteúdo "Diferenciais"
 *     tags: [Website - Diferenciais]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteDiferenciaisCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDiferenciais'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/diferenciais" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"icone1":"i1","titulo1":"Titulo 1","descricao1":"Desc 1","icone2":"i2","titulo2":"Titulo 2","descricao2":"Desc 2","icone3":"i3","titulo3":"Titulo 3","descricao3":"Desc 3","icone4":"i4","titulo4":"Titulo 4","descricao4":"Desc 4","titulo":"Geral","descricao":"Resumo","botaoUrl":"https://example.com","botaoLabel":"Saiba mais"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DiferenciaisController.create
);

/**
 * @openapi
 * /api/v1/website/diferenciais/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Diferenciais"
 *     tags: [Website - Diferenciais]
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
 *             $ref: '#/components/schemas/WebsiteDiferenciaisUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteDiferenciais'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/diferenciais/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Atualizado"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DiferenciaisController.update
);

/**
 * @openapi
 * /api/v1/website/diferenciais/{id}:
 *   delete:
 *     summary: Remover conteúdo "Diferenciais"
 *     tags: [Website - Diferenciais]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/diferenciais/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  DiferenciaisController.remove
);

export { router as diferenciaisRoutes };

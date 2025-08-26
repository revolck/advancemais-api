import { Router } from "express";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SobreEmpresaController } from "../controllers/sobreEmpresa.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/sobre-empresa:
 *   get:
 *     summary: Listar conteúdos "SobreEmpresa"
 *     tags: [Website - SobreEmpresa]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteSobreEmpresa'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre-empresa"
 */
router.get("/", SobreEmpresaController.list);

/**
 * @openapi
 * /api/v1/website/sobre-empresa/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - SobreEmpresa]
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
 *               $ref: '#/components/schemas/WebsiteSobreEmpresa'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre-empresa/{id}"
 */
router.get("/:id", SobreEmpresaController.get);

/**
 * @openapi
 * /api/v1/website/sobre-empresa:
 *   post:
 *     summary: Criar conteúdo "SobreEmpresa"
 *     tags: [Website - SobreEmpresa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteSobreEmpresaCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSobreEmpresa'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/sobre-empresa" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Novo","descricao":"Conteudo","descricaoVisao":"Visao","descricaoMissao":"Missao","descricaoValores":"Valores","videoUrl":"https://example.com/video"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreEmpresaController.create
);

/**
 * @openapi
 * /api/v1/website/sobre-empresa/{id}:
 *   put:
 *     summary: Atualizar conteúdo "SobreEmpresa"
 *     tags: [Website - SobreEmpresa]
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
 *             $ref: '#/components/schemas/WebsiteSobreEmpresaUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSobreEmpresa'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/sobre-empresa/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"titulo":"Atualizado"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreEmpresaController.update
);

/**
 * @openapi
 * /api/v1/website/sobre-empresa/{id}:
 *   delete:
 *     summary: Remover conteúdo "SobreEmpresa"
 *     tags: [Website - SobreEmpresa]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/sobre-empresa/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreEmpresaController.remove
);

export { router as sobreEmpresaRoutes };


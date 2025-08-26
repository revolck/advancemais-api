import { Router } from "express";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { TreinamentoCompanyController } from "../controllers/treinamentoCompany.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/treinamento-company:
 *   get:
 *     summary: Listar conteúdos "TreinamentoCompany"
 *     tags: [Website - TreinamentoCompany]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteTreinamentoCompany'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/treinamento-company"
 */
router.get("/", TreinamentoCompanyController.list);

/**
 * @openapi
 * /api/v1/website/treinamento-company/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - TreinamentoCompany]
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
 *               $ref: '#/components/schemas/WebsiteTreinamentoCompany'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/treinamento-company/{id}"
 */
router.get("/:id", TreinamentoCompanyController.get);

/**
 * @openapi
 * /api/v1/website/treinamento-company:
 *   post:
 *     summary: Criar conteúdo "TreinamentoCompany"
 *     tags: [Website - TreinamentoCompany]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTreinamentoCompanyCreateInput'
 *     responses:
 *       201:
 *         description: Conteúdo criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTreinamentoCompany'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/treinamento-company" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"T","icone1":"i1","descricao1":"d1","icone2":"i2","descricao2":"d2","icone3":"i3","descricao3":"d3","icone4":"i4","descricao4":"d4","icone5":"i5","descricao5":"d5"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  TreinamentoCompanyController.create
);

/**
 * @openapi
 * /api/v1/website/treinamento-company/{id}:
 *   put:
 *     summary: Atualizar conteúdo "TreinamentoCompany"
 *     tags: [Website - TreinamentoCompany]
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
 *             $ref: '#/components/schemas/WebsiteTreinamentoCompanyUpdateInput'
 *     responses:
 *       200:
 *         description: Conteúdo atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTreinamentoCompany'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/treinamento-company/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"titulo":"Atual"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  TreinamentoCompanyController.update
);

/**
 * @openapi
 * /api/v1/website/treinamento-company/{id}:
 *   delete:
 *     summary: Remover conteúdo "TreinamentoCompany"
 *     tags: [Website - TreinamentoCompany]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/treinamento-company/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  TreinamentoCompanyController.remove
);

export { router as treinamentoCompanyRoutes };


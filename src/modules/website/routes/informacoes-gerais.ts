import { Router } from "express";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { InformacoesGeraisController } from "../controllers/informacoes-gerais.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/website/informacoes-gerais:
 *   get:
 *     summary: Listar informações gerais
 *     tags: [Website - InformacoesGerais]
 *     responses:
 *       200:
 *         description: Lista de informações gerais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteInformacoes'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/informacoes-gerais"
 */
router.get("/", InformacoesGeraisController.list);

/**
 * @openapi
 * /api/v1/website/informacoes-gerais/{id}:
 *   get:
 *     summary: Obter informação geral por ID
 *     tags: [Website - InformacoesGerais]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Informação encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteInformacoes'
 *       404:
 *         description: Informação não encontrada
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
 *           curl -X GET "http://localhost:3000/api/v1/website/informacoes-gerais/{id}"
 */
router.get("/:id", InformacoesGeraisController.get);

/**
 * @openapi
 * /api/v1/website/informacoes-gerais:
 *   post:
 *     summary: Criar informação geral
 *     tags: [Website - InformacoesGerais]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteInformacoesCreateInput'
 *     responses:
 *       201:
 *         description: Informação criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteInformacoes'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/informacoes-gerais" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"endereco":"Rua A, 123","cep":"12345-678","cidade":"Cidade","estado":"ST","telefone1":"(11) 1234-5678","whatsapp":"(11) 91234-5678","horarioDeFuncionamento":"08 as 18","email":"contato@example.com"}'
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  InformacoesGeraisController.create
);

/**
 * @openapi
 * /api/v1/website/informacoes-gerais/{id}:
 *   put:
 *     summary: Atualizar informação geral
 *     tags: [Website - InformacoesGerais]
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
 *             $ref: '#/components/schemas/WebsiteInformacoesUpdateInput'
 *     responses:
 *       200:
 *         description: Informação atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteInformacoes'
 *       404:
 *         description: Informação não encontrada
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/informacoes-gerais/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"telefone2":"(11) 9876-5432"}'
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  InformacoesGeraisController.update
);

/**
 * @openapi
 * /api/v1/website/informacoes-gerais/{id}:
 *   delete:
 *     summary: Remover informação geral
 *     tags: [Website - InformacoesGerais]
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
 *         description: Informação removida
 *       404:
 *         description: Informação não encontrada
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/informacoes-gerais/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  InformacoesGeraisController.remove
);

export { router as informacoesGeraisRoutes };


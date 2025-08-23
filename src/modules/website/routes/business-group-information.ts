import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { BusinessGroupInformationController } from "../controllers/businessGroupInformation.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/business-group-information:
 *   get:
 *     summary: Listar informações de grupos empresariais
 *     tags: [Website - BusinessGroupInformation]
 *     responses:
 *       200:
 *         description: Lista de informações
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteBusinessGroupInformation'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/business-group-information"
 */
router.get("/", BusinessGroupInformationController.list);

/**
 * @openapi
 * /api/v1/website/business-group-information/{id}:
 *   get:
 *     summary: Obter informação por ID
 *     tags: [Website - BusinessGroupInformation]
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
 *               $ref: '#/components/schemas/WebsiteBusinessGroupInformation'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/business-group-information/{id}"
 */
router.get("/:id", BusinessGroupInformationController.get);

/**
 * @openapi
 * /api/v1/website/business-group-information:
 *   post:
 *     summary: Criar informação de grupo empresarial
 *     tags: [Website - BusinessGroupInformation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteBusinessGroupInformationCreateInput'
 *     responses:
 *       201:
 *         description: Informação criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBusinessGroupInformation'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/business-group-information" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "slug=grupo-x" \\
 *            -F "titulo=Grupo X" \\
 *            -F "descricao=Descricao" \\
 *            -F "botaoLabel=Saiba mais" \\
 *            -F "botaoUrl=https://example.com" \\
 *            -F "imagem=@info.png"
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BusinessGroupInformationController.create
);

/**
 * @openapi
 * /api/v1/website/business-group-information/{id}:
 *   put:
 *     summary: Atualizar informação de grupo empresarial
 *     tags: [Website - BusinessGroupInformation]
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
 *             $ref: '#/components/schemas/WebsiteBusinessGroupInformationUpdateInput'
 *     responses:
 *       200:
 *         description: Informação atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteBusinessGroupInformation'
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/business-group-information/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "titulo=Atualizado"
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BusinessGroupInformationController.update
);

/**
 * @openapi
 * /api/v1/website/business-group-information/{id}:
 *   delete:
 *     summary: Remover informação de grupo empresarial
 *     tags: [Website - BusinessGroupInformation]
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/business-group-information/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  BusinessGroupInformationController.remove
);

export { router as businessGroupInformationRoutes };

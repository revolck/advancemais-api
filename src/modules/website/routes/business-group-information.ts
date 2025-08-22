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
 *     responses:
 *       201:
 *         description: Informação criada
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/business-group-information" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@info.png" \\
 *            -F "titulo=Novo"
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
 *     responses:
 *       200:
 *         description: Informação atualizada
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/business-group-information/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@info.png" \\
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
 *       200:
 *         description: Informação removida
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

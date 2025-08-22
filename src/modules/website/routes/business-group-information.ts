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
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  BusinessGroupInformationController.remove
);

export { router as businessGroupInformationRoutes };

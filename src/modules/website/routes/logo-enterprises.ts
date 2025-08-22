import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { LogoEnterpriseController } from "../controllers/logoEnterprise.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/logo-enterprises:
 *   get:
 *     summary: Listar logos de empresas
 *     tags: [Website - LogoEnterprises]
 *     responses:
 *       200:
 *         description: Lista de logos
 */
router.get("/", LogoEnterpriseController.list);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   get:
 *     summary: Obter logo por ID
 *     tags: [Website - LogoEnterprises]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logo encontrada
 */
router.get("/:id", LogoEnterpriseController.get);

/**
 * @openapi
 * /api/v1/website/logo-enterprises:
 *   post:
 *     summary: Criar logo de empresa
 *     tags: [Website - LogoEnterprises]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Logo criada
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  LogoEnterpriseController.create
);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   put:
 *     summary: Atualizar logo de empresa
 *     tags: [Website - LogoEnterprises]
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
 *         description: Logo atualizada
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  LogoEnterpriseController.update
);

/**
 * @openapi
 * /api/v1/website/logo-enterprises/{id}:
 *   delete:
 *     summary: Remover logo de empresa
 *     tags: [Website - LogoEnterprises]
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
 *         description: Logo removida
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  LogoEnterpriseController.remove
);

export { router as logoEnterpriseRoutes };

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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/logo-enterprises"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/logo-enterprises/{id}"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/logo-enterprises" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@logo.png" \\
 *            -F "empresa=Minha Empresa"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/logo-enterprises/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@logo.png" \\
 *            -F "empresa=Atualizada"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/website/logo-enterprises/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  LogoEnterpriseController.remove
);

export { router as logoEnterpriseRoutes };

import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { BannerController } from "../controllers/banner.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/banner:
 *   get:
 *     summary: Listar banners
 *     tags: [Website - Banner]
 *     responses:
 *       200:
 *         description: Lista de banners
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/banner"
 */
router.get("/", BannerController.list);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   get:
 *     summary: Obter banner por ID
 *     tags: [Website - Banner]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Banner encontrado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/banner/{id}"
 */
router.get("/:id", BannerController.get);

/**
 * @openapi
 * /api/v1/website/banner:
 *   post:
 *     summary: Criar banner
 *     tags: [Website - Banner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Banner criado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/banner" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@banner.png" \\
 *            -F "titulo=Novo Banner"
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BannerController.create
);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   put:
 *     summary: Atualizar banner
 *     tags: [Website - Banner]
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
 *         description: Banner atualizado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/banner/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@banner.png" \\
 *            -F "titulo=Atualizado"
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  BannerController.update
);

/**
 * @openapi
 * /api/v1/website/banner/{id}:
 *   delete:
 *     summary: Remover banner
 *     tags: [Website - Banner]
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
 *         description: Banner removido
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/website/banner/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  BannerController.remove
);

export { router as bannerRoutes };

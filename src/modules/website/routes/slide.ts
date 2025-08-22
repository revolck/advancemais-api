import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SlideController } from "../controllers/slide.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/slide:
 *   get:
 *     summary: Listar slides
 *     tags: [Website - Slide]
 *     responses:
 *       200:
 *         description: Lista de slides
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/slide"
 */
router.get("/", SlideController.list);

/**
 * @openapi
 * /api/v1/website/slide/{id}:
 *   get:
 *     summary: Obter slide por ID
 *     tags: [Website - Slide]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slide encontrado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/slide/{id}"
 */
router.get("/:id", SlideController.get);

/**
 * @openapi
 * /api/v1/website/slide:
 *   post:
 *     summary: Criar slide
 *     tags: [Website - Slide]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Slide criado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/slide" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@slide.png" \\
 *            -F "titulo=Novo Slide"
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SlideController.create
);

/**
 * @openapi
 * /api/v1/website/slide/{id}:
 *   put:
 *     summary: Atualizar slide
 *     tags: [Website - Slide]
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
 *         description: Slide atualizado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/slide/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@slide.png" \\
 *            -F "titulo=Atualizado"
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SlideController.update
);

/**
 * @openapi
 * /api/v1/website/slide/{id}:
 *   delete:
 *     summary: Remover slide
 *     tags: [Website - Slide]
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
 *         description: Slide removido
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/website/slide/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SlideController.remove
);

export { router as slideRoutes };

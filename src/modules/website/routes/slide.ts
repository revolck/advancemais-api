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
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SlideController.remove
);

export { router as slideRoutes };

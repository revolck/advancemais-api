import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SobreController } from "../controllers/sobre.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/sobre:
 *   get:
 *     summary: Listar conteúdos "Sobre"
 *     tags: [Website - Sobre]
 *     responses:
 *       200:
 *         description: Lista de conteúdos
 */
router.get("/", SobreController.list);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   get:
 *     summary: Obter conteúdo por ID
 *     tags: [Website - Sobre]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conteúdo encontrado
 */
router.get("/:id", SobreController.get);

/**
 * @openapi
 * /api/v1/website/sobre:
 *   post:
 *     summary: Criar conteúdo "Sobre"
 *     tags: [Website - Sobre]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Conteúdo criado
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SobreController.create
);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   put:
 *     summary: Atualizar conteúdo "Sobre"
 *     tags: [Website - Sobre]
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
 *         description: Conteúdo atualizado
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SobreController.update
);

/**
 * @openapi
 * /api/v1/website/sobre/{id}:
 *   delete:
 *     summary: Remover conteúdo "Sobre"
 *     tags: [Website - Sobre]
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
 *         description: Conteúdo removido
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.remove
);

export { router as sobreRoutes };

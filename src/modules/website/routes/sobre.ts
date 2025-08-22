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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/website/sobre/{id}"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/website/sobre" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@sobre.png" \\
 *            -F "titulo=Novo"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/website/sobre/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@sobre.png" \\
 *            -F "titulo=Atualizado"
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/website/sobre/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SobreController.remove
);

export { router as sobreRoutes };

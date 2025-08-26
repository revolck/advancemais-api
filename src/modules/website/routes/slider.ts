import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { SliderController } from "../controllers/slider.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/slider:
 *   get:
 *     summary: Listar sliders
 *     tags: [Website - Slider]
 *     responses:
 *       200:
 *         description: Lista de sliders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteSlider'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/slider"
*/
router.get("/", SliderController.list);

/**
 * @openapi
 * /api/v1/website/slider/{id}:
 *   get:
 *     summary: Obter slider por ID
 *     tags: [Website - Slider]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Slider encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSlider'
 *       404:
 *         description: Slider não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/slider/{id}"
*/
router.get("/:id", SliderController.get);

/**
 * @openapi
 * /api/v1/website/slider:
 *   post:
 *     summary: Criar slider
 *     tags: [Website - Slider]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteSliderCreateInput'
 *     responses:
 *       201:
 *         description: Slider criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSlider'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/slider" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@slide.png" \\
 *            -F "sliderName=Meu Slider" \\
 *            -F "orientacao=DESKTOP" \\
 *            -F "status=PUBLICADO" \\
 *            -F "link=https://example.com"
*/
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SliderController.create
);

/**
 * @openapi
 * /api/v1/website/slider/{id}:
 *   put:
 *     summary: Atualizar slider
 *     description: Atualiza dados do slider e permite alterar a ordem dos banners, reordenando automaticamente os demais.
 *     tags: [Website - Slider]
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
 *             $ref: '#/components/schemas/WebsiteSliderUpdateInput'
 *     responses:
 *       200:
 *         description: Slider atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteSlider'
 *       404:
 *         description: Slider não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/slider/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -F "imagem=@slide.png" \\
 *            -F "sliderName=Novo Slider" \\
 *            -F "orientacao=TABLET_MOBILE" \\
 *            -F "status=RASCUNHO" \\
 *            -F "link=https://example.com" \\
 *            -F "ordem=2"
*/
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("imagem"),
  SliderController.update
);

/**
 * @openapi
 * /api/v1/website/slider/{id}:
 *   delete:
 *     summary: Remover slider
 *     tags: [Website - Slider]
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
 *         description: Slider removido
 *       404:
 *         description: Slider não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/slider/{id}" \\
 *            -H "Authorization: Bearer <TOKEN>"
*/
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  SliderController.remove
);

export { router as sliderRoutes };

import { Router } from "express";
import multer from "multer";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { TeamController } from "../controllers/team.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/v1/website/team:
 *   get:
 *     summary: Listar membros da equipe
 *     tags: [Website - Team]
 *     responses:
 *       200:
 *         description: Lista de membros
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteTeam'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/team"
 */
router.get("/", TeamController.list);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   get:
 *     summary: Obter membro da equipe por ID
 *     tags: [Website - Team]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membro encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/team/{id}"
 */
router.get("/:id", TeamController.get);

/**
 * @openapi
 * /api/v1/website/team:
 *   post:
 *     summary: Criar membro da equipe
 *     tags: [Website - Team]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTeamCreateInput'
 *     responses:
 *       201:
 *         description: Membro criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/team" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "photo=@team.png" \
 *            -F "nome=Fulano" \
 *            -F "cargo=Dev"
 */
router.post(
  "/",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("photo"),
  TeamController.create
);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   put:
 *     summary: Atualizar membro da equipe
 *     tags: [Website - Team]
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
 *             $ref: '#/components/schemas/WebsiteTeamUpdateInput'
 *     responses:
 *       200:
 *         description: Membro atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/team/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -F "photo=@team.png" \
 *            -F "nome=Fulano" \
 *            -F "cargo=Dev"
 */
router.put(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  upload.single("photo"),
  TeamController.update
);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   delete:
 *     summary: Remover membro da equipe
 *     tags: [Website - Team]
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
 *         description: Membro removido
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/team/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  TeamController.remove
);

export { router as teamRoutes };

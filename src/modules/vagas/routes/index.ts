import { Router } from "express";
import { VagaController } from "../controllers/vaga.controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";

const router = Router();

/**
 * @openapi
 * /api/v1/vagas:
 *   get:
 *     summary: Listar vagas
 *     tags: [Vagas]
 *     parameters:
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *         description: Filtrar por empresa
 *     responses:
 *       200:
 *         description: Lista de vagas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vaga'
 */
router.get("/", VagaController.list);

/**
 * @openapi
 * /api/v1/vagas/{id}:
 *   get:
 *     summary: Obter vaga
 *     tags: [Vagas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vaga encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 *       404:
 *         description: Vaga não encontrada
 */
router.get("/:id", VagaController.get);

/**
 * @openapi
 * /api/v1/vagas:
 *   post:
 *     summary: Criar vaga
 *     tags: [Vagas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaCreateRequest'
 *     responses:
 *       201:
 *         description: Vaga criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 */
router.post("/", authMiddlewareWithDB(), VagaController.create);

/**
 * @openapi
 * /api/v1/vagas/{id}:
 *   put:
 *     summary: Atualizar vaga
 *     tags: [Vagas]
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaUpdateRequest'
 *     responses:
 *       200:
 *         description: Vaga atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vaga'
 */
router.put("/:id", authMiddlewareWithDB(), VagaController.update);

/**
 * @openapi
 * /api/v1/vagas/{id}:
 *   delete:
 *     summary: Remover vaga
 *     tags: [Vagas]
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
 *         description: Vaga removida
 */
router.delete("/:id", authMiddlewareWithDB(), VagaController.remove);

/**
 * @openapi
 * /api/v1/vagas/{id}/candidaturas:
 *   post:
 *     summary: Candidatar-se a vaga
 *     tags: [Vagas]
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaApplyRequest'
 *     responses:
 *       201:
 *         description: Candidatura registrada
 */
router.post("/:id/candidaturas", authMiddlewareWithDB(), VagaController.apply);

export { router as vagasRoutes };

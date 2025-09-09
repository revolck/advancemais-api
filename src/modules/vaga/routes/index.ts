import { Router } from "express";
import { VagaController } from "../controllers/vaga.controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();

/**
 * @openapi
 * /api/v1/vagas:
 *   get:
 *     summary: Listar vagas
 *     tags: [Vagas]
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
router.post(
  "/",
  authMiddlewareWithDB([Role.EMPRESA, Role.RECRUTADOR]),
  VagaController.create
);

/**
 * @openapi
 * /api/v1/vagas/{id}/candidatar:
 *   post:
 *     summary: Candidatar-se a uma vaga
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
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VagaApplyRequest'
 *     responses:
 *       201:
 *         description: Candidatura registrada
 */
router.post(
  "/:id/candidatar",
  authMiddlewareWithDB([Role.ALUNO_CANDIDATO]),
  VagaController.apply
);

export { router as vagaRoutes };

import { Router } from "express";
import { PlanController } from "../controllers/plan-controller";
import { authMiddlewareWithDB } from "../../usuarios/middlewares";
import { Role } from "../../usuarios/enums/Role";

const router = Router();
const controller = new PlanController();

/**
 * @openapi
 * /api/v1/empresa/plans:
 *   post:
 *     summary: Criar novo plano
 *     tags: [Empresa]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Plano criado com sucesso
 */
router.post("/", authMiddlewareWithDB([Role.ADMIN]), controller.createPlan);

/**
 * @openapi
 * /api/v1/empresa/plans:
 *   get:
 *     summary: Listar planos disponíveis
 *     tags: [Empresa]
 *     responses:
 *       200:
 *         description: Lista de planos
 */
router.get("/", controller.getPlans);

/**
 * @openapi
 * /api/v1/empresa/plans/{planId}:
 *   put:
 *     summary: Atualizar plano existente
 *     tags: [Empresa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plano atualizado
 */
router.put(
  "/:planId",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.updatePlan
);

/**
 * @openapi
 * /api/v1/empresa/plans/{planId}/assign:
 *   post:
 *     summary: Atribuir plano a uma empresa
 *     tags: [Empresa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plano atribuído
 */
router.post(
  "/:planId/assign",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.assignPlan
);

/**
 * @openapi
 * /api/v1/empresa/plans/companies/{empresaId}/plan:
 *   delete:
 *     summary: Remover plano de uma empresa
 *     tags: [Empresa]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: empresaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plano removido
 */
router.delete(
  "/companies/:empresaId/plan",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.unassignPlan
);

export { router as plansRoutes };

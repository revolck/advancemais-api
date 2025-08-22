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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string, example: "Plano Básico" }
 *               valor: { type: number, example: 49.9 }
 *               descricao: { type: string, example: "Acesso básico" }
 *               recursos:
 *                 type: array
 *                 items: { type: string }
 *               frequency: { type: number, example: 1 }
 *               frequencyType: { type: string, example: "months" }
 *               repetitions: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Plano criado com sucesso
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresa/plans" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"nome":"Plano Básico","valor":49.9,"descricao":"Acesso básico","recursos":["feature"],"frequency":1,"frequencyType":"months"}'
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/empresa/plans"
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome: { type: string, example: "Plano Atualizado" }
 *               valor: { type: number, example: 59.9 }
 *               descricao: { type: string, example: "Descrição" }
 *               ativo: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Plano atualizado
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/empresa/plans/{planId}" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"nome":"Plano Atualizado"}'
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               empresaId: { type: string, example: "empresa-uuid" }
 *               metodoPagamento: { type: string, example: "CREDIT" }
 *               tipo: { type: string, example: "STANDARD" }
 *               validade: { type: string, example: "DIAS_30" }
 *     responses:
 *       200:
 *         description: Plano atribuído
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresa/plans/{planId}/assign" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"empresaId":"empresa-uuid","metodoPagamento":"CREDIT"}'
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/empresa/plans/companies/{empresaId}/plan" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/companies/:empresaId/plan",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.unassignPlan
);

export { router as plansRoutes };

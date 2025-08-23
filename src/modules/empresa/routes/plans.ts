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
 *             $ref: '#/components/schemas/EmpresaPlanCreateRequest'
 *     responses:
 *       201:
 *         description: Plano criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanCreateResponse'
 *       400:
 *         description: Erro ao criar plano
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
 *           curl -X POST "http://localhost:3000/api/v1/empresa/plans" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"nome":"Plano Básico","valor":49.9,"descricao":"Acesso básico","recursos":["feature"],"frequency":1,"frequencyType":"MESES"}'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlansResponse'
 *       400:
 *         description: Erro ao buscar planos
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
 *         description: ID do plano
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaPlanUpdateRequest'
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanUpdateResponse'
 *       400:
 *         description: Erro ao atualizar plano
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
 *         description: ID do plano
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaPlanAssignRequest'
 *     responses:
 *       200:
 *         description: Plano atribuído
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanAssignResponse'
 *       400:
 *         description: Erro ao atribuir plano
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
 *           curl -X POST "http://localhost:3000/api/v1/empresa/plans/{planId}/assign" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"empresaId":"empresa-uuid","metodoPagamento":"PIX","tipo":"STANDARD","validade":"DIAS_30"}'
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
 *         description: ID da empresa
 *     responses:
 *       200:
 *         description: Plano removido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanUnassignResponse'
 *       400:
 *         description: Erro ao remover plano
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
 *           curl -X DELETE "http://localhost:3000/api/v1/empresa/plans/companies/{empresaId}/plan" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  "/companies/:empresaId/plan",
  authMiddlewareWithDB([Role.ADMIN]),
  controller.unassignPlan
);

export { router as plansRoutes };

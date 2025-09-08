import { Router } from "express";
import { PlanController } from "../controllers";
import { supabaseAuthMiddleware } from "../../usuarios/auth";

const router = Router();
const planController = new PlanController();

/**
 * @openapi
 * /api/v1/mercadopago/plans/{planId}/free-trial:
 *   put:
 *     summary: Definir teste grátis para plano
 *     tags: [MercadoPago]
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
 *             $ref: '#/components/schemas/MercadoPagoFreeTrialRequest'
 *     responses:
 *       200:
 *         description: Plano atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasicMessage'
 */
router.put(
  "/:planId/free-trial",
  supabaseAuthMiddleware(),
  planController.offerFreeTrial
);

export { router as plansRoutes };

/**
 * Rotas de estatísticas e dashboard
 * Responsabilidade única: métricas e relatórios
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Router } from "express";
import { supabaseAuthMiddleware } from "../auth";
import { StatsController } from "../controllers/stats-controller";

const router = Router();
const statsController = new StatsController();

// =============================================
// MIDDLEWARE DE SEGURANÇA
// =============================================

/**
 * Estatísticas requerem pelo menos role MODERADOR
 */
router.use(supabaseAuthMiddleware(["ADMIN", "MODERADOR"]));

// =============================================
// ROTAS DE ESTATÍSTICAS
// =============================================

/**
 * Dashboard principal - estatísticas gerais
 * GET /stats/dashboard
 */
/**
 * @openapi
 * /api/v1/usuarios/stats/dashboard:
  *   get:
  *     summary: Estatísticas gerais do sistema
  *     tags: [Usuários - Stats]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Dados de dashboard
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/DashboardStatsResponse'
  *       500:
  *         description: Erro ao obter estatísticas
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/stats/dashboard" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/dashboard", statsController.getDashboardStats);

/**
 * Estatísticas de usuários
 * GET /stats/usuarios
 */
/**
 * @openapi
 * /api/v1/usuarios/stats/usuarios:
  *   get:
  *     summary: Estatísticas de usuários
  *     tags: [Usuários - Stats]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: query
  *         name: periodo
  *         schema:
  *           type: string
  *           example: 30d
  *     responses:
  *       200:
  *         description: Estatísticas retornadas
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UserStatsResponse'
  *       500:
  *         description: Erro ao obter estatísticas
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/stats/usuarios" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/usuarios", statsController.getUserStats);

export { router as statsRoutes };

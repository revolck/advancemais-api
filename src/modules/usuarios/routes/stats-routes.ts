/**
 * Rotas de estatísticas e dashboard
 * Responsabilidade única: métricas e relatórios
 *
 * @author Sistema AdvanceMais
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
 *     responses:
 *       200:
 *         description: Estatísticas retornadas
 */
router.get("/usuarios", statsController.getUserStats);

/**
 * Estatísticas de pagamentos
 * GET /stats/pagamentos
 */
/**
 * @openapi
 * /api/v1/usuarios/stats/pagamentos:
 *   get:
 *     summary: Estatísticas de pagamentos
 *     tags: [Usuários - Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas de pagamentos
 */
router.get(
  "/pagamentos",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR", "FINANCEIRO"]),
  statsController.getPaymentStats
);

export { router as statsRoutes };

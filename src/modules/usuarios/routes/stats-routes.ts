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
router.get("/dashboard", statsController.getDashboardStats);

/**
 * Estatísticas de usuários
 * GET /stats/usuarios
 */
router.get("/usuarios", statsController.getUserStats);

/**
 * Estatísticas de pagamentos
 * GET /stats/pagamentos
 */
router.get(
  "/pagamentos",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR", "FINANCEIRO"]),
  statsController.getPaymentStats
);

export { router as statsRoutes };

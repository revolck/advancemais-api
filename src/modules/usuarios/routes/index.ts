/**
 * Router principal do módulo de usuários - CORRIGIDO
 * Centraliza e organiza todas as sub-rotas
 *
 * @author Sistema AdvanceMais
 * @version 3.0.3 - Correção definitiva path-to-regexp
 */
import { Router } from "express";
import { usuarioRoutes } from "./usuario-routes";
import { adminRoutes } from "./admin-routes";
import { paymentRoutes } from "./payment-routes";
import { statsRoutes } from "./stats-routes";

const router = Router();

/**
 * Informações do módulo de usuários
 * GET /usuarios
 */
router.get("/", (req, res) => {
  res.json({
    message: "Módulo de Usuários - AdvanceMais API",
    version: "3.0.3",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "POST /login, POST /registrar, POST /logout",
      profile: "GET /perfil",
      admin: "/admin/*",
      payments: "/pagamentos/*",
      stats: "/stats/*",
      recovery: "/recuperar-senha/*",
    },
    status: "operational",
  });
});

// =============================================
// REGISTRO DE SUB-ROTAS - ORDEM IMPORTANTE
// =============================================

/**
 * Rotas administrativas - PRIMEIRO (mais específicas)
 */
router.use("/admin", adminRoutes);

/**
 * Rotas de estatísticas
 */
router.use("/stats", statsRoutes);

/**
 * Rotas de pagamentos
 */
router.use("/pagamentos", paymentRoutes);

/**
 * Rotas básicas de usuário - ÚLTIMO (mais genéricas)
 */
router.use("/", usuarioRoutes);

export { router as usuarioRoutes };
export default router;

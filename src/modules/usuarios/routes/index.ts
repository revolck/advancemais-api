/**
 * Router principal do módulo de usuários - ESTRUTURA ORIGINAL
 * Centraliza e organiza todas as sub-rotas
 *
 * @author Sistema AdvanceMais
 * @version 3.0.4 - ESTRUTURA ORIGINAL com verificações de segurança
 */
import { Router } from "express";

const router = Router();

/**
 * Informações do módulo de usuários
 * GET /usuarios
 */
router.get("/", (req, res) => {
  res.json({
    message: "Módulo de Usuários - AdvanceMais API",
    version: "3.0.4",
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
// IMPORTS SEGUROS DAS SUB-ROTAS
// =============================================

let usuarioRoutes: Router | undefined;
let adminRoutes: Router | undefined;
let paymentRoutes: Router | undefined;
let statsRoutes: Router | undefined;

// Import das rotas básicas (ESSENCIAL)
try {
  const { default: routes } = require("./usuario-routes");
  usuarioRoutes = routes;
  console.log("✅ usuario-routes carregado");
} catch (error) {
  console.error("❌ Erro ao carregar usuario-routes:", error);
}

// Import das rotas administrativas (OPCIONAL)
try {
  const { default: routes } = require("./admin-routes");
  adminRoutes = routes;
  console.log("✅ admin-routes carregado");
} catch (error) {
  console.warn("⚠️ admin-routes não disponível:", error);
}

// Import das rotas de pagamento (OPCIONAL)
try {
  const { default: routes } = require("./payment-routes");
  paymentRoutes = routes;
  console.log("✅ payment-routes carregado");
} catch (error) {
  console.warn("⚠️ payment-routes não disponível:", error);
}

// Import das rotas de estatísticas (OPCIONAL)
try {
  const { default: routes } = require("./stats-routes");
  statsRoutes = routes;
  console.log("✅ stats-routes carregado");
} catch (error) {
  console.warn("⚠️ stats-routes não disponível:", error);
}

// =============================================
// REGISTRO DE SUB-ROTAS - ORDEM IMPORTANTE
// =============================================

/**
 * Rotas administrativas - PRIMEIRO (mais específicas)
 */
if (adminRoutes) {
  router.use("/admin", adminRoutes);
  console.log("✅ Rotas administrativas registradas");
}

/**
 * Rotas de estatísticas
 */
if (statsRoutes) {
  router.use("/stats", statsRoutes);
  console.log("✅ Rotas de estatísticas registradas");
}

/**
 * Rotas de pagamentos
 */
if (paymentRoutes) {
  router.use("/pagamentos", paymentRoutes);
  console.log("✅ Rotas de pagamentos registradas");
}

/**
 * Rotas básicas de usuário - ÚLTIMO (mais genéricas)
 */
if (usuarioRoutes) {
  router.use("/", usuarioRoutes);
  console.log("✅ Rotas básicas de usuário registradas");
} else {
  console.error("❌ CRÍTICO: usuario-routes não disponível");
}

export { router as usuarioRoutes };
export default router;

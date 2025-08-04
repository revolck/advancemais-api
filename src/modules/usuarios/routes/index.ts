/**
 * Router principal do módulo de usuários - VERSÃO FUNCIONAL
 * Simplificado para eliminar o erro undefined
 *
 * @author Sistema AdvanceMais
 * @version 7.3.0 - VERSÃO QUE FUNCIONA
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
    version: "7.3.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: "POST /registrar",
        login: "POST /login",
        logout: "POST /logout",
        refresh: "POST /refresh",
      },
      profile: {
        get: "GET /perfil",
        update: "PUT /perfil",
      },
      recovery: {
        request: "POST /recuperar-senha",
        validate: "GET /recuperar-senha/validar/:token",
        reset: "POST /recuperar-senha/redefinir",
      },
    },
    status: "operational",
  });
});

// =============================================
// REGISTRO DE ROTAS BÁSICAS (ESSENCIAL)
// =============================================

console.log("🔄 Carregando rotas básicas de usuário...");

try {
  // Import das rotas básicas de forma segura
  const usuarioRoutesModule = require("./usuario-routes");
  const usuarioRoutes = usuarioRoutesModule.default || usuarioRoutesModule;

  // Verificação rigorosa antes de usar
  if (usuarioRoutes && typeof usuarioRoutes === "object" && usuarioRoutes.use) {
    router.use("/", usuarioRoutes);
    console.log("✅ Rotas básicas de usuário registradas com sucesso");
  } else {
    console.error(
      "❌ usuarioRoutes não é um Router válido:",
      typeof usuarioRoutes
    );

    // Fallback mínimo
    router.post("/registrar", (req, res) => {
      res.status(503).json({
        success: false,
        message: "Serviço de registro temporariamente indisponível",
        error: "Erro de configuração interna",
      });
    });

    router.post("/login", (req, res) => {
      res.status(503).json({
        success: false,
        message: "Serviço de login temporariamente indisponível",
        error: "Erro de configuração interna",
      });
    });
  }
} catch (error) {
  console.error("❌ ERRO CRÍTICO ao carregar usuario-routes:", error);

  // Fallback de emergência
  router.all("*", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Módulo de usuários temporariamente indisponível",
      error: "Erro interno de configuração",
      timestamp: new Date().toISOString(),
      suggestion: "Contate o administrador do sistema",
    });
  });
}

export { router as usuarioRoutes };
export default router;

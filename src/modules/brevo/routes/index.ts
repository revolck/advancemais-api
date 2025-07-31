import { Router } from "express";
import { BrevoHealthController } from "../controllers/health-controller";
import { WelcomeEmailMiddleware } from "../middlewares/welcome-email-middleware";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { brevoModule } from "../index";

/**
 * Router principal do módulo Brevo
 *
 * Rotas disponíveis:
 * - GET /health - Health check básico
 * - GET /health/detailed - Health check detalhado
 * - GET /health/test - Teste de envio (desenvolvimento)
 * - GET /config - Configurações (ADMIN apenas)
 * - POST /test/email - Teste de email (desenvolvimento)
 * - POST /test/sms - Teste de SMS (desenvolvimento)
 * - GET /stats - Estatísticas de envio (ADMIN/MODERADOR)
 *
 * @author Sistema AdvanceMais
 * @version 2.0.0
 */
const router = Router();

// Instancia o controller de health check
const healthController = BrevoHealthController.create();

// =============================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// =============================================

/**
 * Rota principal do módulo - informações básicas
 * GET /brevo
 */
router.get("/", (req, res) => {
  res.json({
    module: "Brevo Communication Module",
    version: "2.0.0",
    description:
      "Módulo integrado para envio de emails e SMS via Brevo (ex-Sendinblue)",
    timestamp: new Date().toISOString(),

    endpoints: {
      health: "/brevo/health",
      detailedHealth: "/brevo/health/detailed",
      config: "/brevo/config (ADMIN apenas)",
      stats: "/brevo/stats (ADMIN/MODERADOR)",
      testEmail: "/brevo/test/email (desenvolvimento)",
      testSMS: "/brevo/test/sms (desenvolvimento)",
    },

    features: [
      "Emails transacionais profissionais",
      "SMS para verificação e notificações",
      "Templates HTML responsivos",
      "Sistema de retry automático",
      "Logs completos de envios",
      "Health check e monitoramento",
      "Estatísticas de uso",
    ],

    configuration: {
      apiKey: process.env.BREVO_API_KEY
        ? "✅ Configurado"
        : "❌ Não configurado",
      fromEmail: process.env.BREVO_FROM_EMAIL || "❌ Não configurado",
      fromName: process.env.BREVO_FROM_NAME || "❌ Não configurado",
      environment: process.env.NODE_ENV,
    },
  });
});

// =============================================
// HEALTH CHECK E MONITORAMENTO
// =============================================

/**
 * Health check básico do módulo
 * GET /brevo/health
 */
router.get("/health", healthController.healthCheck);

/**
 * Health check detalhado com estatísticas
 * GET /brevo/health/detailed
 */
router.get("/health/detailed", healthController.detailedHealthCheck);

/**
 * Teste de envio em tempo real (apenas desenvolvimento)
 * GET /brevo/health/test?testType=email&email=test@example.com
 * GET /brevo/health/test?testType=sms&phone=+5511999999999
 */
router.get("/health/test", healthController.testSending);

// =============================================
// ROTAS ADMINISTRATIVAS (REQUEREM AUTENTICAÇÃO)
// =============================================

/**
 * Configurações sanitizadas do módulo (apenas ADMIN)
 * GET /brevo/config
 */
router.get(
  "/config",
  supabaseAuthMiddleware(["ADMIN"]),
  healthController.getConfig
);

/**
 * Estatísticas de envio (ADMIN e MODERADOR)
 * GET /brevo/stats
 */
router.get(
  "/stats",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      console.log("📊 Obtendo estatísticas do módulo Brevo...");

      const stats = await brevoModule.getStats();

      res.json({
        message: "Estatísticas do módulo Brevo",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Erro ao obter estatísticas:", error);
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Refresh do módulo - limpa caches e reinicializa (apenas ADMIN)
 * POST /brevo/refresh
 */
router.post("/refresh", supabaseAuthMiddleware(["ADMIN"]), async (req, res) => {
  try {
    console.log("🔄 Executando refresh do módulo Brevo...");

    await brevoModule.refresh();

    res.json({
      message: "Módulo Brevo reinicializado com sucesso",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro no refresh do módulo:", error);
    res.status(500).json({
      message: "Erro ao reinicializar módulo",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// =============================================
// ROTAS DE TESTE (APENAS DESENVOLVIMENTO)
// =============================================

/**
 * Teste de envio de email com dados customizados
 * POST /brevo/test/email
 * Body: { email, subject, message, name? }
 */
router.post("/test/email", async (req, res) => {
  try {
    // Bloqueia em produção
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        message: "Testes não disponíveis em produção",
        environment: process.env.NODE_ENV,
      });
    }

    const { email, subject, message, name } = req.body;

    if (!email || !subject || !message) {
      return res.status(400).json({
        message: "Campos obrigatórios: email, subject, message",
        example: {
          email: "test@example.com",
          subject: "Teste de Email",
          message: "Esta é uma mensagem de teste",
          name: "Nome do Destinatário (opcional)",
        },
      });
    }

    console.log(`🧪 Teste de email solicitado para: ${email}`);

    const result = await brevoModule.sendEmail({
      to: email,
      toName: name || "Teste",
      subject: `🧪 ${subject}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4CAF50;">🧪 Teste de Email - AdvanceMais</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Mensagem:</strong></p>
            <p>${message}</p>
          </div>
          <hr>
          <p style="font-size: 12px; color: #666;">
            Teste enviado em: ${new Date().toLocaleString("pt-BR")}<br>
            Módulo: Brevo v2.0.0
          </p>
        </div>
      `,
      textContent: `TESTE DE EMAIL\n\n${message}\n\nTeste enviado em: ${new Date().toLocaleString(
        "pt-BR"
      )}`,
      tags: ["teste", "desenvolvimento"],
    });

    res.json({
      message: "Teste de email executado",
      result,
      requestData: { email, subject, name },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro no teste de email:", error);
    res.status(500).json({
      message: "Erro no teste de email",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * Teste de envio de SMS com dados customizados
 * POST /brevo/test/sms
 * Body: { phone, message, type? }
 */
router.post("/test/sms", async (req, res) => {
  try {
    // Bloqueia em produção
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        message: "Testes não disponíveis em produção",
        environment: process.env.NODE_ENV,
      });
    }

    const { phone, message, type = "transac" } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        message: "Campos obrigatórios: phone, message",
        example: {
          phone: "+5511999999999",
          message: "Teste de SMS",
          type: "transac (opcional)",
        },
      });
    }

    console.log(`🧪 Teste de SMS solicitado para: ${phone}`);

    const result = await brevoModule.sendSMS({
      to: phone,
      message: `🧪 TESTE SMS: ${message} - ${new Date().toLocaleTimeString(
        "pt-BR"
      )}`,
      type: type as "transac" | "marketing",
      tag: "teste",
    });

    res.json({
      message: "Teste de SMS executado",
      result,
      requestData: { phone, message, type },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro no teste de SMS:", error);
    res.status(500).json({
      message: "Erro no teste de SMS",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * Teste do middleware de email de boas-vindas
 * POST /brevo/test/welcome-email
 * Body: { email, nomeCompleto, tipoUsuario? }
 */
router.post(
  "/test/welcome-email",
  WelcomeEmailMiddleware.testeEnvio,
  (req, res) => {
    res.json({
      message: "Teste de email de boas-vindas iniciado",
      note: "Confira os logs do servidor para acompanhar o processo",
      timestamp: new Date().toISOString(),
    });
  }
);

// =============================================
// ROTAS DE WEBHOOK (FUTURO)
// =============================================

/**
 * Webhook para eventos do Brevo (futuro)
 * POST /brevo/webhook
 */
router.post("/webhook", (req, res) => {
  // Por enquanto apenas confirma recebimento
  console.log("📥 Webhook recebido do Brevo:", req.body);

  res.status(200).json({
    message: "Webhook recebido",
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// MIDDLEWARE DE ERRO GLOBAL
// =============================================

/**
 * Middleware de tratamento de erros específico do módulo
 */
router.use((error: any, req: any, res: any, next: any) => {
  console.error("❌ Erro no módulo Brevo:", error);

  res.status(500).json({
    module: "brevo",
    message: "Erro interno do módulo Brevo",
    error: error instanceof Error ? error.message : "Erro desconhecido",
    timestamp: new Date().toISOString(),
    path: req.path,
  });
});

// =============================================
// TRATAMENTO DE ROTAS NÃO ENCONTRADAS
// =============================================

/**
 * Catch-all para rotas não encontradas no módulo
 */
router.all("*", (req, res) => {
  res.status(404).json({
    module: "brevo",
    message: "Rota não encontrada no módulo Brevo",
    path: req.path,
    method: req.method,
    availableRoutes: [
      "GET /brevo",
      "GET /brevo/health",
      "GET /brevo/health/detailed",
      "GET /brevo/health/test",
      "GET /brevo/config (ADMIN)",
      "GET /brevo/stats (ADMIN/MODERADOR)",
      "POST /brevo/refresh (ADMIN)",
      "POST /brevo/test/email (desenvolvimento)",
      "POST /brevo/test/sms (desenvolvimento)",
      "POST /brevo/test/welcome-email (desenvolvimento)",
    ],
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// EXPORTAÇÃO E INFORMAÇÕES
// =============================================

export default router;

/**
 * Informações do router para logging
 */
export const BrevoRouterInfo = {
  name: "BrevoRouter",
  version: "2.0.0",
  description: "Router completo para o módulo Brevo",
  totalRoutes: 12,
  publicRoutes: 4,
  protectedRoutes: 3,
  testRoutes: 5,
  features: [
    "Health check completo",
    "Monitoramento em tempo real",
    "Testes de envio",
    "Estatísticas de uso",
    "Configuração sanitizada",
    "Refresh de módulo",
    "Webhook endpoints",
  ],
} as const;

console.log(`
🛣️  Router do módulo Brevo carregado!

📋 Resumo das rotas:
   ✅ ${BrevoRouterInfo.totalRoutes} rotas totais
   🌐 ${BrevoRouterInfo.publicRoutes} rotas públicas
   🔒 ${BrevoRouterInfo.protectedRoutes} rotas protegidas
   🧪 ${BrevoRouterInfo.testRoutes} rotas de teste

🔧 Principais endpoints:
   - GET /brevo - Informações do módulo
   - GET /brevo/health - Health check
   - GET /brevo/stats - Estatísticas (ADMIN)
   - POST /brevo/test/email - Teste de email (dev)
   - POST /brevo/test/sms - Teste de SMS (dev)

Version: ${BrevoRouterInfo.version}
`);

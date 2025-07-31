import { Router } from "express";
import { BrevoHealthController } from "../controllers/health-controller";
import { WelcomeEmailMiddleware } from "../middlewares/welcome-email-middleware";
import { supabaseAuthMiddleware } from "../../usuarios/auth";
import { brevoModule } from "../index";

/**
 * Router do módulo Brevo - Versão Corrigida
 *
 * Rotas simples e diretas para comunicação via email e SMS
 * Seguindo princípios de microserviços: simples, direto e seguro
 *
 * @author Sistema AdvanceMais
 * @version 2.0.1
 */
const router = Router();

// Cria instância do health controller
const healthController = BrevoHealthController.create();

// =============================================
// ROTAS BÁSICAS - SEM PARÂMETROS
// =============================================

/**
 * Informações básicas do módulo
 * GET /brevo
 */
router.get("/", (req, res) => {
  res.json({
    module: "Brevo Communication Module",
    version: "2.0.1",
    status: "active",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      config: "/config (ADMIN)",
      stats: "/stats (ADMIN/MODERADOR)",
      testEmail: "/test/email (dev)",
      testSMS: "/test/sms (dev)",
    },
  });
});

/**
 * Health check básico
 * GET /brevo/health
 */
router.get("/health", healthController.healthCheck);

/**
 * Health check detalhado
 * GET /brevo/health/detailed
 */
router.get("/health/detailed", healthController.detailedHealthCheck);

/**
 * Teste de conectividade (apenas desenvolvimento)
 * GET /brevo/health/test
 */
router.get("/health/test", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      message: "Testes não disponíveis em produção",
    });
  }

  try {
    const health = await brevoModule.healthCheck();
    res.json({
      message: "Teste de conectividade",
      results: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      message: "Erro no teste",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// =============================================
// ROTAS ADMINISTRATIVAS
// =============================================

/**
 * Configurações do módulo (apenas ADMIN)
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
      const stats = await brevoModule.getStats();
      res.json({
        message: "Estatísticas do módulo Brevo",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        message: "Erro ao obter estatísticas",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Reinicialização do módulo (apenas ADMIN)
 * POST /brevo/refresh
 */
router.post("/refresh", supabaseAuthMiddleware(["ADMIN"]), async (req, res) => {
  try {
    await brevoModule.refresh();
    res.json({
      message: "Módulo reinicializado com sucesso",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
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
 * Teste de email direto
 * POST /brevo/test/email
 */
router.post("/test/email", async (req, res) => {
  // Bloqueia em produção
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      message: "Testes não disponíveis em produção",
    });
  }

  try {
    const { email, subject, message, name } = req.body;

    // Validação de campos obrigatórios
    if (!email || !subject || !message) {
      return res.status(400).json({
        message: "Campos obrigatórios: email, subject, message",
        example: {
          email: "test@example.com",
          subject: "Teste de Email",
          message: "Mensagem de teste",
          name: "Nome (opcional)",
        },
      });
    }

    console.log(`🧪 Teste de email solicitado para: ${email}`);

    // Envia email usando o módulo
    const result = await brevoModule.sendEmail({
      to: email,
      toName: name || "Teste",
      subject: `🧪 ${subject}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #4CAF50;">🧪 Teste de Email - AdvanceMais</h2>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Mensagem:</strong></p>
            <p>${message}</p>
          </div>
          <hr>
          <p style="font-size: 12px; color: #666;">
            Teste enviado em: ${new Date().toLocaleString("pt-BR")}<br>
            Módulo: Brevo v2.0.1
          </p>
        </div>
      `,
      textContent: `TESTE DE EMAIL\n\n${message}\n\nEnviado em: ${new Date().toLocaleString(
        "pt-BR"
      )}`,
      tags: ["teste"],
    });

    res.json({
      message: "Teste de email executado",
      success: result.success,
      messageId: result.messageId,
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
 * Teste de SMS
 * POST /brevo/test/sms
 */
router.post("/test/sms", async (req, res) => {
  // Bloqueia em produção
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      message: "Testes não disponíveis em produção",
    });
  }

  try {
    const { phone, message } = req.body;

    // Validação de campos obrigatórios
    if (!phone || !message) {
      return res.status(400).json({
        message: "Campos obrigatórios: phone, message",
        example: {
          phone: "+5511999999999",
          message: "Mensagem de teste",
        },
      });
    }

    console.log(`🧪 Teste de SMS solicitado para: ${phone}`);

    // Envia SMS usando o módulo
    const result = await brevoModule.sendSMS({
      to: phone,
      message: `🧪 TESTE SMS: ${message} - ${new Date().toLocaleTimeString(
        "pt-BR"
      )}`,
      tag: "teste",
    });

    res.json({
      message: "Teste de SMS executado",
      success: result.success,
      messageId: result.messageId,
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
 * Teste de email de boas-vindas
 * POST /brevo/test/welcome-email
 */
router.post("/test/welcome-email", async (req, res) => {
  // Bloqueia em produção
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      message: "Testes não disponíveis em produção",
    });
  }

  try {
    const { email, nomeCompleto, tipoUsuario } = req.body;

    // Validação de campos obrigatórios
    if (!email || !nomeCompleto) {
      return res.status(400).json({
        message: "Campos obrigatórios: email, nomeCompleto",
        example: {
          email: "test@example.com",
          nomeCompleto: "João Silva",
          tipoUsuario: "PESSOA_FISICA (opcional)",
        },
      });
    }

    // Simula dados de usuário para teste
    res.locals.usuarioCriado = {
      usuario: {
        id: `test-${Date.now()}`,
        email,
        nomeCompleto,
        tipoUsuario: tipoUsuario || "PESSOA_FISICA",
        status: "ATIVO",
      },
    };

    console.log(`🧪 Teste de email de boas-vindas para: ${email}`);

    // Executa middleware de envio
    const middleware = WelcomeEmailMiddleware.create();
    await middleware(req, res, () => {
      // Next function - não faz nada
    });

    res.json({
      message: "Teste de email de boas-vindas iniciado",
      note: "Verifique os logs para acompanhar o processo",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro no teste de boas-vindas:", error);
    res.status(500).json({
      message: "Erro no teste de email de boas-vindas",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

// =============================================
// WEBHOOK (FUTURO)
// =============================================

/**
 * Webhook para eventos do Brevo
 * POST /brevo/webhook
 */
router.post("/webhook", (req, res) => {
  console.log("📥 Webhook Brevo recebido:", req.body);
  res.status(200).json({
    message: "Webhook recebido",
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// TRATAMENTO DE ERROS
// =============================================

/**
 * Middleware de erro específico do módulo
 */
router.use((error: any, req: any, res: any, next: any) => {
  console.error("❌ Erro no módulo Brevo:", error);

  res.status(500).json({
    module: "brevo",
    message: "Erro interno do módulo",
    error:
      process.env.NODE_ENV === "development" ? error.message : "Erro interno",
    timestamp: new Date().toISOString(),
  });
});

export default router;

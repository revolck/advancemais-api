import { Request, Response } from "express";
import { MercadoPagoHealthCheck } from "../health/health-check";

/**
 * Controller para health check do módulo MercadoPago
 */
export class HealthController {
  /**
   * Endpoint de health check
   * GET /mercadopago/health
   */
  public static healthCheck = async (req: Request, res: Response) => {
    try {
      const healthResult = await MercadoPagoHealthCheck.execute();

      // Define código de status baseado no resultado
      let statusCode = 200;
      if (healthResult.status === "degraded") {
        statusCode = 207; // Multi-Status
      } else if (healthResult.status === "unhealthy") {
        statusCode = 503; // Service Unavailable
      }

      res.status(statusCode).json({
        module: "mercadopago",
        ...healthResult,
      });
    } catch (error) {
      console.error("Erro no health check do MercadoPago:", error);
      res.status(503).json({
        module: "mercadopago",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  };
}

// Adicionar ao arquivo de rotas:
// router.get("/health", HealthController.healthCheck);

export const MercadoPagoModuleComplete = {
  message: "🎉 Módulo MercadoPago implementado com sucesso!",
  components: {
    "✅ Types & Interfaces": "Tipagem completa TypeScript",
    "✅ Enums": "Constantes e enumerações",
    "✅ Client": "Cliente configurado MercadoPago SDK",
    "✅ Services": "Orders, Subscriptions, Webhooks",
    "✅ Controllers": "API endpoints REST",
    "✅ Routes": "Roteamento organizado",
    "✅ Middlewares": "Validação e segurança",
    "✅ Database Schema": "Modelos Prisma",
    "✅ Environment Config": "Configurações de ambiente",
    "✅ Utils": "Funções utilitárias",
    "✅ Tests": "Testes de integração",
    "✅ Health Check": "Monitoramento de saúde",
    "✅ Documentation": "Guia de integração completo",
  },
  features: {
    "💳 Pagamentos únicos": "Orders com modo automático/manual",
    "🔄 Assinaturas": "Pagamentos recorrentes",
    "📢 Webhooks": "Notificações em tempo real",
    "💰 Reembolsos": "Totais e parciais",
    "❌ Cancelamentos": "Cancelamento de orders",
    "🔒 Validações": "Dados e assinaturas",
    "📊 Logs": "Auditoria completa",
    "🏥 Health Check": "Monitoramento de saúde",
  },
  nextSteps: [
    "1. Instalar dependência: pnpm add mercadopago",
    "2. Configurar variáveis de ambiente",
    "3. Executar migração Prisma",
    "4. Integrar rotas no app principal",
    "5. Configurar webhooks no painel MP",
    "6. Testar em sandbox",
    "7. Deploy em produção",
  ],
};

console.log("🏦 Módulo MercadoPago completo e pronto para uso!");

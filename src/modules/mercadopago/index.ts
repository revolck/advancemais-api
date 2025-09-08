/**
 * Módulo MercadoPago - Exportações principais
 *
 * Este módulo fornece integração completa com o MercadoPago, incluindo:
 * - Orders (pagamentos únicos) com modo automático e manual
 * - Assinaturas (pagamentos recorrentes)
 * - Webhooks para notificações em tempo real
 * - Reembolsos totais e parciais
 * - Cancelamentos
 * - Configurações e validações
 *
 * @author Revolck
 * @version 1.0.0
 */

// Types e Interfaces
export * from "./types/order";

// Enums
export * from "./enums";

// Client
export { MercadoPagoClient } from "./client/mercadopago-client";

// Services
export { OrdersService } from "./services/orders-service";
export { SubscriptionService } from "./services/subscription-service";
export { WebhookService } from "./services/webhook-service";
export { PlanService } from "./services/plan-service";

// Controllers
export {
  OrdersController,
  SubscriptionController,
  WebhookController,
  ConfigController,
  PlanController,
} from "./controllers";

// Middlewares
export {
  WebhookValidationMiddleware,
  PaymentValidationMiddleware,
} from "./middlewares";

// Routes
export { mercadoPagoRoutes } from "./routes";

// Utilities e Helpers (se necessário)
export * from "./utils";

/**
 * Configuração principal do módulo
 */
export const MercadoPagoModule = {
  name: "MercadoPago",
  version: "1.0.0",
  description:
    "Módulo de integração com MercadoPago para pagamentos e assinaturas",
  features: [
    "Orders (pagamentos únicos)",
    "Assinaturas (pagamentos recorrentes)",
    "Webhooks em tempo real",
    "Reembolsos e cancelamentos",
    "Validação de dados",
    "Logs e auditoria",
  ],
  endpoints: {
    orders: "/api/v1/mercadopago/orders",
    subscriptions: "/api/v1/mercadopago/subscriptions",
    webhooks: "/api/v1/mercadopago/webhooks",
    config: "/api/v1/mercadopago/config",
  },
} as const;

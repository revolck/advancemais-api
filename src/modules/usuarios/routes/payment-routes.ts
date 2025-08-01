/**
 * Rotas de pagamento - Integração com MercadoPago
 * Responsabilidade única: operações de pagamento do usuário
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
import { Router } from "express";
import { supabaseAuthMiddleware } from "../auth";
import { PaymentController } from "../controllers/payment-controller";

const router = Router();
const paymentController = new PaymentController();

// =============================================
// MIDDLEWARE DE SEGURANÇA
// =============================================

/**
 * Todas as rotas de pagamento requerem autenticação
 */
router.use(supabaseAuthMiddleware());

// =============================================
// ROTAS DE PAGAMENTO
// =============================================

/**
 * Processar pagamento de curso individual
 * POST /pagamentos/curso
 */
router.post("/curso", paymentController.processarPagamentoCurso);

/**
 * Criar assinatura premium
 * POST /pagamentos/assinatura
 */
router.post("/assinatura", paymentController.criarAssinaturaPremium);

/**
 * Cancelar assinatura
 * PUT /pagamentos/assinatura/cancelar
 */
router.put("/assinatura/cancelar", paymentController.cancelarAssinatura);

/**
 * Histórico de pagamentos do usuário logado
 * GET /pagamentos/historico
 */
router.get("/historico", paymentController.listarHistoricoPagamentos);

export { router as paymentRoutes };

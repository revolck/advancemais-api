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
/**
 * @openapi
 * /api/v1/usuarios/pagamentos/curso:
 *   post:
 *     summary: Processar pagamento de curso
 *     tags: [Usuários - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pagamento processado
 */
router.post("/curso", paymentController.processarPagamentoCurso);

/**
 * Criar assinatura premium
 * POST /pagamentos/assinatura
 */
/**
 * @openapi
 * /api/v1/usuarios/pagamentos/assinatura:
 *   post:
 *     summary: Criar assinatura premium
 *     tags: [Usuários - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Assinatura criada
 */
router.post("/assinatura", paymentController.criarAssinaturaPremium);

/**
 * Cancelar assinatura
 * PUT /pagamentos/assinatura/cancelar
 */
/**
 * @openapi
 * /api/v1/usuarios/pagamentos/assinatura/cancelar:
 *   put:
 *     summary: Cancelar assinatura
 *     tags: [Usuários - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assinatura cancelada
 */
router.put("/assinatura/cancelar", paymentController.cancelarAssinatura);

/**
 * Histórico de pagamentos do usuário logado
 * GET /pagamentos/historico
 */
/**
 * @openapi
 * /api/v1/usuarios/pagamentos/historico:
 *   get:
 *     summary: Listar histórico de pagamentos
 *     tags: [Usuários - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Histórico de pagamentos
 */
router.get("/historico", paymentController.listarHistoricoPagamentos);

export { router as paymentRoutes };

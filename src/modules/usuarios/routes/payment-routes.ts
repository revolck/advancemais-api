/**
 * Rotas de pagamento - Integração com MercadoPago
 * Responsabilidade única: operações de pagamento do usuário
 *
 * @author Sistema Advance+
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
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/UserCoursePaymentRequest'
  *     responses:
  *       201:
  *         description: Pagamento processado
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UserCoursePaymentResponse'
  *       400:
  *         description: Erro ao processar pagamento
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/pagamentos/curso" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"cursoId":"curso-uuid","paymentToken":"tok_123","paymentMethodId":"visa"}'
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
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/UserSubscriptionCreateRequest'
  *     responses:
  *       201:
  *         description: Assinatura criada
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UserSubscriptionCreateResponse'
  *       400:
  *         description: Erro ao criar assinatura
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/pagamentos/assinatura" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"plano":"plano-premium","cardToken":"tok_123"}'
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
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/UserSubscriptionCancelRequest'
  *     responses:
  *       200:
  *         description: Assinatura cancelada
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UserSubscriptionCancelResponse'
  *       404:
  *         description: Assinatura não encontrada
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/usuarios/pagamentos/assinatura/cancelar" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"subscriptionId":"sub-123"}'
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
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/UserPaymentHistoryResponse'
  *       500:
  *         description: Erro ao listar histórico
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/pagamentos/historico" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/historico", paymentController.listarHistoricoPagamentos);

export { router as paymentRoutes };

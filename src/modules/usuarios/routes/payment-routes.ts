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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cursoId: { type: string, example: "curso-uuid" }
 *               paymentToken: { type: string, example: "tok_123" }
 *               paymentMethodId: { type: string, example: "visa" }
 *               installments: { type: integer, example: 1 }
 *               issuerId: { type: string, example: "issuer" }
 *     responses:
 *       200:
 *         description: Pagamento processado
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
 *             type: object
 *             properties:
 *               plano: { type: string, example: "plano-premium" }
 *               cardToken: { type: string, example: "tok_123" }
 *               frequencia: { type: integer, example: 1 }
 *               periodo: { type: string, example: "months" }
 *     responses:
 *       201:
 *         description: Assinatura criada
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
 *             type: object
 *             properties:
 *               subscriptionId: { type: string, example: "sub-123" }
 *               motivo: { type: string, example: "Opção" }
 *     responses:
 *       200:
 *         description: Assinatura cancelada
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/pagamentos/historico" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/historico", paymentController.listarHistoricoPagamentos);

export { router as paymentRoutes };

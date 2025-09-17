import { Router } from 'express';
import { AssinaturasController } from '@/modules/mercadopago/assinaturas/controllers/assinaturas.controller';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';

const router = Router();
const adminRoles = ['ADMIN', 'MODERADOR'];
const empresaRoles = ['ADMIN', 'MODERADOR', 'EMPRESA', 'RECRUTADOR'];

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/checkout:
 *   post:
 *     summary: Iniciar checkout de assinatura
 *     description: "Inicia o fluxo de assinatura de um plano empresarial usando Mercado Pago. Em pagamentos por boleto, o plano só é ativado após confirmação via webhook."
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuarioId: { type: string, format: uuid }
 *               planoEmpresarialId: { type: string, format: uuid }
 *               metodoPagamento: { $ref: '#/components/schemas/MetodoPagamento' }
 *               modeloPagamento: { $ref: '#/components/schemas/ModeloPagamento' }
 *               successUrl: { type: string, format: uri }
 *               failureUrl: { type: string, format: uri }
 *               pendingUrl: { type: string, format: uri }
 *     responses:
 *       201:
 *         description: Checkout iniciado
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/checkout', supabaseAuthMiddleware(empresaRoles), AssinaturasController.checkout);

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/webhook:
 *   post:
 *     summary: Webhook de notificações do Mercado Pago
 *     description: "Recebe eventos de pagamento/assinatura e atualiza o status do plano do cliente."
 *     tags: [MercadoPago - Assinaturas]
 *     responses:
 *       200:
 *         description: Evento recebido
 */
router.post('/webhook', AssinaturasController.webhook);

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/cancelar:
 *   post:
 *     summary: Cancelar assinatura
 *     description: "Cancela o plano ativo do cliente. Todas as vagas PUBLICADO/EM_ANALISE são colocadas em RASCUNHO."
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuarioId: { type: string, format: uuid }
 *               motivo: { type: string }
 *     responses:
 *       200:
 *         description: Assinatura cancelada
 */
router.post('/cancelar', supabaseAuthMiddleware(empresaRoles), AssinaturasController.cancel);

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/upgrade:
 *   post:
 *     summary: Upgrade de plano
 *     description: "Realiza upgrade do plano do cliente sem alterar status das vagas."
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuarioId: { type: string, format: uuid }
 *               novoPlanoEmpresarialId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Upgrade efetuado
 */
router.post('/upgrade', supabaseAuthMiddleware(empresaRoles), AssinaturasController.upgrade);

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/downgrade:
 *   post:
 *     summary: Downgrade de plano
 *     description: "Realiza downgrade do plano do cliente e coloca vagas PUBLICADO/EM_ANALISE em RASCUNHO."
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuarioId: { type: string, format: uuid }
 *               novoPlanoEmpresarialId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Downgrade efetuado
 */
router.post('/downgrade', supabaseAuthMiddleware(empresaRoles), AssinaturasController.downgrade);

/**
 * @openapi
 * /api/v1/mercadopago/assinaturas/reconcile:
 *   post:
 *     summary: Reconciliação de assinaturas
 *     description: "Processa pendências: aplica cancelamento após 5 dias sem pagamento e normaliza estados."
 *     tags: [MercadoPago - Assinaturas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reconciliação realizada
 */
router.post('/reconcile', supabaseAuthMiddleware(adminRoles), AssinaturasController.reconcile);

export { router as assinaturasRoutes };


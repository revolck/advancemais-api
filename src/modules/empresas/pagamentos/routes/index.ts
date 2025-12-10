import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { listarPagamentos, listarPlanos } from '../controllers/pagamentos.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/empresas/pagamentos:
 *   get:
 *     summary: Listar histórico de pagamentos da empresa
 *     description: |
 *       Retorna o histórico de pagamentos/transações da empresa autenticada.
 *       Inclui resumo com totais e paginação.
 *     tags: [Empresas - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Itens por página
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [CHECKOUT_START, PAYMENT_CREATED, PAYMENT_APPROVED, PAYMENT_REJECTED, PAYMENT_CANCELLED]
 *         description: Filtrar por tipo de evento
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDENTE, EM_PROCESSAMENTO, APROVADO, RECUSADO, CANCELADO]
 *         description: Filtrar por status
 *       - in: query
 *         name: dataInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (YYYY-MM-DD)
 *       - in: query
 *         name: dataFim
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (YYYY-MM-DD)
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: (Apenas ADMIN/MODERADOR) ID da empresa
 *       - in: query
 *         name: metodo
 *         schema:
 *           type: string
 *           enum: [pix, boleto, bolbradesco, credit_card, debit_card]
 *         description: Filtrar por método de pagamento
 *       - in: query
 *         name: planoId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por plano específico
 *       - in: query
 *         name: valorMin
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Valor mínimo em reais
 *       - in: query
 *         name: valorMax
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Valor máximo em reais
 *     responses:
 *       200:
 *         description: Histórico de pagamentos retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     pagamentos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           tipo:
 *                             type: string
 *                           tipoDescricao:
 *                             type: string
 *                           status:
 *                             type: string
 *                           statusDescricao:
 *                             type: string
 *                           valor:
 *                             type: number
 *                           valorFormatado:
 *                             type: string
 *                           metodo:
 *                             type: string
 *                           metodoDescricao:
 *                             type: string
 *                           plano:
 *                             type: object
 *                           criadoEm:
 *                             type: string
 *                     resumo:
 *                       type: object
 *                       properties:
 *                         totalPago:
 *                           type: number
 *                         totalPendente:
 *                           type: number
 *                         totalTransacoes:
 *                           type: integer
 *                         ultimoPagamento:
 *                           type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get('/', supabaseAuthMiddleware(['EMPRESA', 'ADMIN', 'MODERADOR']), listarPagamentos);

/**
 * @openapi
 * /api/v1/empresas/pagamentos/planos:
 *   get:
 *     summary: Listar planos da empresa
 *     description: |
 *       Retorna o histórico de planos contratados pela empresa autenticada.
 *       Útil para popular o filtro de planos no frontend.
 *     tags: [Empresas - Pagamentos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: (Apenas ADMIN/MODERADOR) ID da empresa
 *     responses:
 *       200:
 *         description: Lista de planos retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       nome:
 *                         type: string
 *                         example: "Plano Play"
 *                       valor:
 *                         type: string
 *                         example: "20.00"
 *                       status:
 *                         type: string
 *                         example: "ATIVO"
 *                       statusPagamento:
 *                         type: string
 *                         example: "APROVADO"
 *                       inicio:
 *                         type: string
 *                         format: date-time
 *                       fim:
 *                         type: string
 *                         format: date-time
 *                       proximaCobranca:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get('/planos', supabaseAuthMiddleware(['EMPRESA', 'ADMIN', 'MODERADOR']), listarPlanos);

export { router as pagamentosRoutes };


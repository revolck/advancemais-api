import { Router } from 'express';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { CartoesController } from '../controllers/cartoes.controller';

const router = Router();

// Todas as rotas requerem autenticação como EMPRESA
const empresaOnly = supabaseAuthMiddleware([Roles.EMPRESA]);

/**
 * @openapi
 * /api/v1/empresas/cartoes:
 *   get:
 *     summary: Listar cartões cadastrados
 *     description: |
 *       Retorna todos os cartões de crédito/débito cadastrados pela empresa autenticada.
 *       Cartões são usados para cobranças automáticas de renovação de planos.
 *     tags: [Empresas - Cartões]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cartões
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
 *                       ultimos4Digitos:
 *                         type: string
 *                         example: "1234"
 *                       bandeira:
 *                         type: string
 *                         example: "Visa"
 *                       nomeNoCartao:
 *                         type: string
 *                       mesExpiracao:
 *                         type: string
 *                         example: "12"
 *                       anoExpiracao:
 *                         type: string
 *                         example: "2026"
 *                       isPadrao:
 *                         type: boolean
 *                       criadoEm:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso exclusivo para empresas
 */
router.get('/', empresaOnly, CartoesController.listar);

/**
 * @openapi
 * /api/v1/empresas/cartoes:
 *   post:
 *     summary: Adicionar novo cartão
 *     description: |
 *       Adiciona um novo cartão de crédito/débito para a empresa.
 *       O cartão é tokenizado no frontend via SDK do Mercado Pago antes de enviar.
 *     tags: [Empresas - Cartões]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token gerado pelo SDK do Mercado Pago
 *               isPadrao:
 *                 type: boolean
 *                 default: false
 *                 description: Define como cartão padrão
 *     responses:
 *       201:
 *         description: Cartão adicionado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 cartao:
 *                   type: object
 *       400:
 *         description: Token inválido ou dados incorretos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso exclusivo para empresas
 */
router.post('/', empresaOnly, CartoesController.adicionar);

/**
 * @openapi
 * /api/v1/empresas/cartoes/{id}/padrao:
 *   put:
 *     summary: Definir cartão como padrão
 *     description: Define um cartão como padrão para cobranças automáticas
 *     tags: [Empresas - Cartões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cartão definido como padrão
 *       404:
 *         description: Cartão não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso exclusivo para empresas
 */
router.put('/:id/padrao', empresaOnly, CartoesController.definirPadrao);

/**
 * @openapi
 * /api/v1/empresas/cartoes/{id}:
 *   delete:
 *     summary: Remover cartão
 *     description: |
 *       Remove um cartão cadastrado.
 *       Não é possível remover o cartão padrão se houver outros cartões cadastrados.
 *     tags: [Empresas - Cartões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cartão removido com sucesso
 *       400:
 *         description: Não é possível remover o cartão padrão
 *       404:
 *         description: Cartão não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso exclusivo para empresas
 */
router.delete('/:id', empresaOnly, CartoesController.remover);

/**
 * @openapi
 * /api/v1/empresas/cartoes/{id}/pagar-pendente:
 *   post:
 *     summary: Pagar fatura pendente com cartão específico
 *     description: |
 *       Processa pagamento de fatura atrasada usando um cartão específico.
 *       Útil quando empresa tem plano SUSPENSO e deseja reativar pagando com um cartão.
 *     tags: [Empresas - Cartões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do cartão a ser usado para pagamento
 *     responses:
 *       200:
 *         description: Pagamento processado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     pagamento:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         status:
 *                           type: string
 *                         valor:
 *                           type: number
 *                     plano:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         proximaCobranca:
 *                           type: string
 *       400:
 *         description: Nenhum pagamento pendente ou pagamento falhou
 *       404:
 *         description: Cartão não encontrado
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso exclusivo para empresas
 */
router.post('/:id/pagar-pendente', empresaOnly, CartoesController.pagarPendente);

export { router as cartoesRoutes };


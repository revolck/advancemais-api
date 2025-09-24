import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { CuponsController } from '@/modules/cupons/controllers/cupons.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/cupons:
 *   get:
 *     summary: Listar cupons de desconto cadastrados
 *     description: "Retorna todos os cupons de desconto disponíveis para gestão administrativa. Requer autenticação e perfil ADMIN ou MODERADOR."
 *     tags: [Comercial - Cupons de Desconto]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cupons de desconto
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CupomDesconto'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Permissões insuficientes para acessar os cupons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/cupons" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get('/', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), CuponsController.list);

/**
 * @openapi
 * /api/v1/cupons/{id}:
 *   get:
 *     summary: Buscar um cupom de desconto pelo identificador
 *     tags: [Comercial - Cupons de Desconto]
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
 *         description: Cupom de desconto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CupomDesconto'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Permissões insuficientes para acessar os cupons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Cupom não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), CuponsController.get);

/**
 * @openapi
 * /api/v1/cupons:
 *   post:
 *     summary: Criar um novo cupom de desconto
 *     description: "Cria um cupom de desconto configurável para assinatura ou cursos. Disponível apenas para usuários com papel ADMIN ou MODERADOR."
 *     tags: [Comercial - Cupons de Desconto]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CupomDescontoCreateInput'
 *     responses:
 *       201:
 *         description: Cupom criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CupomDesconto'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Permissões insuficientes para criar cupons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       409:
 *         description: Código de cupom já utilizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CupomDescontoDuplicateResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/cupons" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "codigo": "ADVANCE50",
 *                  "tipoDesconto": "PORCENTAGEM",
 *                  "valorPercentual": 50,
 *                  "aplicarEm": "APENAS_ASSINATURA",
 *                  "aplicarEmTodosItens": false,
 *                  "planosIds": ["11111111-1111-1111-1111-111111111111"],
 *                  "limiteUsoTotalTipo": "LIMITADO",
 *                  "limiteUsoTotalQuantidade": 100,
 *                  "limitePorUsuarioTipo": "PRIMEIRA_COMPRA",
 *                  "periodoTipo": "PERIODO",
 *                  "periodoInicio": "2025-01-01T00:00:00.000Z",
 *                  "periodoFim": "2025-03-01T23:59:59.000Z"
 *                }'
 */
router.post('/', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), CuponsController.create);

/**
 * @openapi
 * /api/v1/cupons/{id}:
 *   put:
 *     summary: Atualizar um cupom de desconto existente
 *     tags: [Comercial - Cupons de Desconto]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CupomDescontoUpdateInput'
 *     responses:
 *       200:
 *         description: Cupom atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CupomDesconto'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Permissões insuficientes para atualizar cupons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Cupom não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Código de cupom já utilizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CupomDescontoDuplicateResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), CuponsController.update);

/**
 * @openapi
 * /api/v1/cupons/{id}:
 *   delete:
 *     summary: Remover um cupom de desconto
 *     tags: [Comercial - Cupons de Desconto]
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
 *       204:
 *         description: Cupom removido com sucesso
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Permissões insuficientes para remover cupons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Cupom não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), CuponsController.remove);

export { router as cuponsRoutes };

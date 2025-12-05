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
 *     tags: [Comercial]
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
 *     tags: [Comercial]
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
 *     tags: [Comercial]
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
 *     tags: [Comercial]
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
 *     tags: [Comercial]
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

/**
 * @openapi
 * /api/v1/cupons/validar:
 *   post:
 *     summary: Validar um cupom de desconto para checkout
 *     description: |
 *       Valida se um cupom de desconto pode ser utilizado no checkout de planos empresariais.
 *       Verifica:
 *       - Se o cupom existe e está ativo
 *       - Se está dentro do período de validade
 *       - Se não atingiu o limite de uso
 *       - Se é aplicável a planos empresariais (não apenas cursos)
 *       - Se é válido para o plano específico selecionado
 *       - Se o usuário pode usar (primeira compra, limite por usuário)
 *       
 *       Disponível para usuários com role EMPRESA.
 *     tags: [Comercial]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *             properties:
 *               codigo:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 40
 *                 description: Código do cupom de desconto
 *                 example: "ADVANCE50"
 *               planosEmpresariaisId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do plano empresarial para validar se o cupom é aplicável
 *                 example: "11111111-1111-1111-1111-111111111111"
 *     responses:
 *       200:
 *         description: Cupom válido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 valido:
 *                   type: boolean
 *                   example: true
 *                 cupom:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     codigo:
 *                       type: string
 *                       example: "ADVANCE50"
 *                     descricao:
 *                       type: string
 *                       nullable: true
 *                       example: "50% de desconto na primeira assinatura"
 *                     tipoDesconto:
 *                       type: string
 *                       enum: [PORCENTAGEM, VALOR_FIXO]
 *                       example: "PORCENTAGEM"
 *                     valorPercentual:
 *                       type: number
 *                       nullable: true
 *                       example: 50
 *                     valorFixo:
 *                       type: number
 *                       nullable: true
 *                       example: null
 *                     aplicarEm:
 *                       type: string
 *                       enum: [TODA_PLATAFORMA, APENAS_ASSINATURA, APENAS_CURSOS]
 *                       example: "APENAS_ASSINATURA"
 *       400:
 *         description: Cupom inválido ou não aplicável
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 code:
 *                   type: string
 *                   enum:
 *                     - VALIDATION_ERROR
 *                     - CUPOM_NAO_ENCONTRADO
 *                     - CUPOM_INATIVO
 *                     - CUPOM_AINDA_NAO_VALIDO
 *                     - CUPOM_EXPIRADO
 *                     - CUPOM_ESGOTADO
 *                     - CUPOM_NAO_APLICAVEL
 *                     - CUPOM_NAO_APLICAVEL_PLANO
 *                     - CUPOM_APENAS_PRIMEIRA_COMPRA
 *                   example: "CUPOM_NAO_ENCONTRADO"
 *                 message:
 *                   type: string
 *                   example: "Cupom não encontrado"
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
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
 *           curl -X POST "http://localhost:3000/api/v1/cupons/validar" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "codigo": "ADVANCE50",
 *                  "planosEmpresariaisId": "11111111-1111-1111-1111-111111111111"
 *                }'
 */
router.post('/validar', supabaseAuthMiddleware(['EMPRESA']), CuponsController.validar);

export { router as cuponsRoutes };

import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { ClientesController } from '@/modules/empresas/clientes/controllers/clientes.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/empresas/clientes:
 *   get:
 *     summary: Listar clientes (empresas) vinculados a planos pagos
 *     description: "Retorna o histórico de vinculações de planos de assinatura para clientes (empresas). Por padrão retorna apenas assinaturas de clientes pagantes (modo CLIENTE), mas é possível filtrar por outros modos quando necessário. Endpoint restrito a administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Clientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: usuarioId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Filtra os registros pelo identificador do cliente (empresa - PJ)"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ATIVO, SUSPENSO, EXPIRADO, CANCELADO]
 *         description: "Quando informado, filtra pelo status do vínculo do plano"
 *       - in: query
 *         name: modo
 *         schema:
 *           type: string
 *           enum: [CLIENTE, TESTE, PARCEIRO]
 *         description: "Permite consultar vínculos em outros modos (teste ou parceiro). O padrão é CLIENTE."
 *     responses:
 *       200:
 *         description: Lista de planos de assinatura vinculados ao cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmpresaClientePlano'
 *       400:
 *         description: Parâmetros inválidos
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
 *         description: Acesso negado por falta de permissões válidas
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
 */
router.get('/', supabaseAuthMiddleware(adminRoles), ClientesController.list);

/**
 * @openapi
 * /api/v1/empresas/clientes/{id}:
 *   get:
 *     summary: Consultar vinculação de plano de um cliente
 *     description: "Endpoint restrito a administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Clientes]
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
 *         description: Plano de assinatura encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaClientePlano'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Plano de assinatura não encontrado
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
router.get('/:id', supabaseAuthMiddleware(adminRoles), ClientesController.get);

/**
 * @openapi
 * /api/v1/empresas/clientes:
 *   post:
 *     summary: Vincular plano a um cliente
 *     description: "Disponibiliza o acesso temporário ou permanente aos recursos do plano empresarial selecionado para o cliente informado. Endpoint restrito a administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Clientes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaClientePlanoCreateInput'
 *     responses:
 *       201:
 *         description: Plano de assinatura vinculado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaClientePlano'
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Empresa ou plano empresarial não encontrado
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/empresas/clientes" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "usuarioId": "f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1",
 *                  "planosEmpresariaisId": "31b3b0e1-4d9d-4a3c-9a77-51b872d59bf0",
 *                  "modo": "CLIENTE",
 *                  "diasTeste": 7
 *                }'
 */
router.post('/', supabaseAuthMiddleware(adminRoles), ClientesController.assign);

/**
 * @openapi
 * /api/v1/empresas/clientes/{id}:
 *   put:
 *     summary: Atualizar vinculação de plano do cliente
 *     description: "Endpoint restrito a administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Clientes]
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
 *             $ref: '#/components/schemas/EmpresaClientePlanoUpdateInput'
 *     responses:
 *       200:
 *         description: Plano de assinatura atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaClientePlano'
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
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Plano de assinatura ou referência não encontrada
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/clientes/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "modo": "PARCEIRO"
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(adminRoles), ClientesController.update);

/**
 * @openapi
 * /api/v1/empresas/clientes/{id}:
 *   delete:
 *     summary: Encerrar vínculo de plano do cliente
 *     description: "Endpoint restrito a administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Clientes]
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
 *         description: Plano encerrado com sucesso
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Acesso negado por falta de permissões válidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Plano de assinatura não encontrado
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/clientes/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(adminRoles), ClientesController.deactivate);

export { router as clientesRoutes };

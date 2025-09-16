import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { PlanosParceiroController } from '@/modules/empresas/planos-parceiro/controllers/planos-parceiro.controller';

const router = Router();
const adminRoles = ['ADMIN', 'MODERADOR'];

/**
 * @openapi
 * /api/v1/empresas/planos-parceiro:
 *   get:
 *     summary: Listar vinculações de planos parceiros
 *     description: Retorna o histórico de planos parceiros atribuídos às empresas. Permite filtrar por empresa e status atual.
 *     tags: [Empresas - Planos Parceiro]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: empresaId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtra os registros pelo identificador da empresa
 *       - in: query
 *         name: ativo
 *         schema:
 *           type: boolean
 *         description: Quando informado, retorna apenas os registros com o status ativo correspondente
 *     responses:
 *       200:
 *         description: Lista de planos parceiros vinculados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmpresaPlanoParceiro'
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
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', supabaseAuthMiddleware(adminRoles), PlanosParceiroController.list);

/**
 * @openapi
 * /api/v1/empresas/planos-parceiro/{id}:
 *   get:
 *     summary: Consultar plano parceiro de uma empresa
 *     tags: [Empresas - Planos Parceiro]
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
 *         description: Plano parceiro encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanoParceiro'
 *       401:
 *         description: Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Plano parceiro não encontrado
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
router.get('/:id', supabaseAuthMiddleware(adminRoles), PlanosParceiroController.get);

/**
 * @openapi
 * /api/v1/empresas/planos-parceiro:
 *   post:
 *     summary: Vincular plano parceiro a uma empresa
 *     description: Disponibiliza o acesso temporário ou permanente aos recursos do plano empresarial selecionado para a empresa informada.
 *     tags: [Empresas - Planos Parceiro]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmpresaPlanoParceiroCreateInput'
 *     responses:
 *       201:
 *         description: Plano parceiro vinculado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanoParceiro'
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
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *           curl -X POST "http://localhost:3000/api/v1/empresas/planos-parceiro" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "empresaId": "f1d7a9c2-4e0b-4f6d-90ad-8c6b84a0f1a1",
 *                  "planoEmpresarialId": "31b3b0e1-4d9d-4a3c-9a77-51b872d59bf0",
 *                  "tipo": "7_dias",
 *                  "observacao": "Período de teste liberado pela equipe comercial"
 *                }'
 */
router.post('/', supabaseAuthMiddleware(adminRoles), PlanosParceiroController.assign);

/**
 * @openapi
 * /api/v1/empresas/planos-parceiro/{id}:
 *   put:
 *     summary: Atualizar plano parceiro da empresa
 *     tags: [Empresas - Planos Parceiro]
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
 *             $ref: '#/components/schemas/EmpresaPlanoParceiroUpdateInput'
 *     responses:
 *       200:
 *         description: Plano parceiro atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmpresaPlanoParceiro'
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
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Plano parceiro ou referência não encontrada
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
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/planos-parceiro/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "tipo": "parceiro",
 *                  "observacao": "Parceiro oficial da Advance+"
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(adminRoles), PlanosParceiroController.update);

/**
 * @openapi
 * /api/v1/empresas/planos-parceiro/{id}:
 *   delete:
 *     summary: Encerrar o plano parceiro da empresa
 *     tags: [Empresas - Planos Parceiro]
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
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Plano parceiro não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/planos-parceiro/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(adminRoles), PlanosParceiroController.deactivate);

export { router as planosParceiroRoutes };

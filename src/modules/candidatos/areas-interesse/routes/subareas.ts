import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';

import { AreasInteresseController } from '../controllers/areas-interesse.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse/{subareaId}:
 *   put:
 *     summary: Atualizar subárea de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subareaId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Identificador da subárea de interesse
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidatoSubareaInteresseUpdateInput'
 *     responses:
 *       200:
 *         description: Subárea atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoSubareaInteresse'
 *             examples:
 *               exemplo:
 *                 summary: Subárea atualizada
 *                 value:
 *                   id: 98
 *                   areaId: 10
 *                   nome: Segurança da Informação
 *                   vagasRelacionadas: []
 *                   criadoEm: '2024-05-10T12:00:00.000Z'
 *                   atualizadoEm: '2024-05-12T14:20:00.000Z'
 *       400:
 *         description: Dados inválidos para atualização ou identificador incorreto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Token de autenticação ausente ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Usuário sem permissão para executar a ação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Subárea de interesse não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao atualizar subárea
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/candidatos/subareas-interesse/98" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{
 *                  "nome": "Segurança da Informação"
 *                }'
 */
router.put(
  '/:subareaId',
  supabaseAuthMiddleware(adminRoles),
  AreasInteresseController.updateSubarea,
);

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse/{subareaId}:
 *   delete:
 *     summary: Remover subárea de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subareaId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Identificador da subárea de interesse
 *     responses:
 *       204:
 *         description: Subárea removida com sucesso
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token de autenticação ausente ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedResponse'
 *       403:
 *         description: Usuário sem permissão para executar a ação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenResponse'
 *       404:
 *         description: Subárea de interesse não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao remover subárea
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X DELETE "http://localhost:3000/api/v1/candidatos/subareas-interesse/98" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete(
  '/:subareaId',
  supabaseAuthMiddleware(adminRoles),
  AreasInteresseController.removeSubarea,
);

export { router as subareasInteresseRoutes };

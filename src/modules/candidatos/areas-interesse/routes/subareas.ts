import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';

import { AreasInteresseController } from '../controllers/areas-interesse.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse:
 *   get:
 *     summary: Listar subáreas de interesse
 *     description: Retorna lista de todas as subáreas de interesse disponíveis
 *     tags: [Candidatos]
 *     parameters:
 *       - in: query
 *         name: areaId
 *         schema: { type: integer }
 *         description: Filtrar por área de interesse específica
 *     responses:
 *       200:
 *         description: Lista de subáreas de interesse
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CandidatoSubareaInteresse'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/', AreasInteresseController.listSubareas);

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse/{subareaId}:
 *   get:
 *     summary: Obter subárea de interesse por ID
 *     description: Retorna dados de uma subárea específica
 *     tags: [Candidatos]
 *     parameters:
 *       - in: path
 *         name: subareaId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Subárea encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoSubareaInteresse'
 *       404:
 *         description: Subárea não encontrada
 */
router.get('/:subareaId', AreasInteresseController.getSubarea);

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse:
 *   post:
 *     summary: Criar nova subárea de interesse
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Candidatos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidatoSubareaInteresseCreateInput'
 *     responses:
 *       201:
 *         description: Subárea criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoSubareaInteresse'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.post('/', supabaseAuthMiddleware(adminRoles), AreasInteresseController.createSubarea);

/**
 * @openapi
 * /api/v1/candidatos/subareas-interesse/{subareaId}:
 *   put:
 *     summary: Atualizar subárea de interesse
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Candidatos]
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
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Candidatos]
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

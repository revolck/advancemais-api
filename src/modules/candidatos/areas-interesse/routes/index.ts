import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { Roles } from '@/modules/usuarios/enums/Roles';

import { AreasInteresseController } from '../controllers/areas-interesse.controller';

const router = Router();
const adminRoles = [Roles.ADMIN, Roles.MODERADOR];

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse:
 *   get:
 *     summary: Listar áreas de interesse publicadas
 *     tags: [Candidatos - Áreas de Interesse]
 *     responses:
 *       200:
 *         description: Lista de áreas de interesse disponíveis para candidatos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CandidatoAreaInteresse'
 *             examples:
 *               exemplo:
 *                 summary: Áreas de interesse disponíveis
 *                 value:
 *                   - id: 1
 *                     categoria: Tecnologia da Informação
 *                     subareas:
 *                       - id: 10
 *                         areaId: 1
 *                         nome: Desenvolvimento de Software
 *                         vagasRelacionadas:
 *                           - cb94b4e2-7f9c-4ee5-a5be-0fda6b0c5489
 *                         criadoEm: '2024-01-01T12:00:00.000Z'
 *                         atualizadoEm: '2024-02-15T08:30:00.000Z'
 *                     vagasRelacionadas:
 *                       - 62baf310-49b0-4d3f-b493-4230ae5cb3a3
 *                     criadoEm: '2024-01-01T12:00:00.000Z'
 *                     atualizadoEm: '2024-02-15T08:30:00.000Z'
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
 *           curl -X GET "http://localhost:3000/api/v1/candidatos/areas-interesse"
 */
router.get('/', publicCache, AreasInteresseController.list);

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse/{id}:
 *   get:
 *     summary: Obter área de interesse por ID
 *     tags: [Candidatos - Áreas de Interesse]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador da área de interesse
 *     responses:
 *       200:
 *         description: Área de interesse encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoAreaInteresse'
 *             examples:
 *               exemplo:
 *                 summary: Área de interesse com subáreas detalhadas
 *                 value:
 *                   id: 1
 *                   categoria: Tecnologia da Informação
 *                   subareas:
 *                     - id: 10
 *                       areaId: 1
 *                       nome: Desenvolvimento de Software
 *                       vagasRelacionadas:
 *                         - cb94b4e2-7f9c-4ee5-a5be-0fda6b0c5489
 *                       criadoEm: '2024-01-01T12:00:00.000Z'
 *                       atualizadoEm: '2024-02-15T08:30:00.000Z'
 *                   vagasRelacionadas:
 *                     - 62baf310-49b0-4d3f-b493-4230ae5cb3a3
 *                   criadoEm: '2024-01-01T12:00:00.000Z'
 *                   atualizadoEm: '2024-02-15T08:30:00.000Z'
 *       400:
 *         description: Identificador inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Área de interesse não encontrada
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
 *           curl -X GET "http://localhost:3000/api/v1/candidatos/areas-interesse/1"
 */
router.get('/:id', publicCache, AreasInteresseController.get);

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse:
 *   post:
 *     summary: Criar nova área de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidatoAreaInteresseCreateInput'
 *     responses:
 *       201:
 *         description: Área de interesse criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoAreaInteresse'
 *             examples:
 *               exemplo:
 *                 summary: Área criada com subáreas normalizadas
 *                 value:
 *                   id: 8
 *                   categoria: Tecnologia da Informação
 *                   subareas:
 *                     - id: 61
 *                       areaId: 8
 *                       nome: Desenvolvimento de Software
 *                       vagasRelacionadas: []
 *                       criadoEm: '2024-04-10T10:15:00.000Z'
 *                       atualizadoEm: '2024-04-10T10:15:00.000Z'
 *                     - id: 62
 *                       areaId: 8
 *                       nome: UX/UI Design
 *                       vagasRelacionadas: []
 *                       criadoEm: '2024-04-10T10:15:00.000Z'
 *                       atualizadoEm: '2024-04-10T10:15:00.000Z'
 *                   vagasRelacionadas: []
 *                   criadoEm: '2024-04-10T10:15:00.000Z'
 *                   atualizadoEm: '2024-04-10T10:15:00.000Z'
 *       400:
 *         description: Dados inválidos para criação
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
 *           curl -X POST "http://localhost:3000/api/v1/candidatos/areas-interesse" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{
 *                  "categoria": "Tecnologia da Informação",
 *                  "subareas": [
 *                    "Desenvolvimento de Software",
 *                    "UX/UI Design"
 *                  ]
 *                }'
 */
router.post('/', supabaseAuthMiddleware(adminRoles), AreasInteresseController.create);

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse/{id}:
 *   put:
 *     summary: Atualizar área de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador da área de interesse
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CandidatoAreaInteresseUpdateInput'
 *     responses:
 *       200:
 *         description: Área de interesse atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CandidatoAreaInteresse'
 *             examples:
 *               exemplo:
 *                 summary: Área após atualização parcial
 *                 value:
 *                   id: 1
 *                   categoria: Tecnologia e Inovação
 *                   subareas:
 *                     - id: 10
 *                       areaId: 1
 *                       nome: Desenvolvimento de Software
 *                       vagasRelacionadas:
 *                         - cb94b4e2-7f9c-4ee5-a5be-0fda6b0c5489
 *                       criadoEm: '2024-01-01T12:00:00.000Z'
 *                       atualizadoEm: '2024-02-15T08:30:00.000Z'
 *                     - id: 75
 *                       areaId: 1
 *                       nome: Segurança da Informação
 *                       vagasRelacionadas: []
 *                       criadoEm: '2024-05-01T09:00:00.000Z'
 *                       atualizadoEm: '2024-05-01T09:00:00.000Z'
 *                   vagasRelacionadas:
 *                     - 62baf310-49b0-4d3f-b493-4230ae5cb3a3
 *                   criadoEm: '2024-01-01T12:00:00.000Z'
 *                   atualizadoEm: '2024-05-01T09:00:00.000Z'
 *       400:
 *         description: Dados inválidos ou nenhum campo informado
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
 *         description: Área de interesse não encontrada
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
 *           curl -X PUT "http://localhost:3000/api/v1/candidatos/areas-interesse/1" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{
 *                  "categoria": "Tecnologia",
 *                  "subareas": [
 *                    "Desenvolvimento Back-end",
 *                    "Segurança da Informação"
 *                  ]
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(adminRoles), AreasInteresseController.update);

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse/{id}:
 *   delete:
 *     summary: Remover área de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identificador da área de interesse
 *     responses:
 *       204:
 *         description: Área de interesse removida com sucesso
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
 *         description: Área de interesse não encontrada
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
 *           curl -X DELETE "http://localhost:3000/api/v1/candidatos/areas-interesse/1" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(adminRoles), AreasInteresseController.remove);

/**
 * @openapi
 * /api/v1/candidatos/areas-interesse/{areaId}/subareas:
 *   post:
 *     summary: Criar subárea vinculada a uma área de interesse
 *     description: Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR).
 *     tags: [Candidatos - Áreas de Interesse]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: areaId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Identificador da área de interesse principal
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
 *             examples:
 *               exemplo:
 *                 summary: Subárea criada
 *                 value:
 *                   id: 98
 *                   areaId: 10
 *                   nome: Desenvolvimento Back-end
 *                   vagasRelacionadas: []
 *                   criadoEm: '2024-05-10T12:00:00.000Z'
 *                   atualizadoEm: '2024-05-10T12:00:00.000Z'
 *       400:
 *         description: Dados inválidos para criação ou identificador incorreto
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
 *         description: Área de interesse não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno ao criar subárea
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/candidatos/areas-interesse/10/subareas" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{
 *                  "nome": "Desenvolvimento Back-end"
 *                }'
 */
router.post(
  '/:areaId/subareas',
  supabaseAuthMiddleware(adminRoles),
  AreasInteresseController.createSubarea,
);

export { router as areasInteresseRoutes };

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

export { router as areasInteresseRoutes };

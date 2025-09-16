import { Router } from 'express';
import { publicCache } from '../../../middlewares/cache-control';
import { supabaseAuthMiddleware } from '../../usuarios/auth';
import { TeamController } from '../controllers/team.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/website/team:
 *   get:
 *     summary: Listar membros da equipe
 *     tags: [Website - Team]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/WebsiteStatus'
 *         description: Filtra membros por status (PUBLICADO ou RASCUNHO)
 *     responses:
 *       200:
 *         description: Lista de membros
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WebsiteTeam'
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
 *           curl -X GET "http://localhost:3000/api/v1/website/team"
 */
router.get('/', publicCache, TeamController.list);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   get:
 *     summary: Obter membro da equipe por ID da ordem
 *     tags: [Website - Team]
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do membro
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membro encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/website/team/{ordemId}"
 */
router.get('/:id', publicCache, TeamController.get);

/**
 * @openapi
 * /api/v1/website/team:
 *   post:
 *     summary: Criar membro da equipe
 *     description: Cria um novo membro da equipe. O campo `status` representa o estado de publicação do membro e aceita booleano (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - Team]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTeamCreateInput'
 *     responses:
 *       201:
 *         description: Membro criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
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
 *           curl -X POST "http://localhost:3000/api/v1/website/team" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Fulano","cargo":"Dev","photoUrl":"https://cdn.example.com/team.jpg","status":"PUBLICADO"}'
 */
router.post('/', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), TeamController.create);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   put:
 *     summary: Atualizar membro da equipe
 *     description: Atualiza um membro da equipe. O campo `status` representa o estado de publicação do membro e aceita booleano (true = PUBLICADO, false = RASCUNHO) ou string.
 *     tags: [Website - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID do membro da equipe
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTeamUpdateInput'
 *     responses:
 *       200:
 *         description: Membro atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/team/{teamId}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nome":"Fulano","cargo":"Dev","photoUrl":"https://cdn.example.com/team.jpg","status":"RASCUNHO"}'
 */
router.put('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), TeamController.update);

/**
 * @openapi
 * /api/v1/website/team/{id}/reorder:
 *   put:
 *     summary: Reordenar membro da equipe
 *     description: Altera a posição do membro utilizando o ID da ordem. Caso a nova posição esteja ocupada, os demais membros serão ajustados automaticamente.
 *     tags: [Website - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: ID da ordem do membro
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WebsiteTeamReorderInput'
 *     responses:
 *       200:
 *         description: Membro reordenado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebsiteTeam'
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X PUT "http://localhost:3000/api/v1/website/team/{ordemId}/reorder" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"ordem":2}'
 */
router.put('/:id/reorder', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), TeamController.reorder);

/**
 * @openapi
 * /api/v1/website/team/{id}:
 *   delete:
 *     summary: Remover membro da equipe
 *     tags: [Website - Team]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Membro removido
 *       404:
 *         description: Membro não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/website/team/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), TeamController.remove);

export { router as teamRoutes };

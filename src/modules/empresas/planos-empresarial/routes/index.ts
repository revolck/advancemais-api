import { Router } from 'express';

import { publicCache } from '@/middlewares/cache-control';
import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { PlanosEmpresariaisController } from '@/modules/empresas/planos-empresarial/controllers/planos-empresariais.controller';

const router = Router();

/**
 * @openapi
 * /api/v1/empresas/planos-empresarial:
 *   get:
 *     summary: Listar planos empresariais disponíveis
 *     description: "Retorna todos os planos empresariais configurados, incluindo regras de publicação de vagas. A tabela está limitada a no máximo 4 registros. Endpoint público, não requer autenticação."
 *     tags: [Empresas - Planos Empresariais]
 *     responses:
 *       200:
 *         description: Lista de planos empresariais
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlanoEmpresarial'
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
 *           curl -X GET "http://localhost:3000/api/v1/empresas/planos-empresarial"
 */
router.get('/', publicCache, PlanosEmpresariaisController.list);

/**
 * @openapi
 * /api/v1/empresas/planos-empresarial/{id}:
 *   get:
 *     summary: Obter plano empresarial por ID
 *     tags: [Empresas - Planos Empresariais]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plano empresarial encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanoEmpresarial'
 *       404:
 *         description: Plano não encontrado
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
 *           curl -X GET "http://localhost:3000/api/v1/empresas/planos-empresarial/{id}"
 */
router.get('/:id', publicCache, PlanosEmpresariaisController.get);

/**
 * @openapi
 * /api/v1/empresas/planos-empresarial:
 *   post:
 *     summary: Criar um novo plano empresarial
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR). A criação respeita o limite máximo de 4 planos ativos e permite definir descontos percentuais e regras de publicação de vagas."
 *     tags: [Empresas - Planos Empresariais]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanoEmpresarialCreateInput'
 *     responses:
 *       201:
 *         description: Plano empresarial criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanoEmpresarial'
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
 *       409:
 *         description: Limite máximo de planos atingido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanoEmpresarialLimitResponse'
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
 *           curl -X POST "http://localhost:3000/api/v1/empresas/planos-empresarial" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "icon": "ph-buildings",
 *                  "nome": "Plano Corporativo",
 *                  "descricao": "Soluções completas para empresas",
 *                  "valor": "199.90",
 *                  "desconto": 10,
 *                  "quantidadeVagas": 10,
 *                  "vagaEmDestaque": true,
 *                  "quantidadeVagasDestaque": 2
 *                }'
 */
router.post('/', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), PlanosEmpresariaisController.create);

/**
 * @openapi
 * /api/v1/empresas/planos-empresarial/{id}:
 *   put:
 *     summary: Atualizar plano empresarial
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Planos Empresariais]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanoEmpresarialUpdateInput'
 *     responses:
 *       200:
 *         description: Plano empresarial atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanoEmpresarial'
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
 *       404:
 *         description: Plano não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/empresas/planos-empresarial/{id}" \
 *            -H "Authorization: Bearer <TOKEN>" \
 *            -H "Content-Type: application/json" \
 *            -d '{
 *                  "descricao": "Atualização do pacote corporativo",
 *                  "valor": "249.90",
 *                  "desconto": null,
 *                  "vagaEmDestaque": false
 *                }'
 */
router.put('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), PlanosEmpresariaisController.update);

/**
 * @openapi
 * /api/v1/empresas/planos-empresarial/{id}:
 *   delete:
 *     summary: Remover plano empresarial
 *     description: "Disponível apenas para administradores e moderadores (roles: ADMIN, MODERADOR)."
 *     tags: [Empresas - Planos Empresariais]
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
 *         description: Plano removido com sucesso
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
 *         description: Plano não encontrado
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
 *           curl -X DELETE "http://localhost:3000/api/v1/empresas/planos-empresarial/{id}" \
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.delete('/:id', supabaseAuthMiddleware(['ADMIN', 'MODERADOR']), PlanosEmpresariaisController.remove);

export { router as planosEmpresariaisRoutes };

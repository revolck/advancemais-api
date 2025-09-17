import { Router } from 'express';

import { supabaseAuthMiddleware } from '@/modules/usuarios/auth';
import { AdminEmpresasController } from '@/modules/empresas/admin/controllers/admin-empresas.controller';

const router = Router();
const adminRoles = ['ADMIN', 'MODERADOR'];

/**
 * @openapi
 * /api/v1/empresas/admin:
 *   get:
 *     summary: (Admin) Listar empresas
 *     description: "Retorna empresas (Pessoa Jurídica) com dados resumidos do plano ativo. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     tags: [Empresas - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página atual da paginação
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Quantidade de registros por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: "Filtro por nome, código da empresa, e-mail ou CNPJ"
 *     responses:
 *       200:
 *         description: Empresas listadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresasListResponse'
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
router.get('/', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.list);

/**
 * @openapi
 * /api/v1/empresas/admin/{id}:
 *   get:
 *     summary: (Admin) Detalhes completos da empresa
 *     description: "Retorna informações completas da empresa incluindo plano ativo, pagamentos e métricas. Endpoint restrito aos perfis ADMIN e MODERADOR."
 *     tags: [Empresas - Admin]
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
 *         description: Empresa encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminEmpresaDetailResponse'
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
 *       404:
 *         description: Empresa não encontrada
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
router.get('/:id', supabaseAuthMiddleware(adminRoles), AdminEmpresasController.get);

export { router as adminEmpresasRoutes };

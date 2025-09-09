/**
 * Rotas administrativas - Gestão de usuários
 * Responsabilidade única: operações administrativas
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Router } from "express";
import { supabaseAuthMiddleware } from "../auth";
import { AdminController } from "../controllers/admin-controller";

const router = Router();
const adminController = new AdminController();

// =============================================
// MIDDLEWARES DE SEGURANÇA
// =============================================

/**
 * Todas as rotas admin requerem pelo menos role MODERADOR
 */
router.use(supabaseAuthMiddleware(["ADMIN", "MODERADOR"]));

// =============================================
// ROTAS DE LISTAGEM E CONSULTA
// =============================================

/**
 * Área administrativa principal
 * GET /admin
 */
/**
 * @openapi
 * /api/v1/usuarios/admin:
  *   get:
  *     summary: Informações do painel administrativo
  *     tags: [Usuários - Admin]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Detalhes do painel
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/AdminModuleInfo'
  *       500:
  *         description: Erro interno
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/", adminController.getAdminInfo);

/**
 * Listar usuários com filtros
 * GET /admin/usuarios
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios:
  *   get:
  *     summary: Listar usuários
  *     tags: [Usuários - Admin]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: query
  *         name: page
  *         schema:
  *           type: integer
  *           example: 1
  *       - in: query
  *         name: limit
  *         schema:
  *           type: integer
  *           example: 50
  *       - in: query
  *         name: status
  *         schema:
  *           type: string
  *           example: ATIVO
  *       - in: query
  *         name: role
  *         schema:
  *           type: string
  *           example: ADMIN
  *       - in: query
  *         name: tipoUsuario
  *         schema:
  *           type: string
  *           example: PESSOA_FISICA
  *     responses:
  *       200:
  *         description: Lista de usuários
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/AdminUserListResponse'
  *       500:
  *         description: Erro ao listar usuários
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/usuarios" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/usuarios", adminController.listarUsuarios);

/**
 * Buscar usuário específico por ID
 * GET /admin/usuarios/:userId
 */
/**
 * @openapi
  * /api/v1/usuarios/admin/usuarios/{userId}:
  *   get:
  *     summary: Buscar usuário por ID
  *     tags: [Usuários - Admin]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: userId
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       200:
  *         description: Usuário encontrado
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/AdminUserDetailResponse'
  *       404:
  *         description: Usuário não encontrado
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
  *       500:
  *         description: Erro interno
  *         content:
  *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get("/usuarios/:userId", adminController.buscarUsuario);

// =============================================
// ROTAS DE MODIFICAÇÃO (APENAS ADMIN)
// =============================================

/**
 * Atualizar status de usuário
 * PATCH /admin/usuarios/:userId/status
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}/status:
 *   patch:
 *     summary: Atualizar status de usuário
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminStatusUpdateRequest'
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminStatusUpdateResponse'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}/status" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"status":"ATIVO"}'
 */
router.patch(
  "/usuarios/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  adminController.atualizarStatus
);

/**
 * Atualizar role de usuário
 * PATCH /admin/usuarios/:userId/role
 */
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}/role:
 *   patch:
 *     summary: Atualizar role de usuário
 *     tags: [Usuários - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminRoleUpdateRequest'
 *     responses:
 *       200:
 *         description: Role atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminRoleUpdateResponse'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PATCH "http://localhost:3000/api/v1/usuarios/admin/usuarios/{userId}/role" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"role":"MODERADOR"}'
 */
router.patch(
  "/usuarios/:userId/role",
  supabaseAuthMiddleware(["ADMIN"]),
  adminController.atualizarRole
);

export { router as adminRoutes };

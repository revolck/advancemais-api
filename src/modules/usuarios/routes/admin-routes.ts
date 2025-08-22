/**
 * Rotas administrativas - Gestão de usuários
 * Responsabilidade única: operações administrativas
 *
 * @author Sistema AdvanceMais
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
 *     responses:
 *       200:
 *         description: Lista de usuários
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
 */
router.get("/usuarios/:userId", adminController.buscarUsuario);

/**
 * Histórico de pagamentos de usuário
 * GET /admin/usuarios/:userId/pagamentos
 */
router.get(
  "/usuarios/:userId/pagamentos",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR", "FINANCEIRO"]),
  adminController.historicoPagamentosUsuario
);
/**
 * @openapi
 * /api/v1/usuarios/admin/usuarios/{userId}/pagamentos:
 *   get:
 *     summary: Histórico de pagamentos do usuário
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
 *         description: Histórico retornado
 */

// =============================================
// ROTAS DE MODIFICAÇÃO (APENAS ADMIN)
// =============================================

/**
 * Atualizar status de usuário
 * PATCH /admin/usuarios/:userId/status
 */
router.patch(
  "/usuarios/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  adminController.atualizarStatus
);
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
 *     responses:
 *       200:
 *         description: Status atualizado
 */

/**
 * Atualizar role de usuário
 * PATCH /admin/usuarios/:userId/role
 */
router.patch(
  "/usuarios/:userId/role",
  supabaseAuthMiddleware(["ADMIN"]),
  adminController.atualizarRole
);
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
 *     responses:
 *       200:
 *         description: Role atualizada
 */

export { router as adminRoutes };

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
router.get("/", adminController.getAdminInfo);

/**
 * Listar usuários com filtros
 * GET /admin/usuarios
 */
router.get("/usuarios", adminController.listarUsuarios);

/**
 * Buscar usuário específico por ID
 * GET /admin/usuarios/:userId
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
 * Atualizar role de usuário
 * PATCH /admin/usuarios/:userId/role
 */
router.patch(
  "/usuarios/:userId/role",
  supabaseAuthMiddleware(["ADMIN"]),
  adminController.atualizarRole
);

export { router as adminRoutes };

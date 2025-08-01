/**
 * Router principal do módulo de usuários
 * Centraliza e organiza todas as sub-rotas
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0 - Refatorado para microserviços
 */
import { Router } from "express";
import { usuarioRoutes } from "./usuario-routes";
import { adminRoutes } from "./admin-routes";
import { paymentRoutes } from "./payment-routes";
import { statsRoutes } from "./stats-routes";

const router = Router();

/**
 * Rotas básicas de usuário
 * - Registro, login, perfil
 * - Recuperação de senha
 */
router.use("/", usuarioRoutes);

/**
 * Rotas administrativas
 * - Gestão de usuários
 * - Alteração de status/roles
 */
router.use("/admin", adminRoutes);

/**
 * Rotas de pagamentos
 * - Integração com MercadoPago
 * - Assinaturas e cursos
 */
router.use("/pagamentos", paymentRoutes);

/**
 * Rotas de estatísticas
 * - Dashboard stats
 * - Relatórios
 */
router.use("/stats", statsRoutes);

export { router as usuarioRoutes };
export default router;

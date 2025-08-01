/**
 * Rotas básicas de usuário - CRUD e autenticação
 * Responsabilidade única: operações essenciais do usuário
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
import { Router } from "express";
import { criarUsuario } from "../register";
import {
  loginUsuario,
  logoutUsuario,
  refreshToken,
  obterPerfil,
} from "../controllers";
import { authMiddleware } from "../middlewares";
import { supabaseAuthMiddleware } from "../auth";
import { WelcomeEmailMiddleware } from "../../brevo/middlewares/welcome-email-middleware";
import passwordRecoveryRoutes from "./password-recovery";

const router = Router();

// =============================================
// ROTAS PÚBLICAS - Sem autenticação
// =============================================

/**
 * Registro de novo usuário
 * POST /registrar
 */
router.post("/registrar", criarUsuario, WelcomeEmailMiddleware.create());

/**
 * Login de usuário
 * POST /login
 */
router.post("/login", loginUsuario);

/**
 * Validação de refresh token
 * POST /refresh
 */
router.post("/refresh", refreshToken);

/**
 * Rotas de recuperação de senha
 * /recuperar-senha/*
 */
router.use("/recuperar-senha", passwordRecoveryRoutes);

// =============================================
// ROTAS PROTEGIDAS - Requerem autenticação
// =============================================

/**
 * Logout de usuário
 * POST /logout
 */
router.post("/logout", authMiddleware(), logoutUsuario);

/**
 * Perfil do usuário autenticado
 * GET /perfil
 */
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

export { router as usuarioRoutes };

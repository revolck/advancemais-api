import { Router } from "express";
import { criarUsuario } from "../register";
import {
  loginUsuario,
  logoutUsuario,
  refreshToken,
  obterPerfil,
} from "../controllers";
import { supabaseAuthMiddleware } from "../../../modules/superbase/middleware";
import { prisma } from "../../../config/prisma";

const router = Router();

/**
 * Rotas públicas (sem autenticação)
 */
router.post("/registrar", criarUsuario);
router.post("/login", loginUsuario);
router.post("/refresh", refreshToken);

/**
 * Rotas protegidas básicas
 */
router.post("/logout", supabaseAuthMiddleware(), logoutUsuario);
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

/**
 * Rotas administrativas
 */
router.get("/admin", supabaseAuthMiddleware(["ADMIN"]), (req, res) => {
  res.json({
    message: "Área administrativa",
    usuario: req.user,
    timestamp: new Date().toISOString(),
  });
});

router.get(
  "/listar",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const usuarios = await prisma.usuario.findMany({
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          tipoUsuario: true,
          criadoEm: true,
          ultimoLogin: true,
        },
        orderBy: { criadoEm: "desc" },
        take: 50,
      });

      res.json({
        message: "Lista de usuários",
        usuarios,
        total: usuarios.length,
      });
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({
        message: "Erro ao listar usuários",
        error: errorMessage,
      });
    }
  }
);

/**
 * Rotas com parâmetros - por último para evitar conflitos
 */
router.get(
  "/usuario/:userId",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          tipoUsuario: true,
          ultimoLogin: true,
          criadoEm: true,
        },
      });

      if (!usuario) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      res.json({
        message: "Usuário encontrado",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({
        message: "Erro ao buscar usuário",
        error: errorMessage,
      });
    }
  }
);

router.patch(
  "/usuario/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      const statusValidos = [
        "ATIVO",
        "INATIVO",
        "BANIDO",
        "PENDENTE",
        "SUSPENSO",
      ];

      if (!status || !statusValidos.includes(status)) {
        return res.status(400).json({
          message: "Status inválido",
          statusValidos,
        });
      }

      const usuario = await prisma.usuario.update({
        where: { id: userId },
        data: { status },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          status: true,
          atualizadoEm: true,
        },
      });

      res.json({
        message: "Status do usuário atualizado com sucesso",
        usuario,
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);

      if (
        error instanceof Error &&
        error.message.includes("Record to update not found")
      ) {
        return res.status(404).json({
          message: "Usuário não encontrado",
        });
      }

      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({
        message: "Erro ao atualizar status do usuário",
        error: errorMessage,
      });
    }
  }
);

export default router;

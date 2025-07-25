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
import { prisma } from "../../../config/prisma";

const router = Router();

/**
 * Rotas públicas (sem autenticação)
 */

// POST /registrar - Registro de novo usuário
router.post("/registrar", criarUsuario);

// POST /login - Login de usuário
router.post("/login", loginUsuario);

// POST /refresh - Validação de refresh token
router.post("/refresh", refreshToken);

/**
 * Rotas protegidas (requerem autenticação)
 */

// POST /logout - Logout de usuário
router.post("/logout", authMiddleware(), logoutUsuario);

// GET /perfil - Perfil do usuário autenticado
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

// GET /admin - Rota apenas para administradores
router.get("/admin", supabaseAuthMiddleware(["ADMIN"]), (req, res) => {
  res.json({
    message: "Área administrativa",
    usuario: req.user,
    timestamp: new Date().toISOString(),
  });
});

// GET /listar - Listar usuários (ADMIN e MODERADOR)
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
        orderBy: {
          criadoEm: "desc",
        },
        take: 50,
      });

      res.json({
        message: "Lista de usuários",
        usuarios,
        total: usuarios.length,
      });
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({
        message: "Erro ao listar usuários",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

/**
 * Rotas com parâmetros - definidas por último para evitar conflitos
 */

// GET /usuario/:userId - Buscar usuário por ID
router.get(
  "/usuario/:userId",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Validação básica do parâmetro
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
          cpf: true,
          cnpj: true,
          telefone: true,
          dataNasc: true,
          genero: true,
          matricula: true,
          role: true,
          status: true,
          tipoUsuario: true,
          supabaseId: true,
          ultimoLogin: true,
          criadoEm: true,
          atualizadoEm: true,
          empresa: {
            select: {
              id: true,
              nome: true,
            },
          },
          enderecos: {
            select: {
              id: true,
              logradouro: true,
              numero: true,
              bairro: true,
              cidade: true,
              estado: true,
              cep: true,
            },
          },
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
      res.status(500).json({
        message: "Erro ao buscar usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

// PATCH /usuario/:userId/status - Atualizar status de usuário
router.patch(
  "/usuario/:userId/status",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      // Validação básica dos parâmetros
      if (!userId || userId.trim() === "") {
        return res.status(400).json({
          message: "ID do usuário é obrigatório",
        });
      }

      // Validação de status válido
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

      res.status(500).json({
        message: "Erro ao atualizar status do usuário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }
);

export default router;

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
import { prisma } from "../../../config/prisma"; // Import adicionado

const router = Router();

/**
 * Rotas públicas (sem autenticação)
 */
// Registro de novo usuário
router.post("/registrar", criarUsuario);

// Login de usuário (validação de credenciais)
router.post("/login", loginUsuario);

// Validação de refresh token
router.post("/refresh", refreshToken);

/**
 * Rotas protegidas (requerem autenticação)
 */
// Logout de usuário (requer token válido)
router.post("/logout", authMiddleware(), logoutUsuario);

// Perfil do usuário autenticado
router.get("/perfil", supabaseAuthMiddleware(), obterPerfil);

// Rota apenas para administradores (exemplo)
router.get("/admin", supabaseAuthMiddleware(["ADMIN"]), (req, res) => {
  res.json({
    message: "Área administrativa",
    usuario: req.user,
    timestamp: new Date().toISOString(),
  });
});

// Rota para listar usuários (apenas ADMIN e MODERADOR)
router.get(
  "/listar",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      // Implementar paginação em produção
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
          // Não incluir dados sensíveis
        },
        orderBy: {
          criadoEm: "desc",
        },
        take: 50, // Limita a 50 registros
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
 * Rota para atualizar status de usuário (apenas ADMIN)
 */
router.patch(
  "/:id/status",
  supabaseAuthMiddleware(["ADMIN"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Validação de status válido
      const statusValidos = [
        "ATIVO",
        "INATIVO",
        "BANIDO",
        "PENDENTE",
        "SUSPENSO",
      ];
      if (!statusValidos.includes(status)) {
        return res.status(400).json({
          message: "Status inválido",
          statusValidos,
        });
      }

      const usuario = await prisma.usuario.update({
        where: { id },
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

/**
 * Rota para buscar usuário por ID (ADMIN, MODERADOR)
 */
router.get(
  "/:id",
  supabaseAuthMiddleware(["ADMIN", "MODERADOR"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const usuario = await prisma.usuario.findUnique({
        where: { id },
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

export default router;

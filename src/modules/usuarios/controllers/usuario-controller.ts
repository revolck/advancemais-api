import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../config/prisma";

/**
 * Interface para dados de login
 */
interface LoginData {
  documento: string; // CPF ou CNPJ
  senha: string;
}

/**
 * Controller para autenticação de usuários
 * Valida credenciais mas NÃO gera tokens JWT (usa apenas Supabase Auth)
 * @param req - Request object com credenciais
 * @param res - Response object
 */
export const loginUsuario = async (req: Request, res: Response) => {
  try {
    const { documento, senha }: LoginData = req.body;

    // Validação básica
    if (!documento || !senha) {
      return res.status(400).json({
        message: "Documento e senha são obrigatórios",
      });
    }

    // Remove caracteres especiais do documento para comparação
    const documentoLimpo = documento.replace(/\D/g, "");

    // Determina se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    const isCpf = documentoLimpo.length === 11;
    const isCnpj = documentoLimpo.length === 14;

    if (!isCpf && !isCnpj) {
      return res.status(400).json({
        message:
          "Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos) válido",
      });
    }

    // Busca usuário no banco
    const usuario = await prisma.usuario.findUnique({
      where: isCpf ? { cpf: documentoLimpo } : { cnpj: documentoLimpo },
      select: {
        id: true,
        email: true,
        senha: true,
        nomeCompleto: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
      },
    });

    if (!usuario) {
      return res.status(401).json({
        message: "Credenciais inválidas",
      });
    }

    // Verifica status do usuário
    if (usuario.status !== "ATIVO") {
      return res.status(403).json({
        message: `Conta ${usuario.status.toLowerCase()}. Entre em contato com o suporte.`,
      });
    }

    // Valida senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({
        message: "Credenciais inválidas",
      });
    }

    // Atualiza último login
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
      },
    });

    // Retorna dados básicos do usuário (sem tokens - usa Supabase Auth)
    res.json({
      message: "Credenciais validadas com sucesso",
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        role: usuario.role,
        tipoUsuario: usuario.tipoUsuario,
        supabaseId: usuario.supabaseId,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Controller para logout de usuários
 * Remove refresh token do banco de dados
 * @param req - Request object com dados do usuário autenticado
 * @param res - Response object
 */
export const logoutUsuario = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
      });
    }

    // Remove refresh token do banco
    await prisma.usuario.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    res.json({
      message: "Logout realizado com sucesso",
    });
  } catch (error) {
    console.error("Erro no logout:", error);
    res.status(500).json({
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Controller para renovação de tokens
 * Valida refresh token e gera novos tokens de acesso
 * @param req - Request object com refresh token
 * @param res - Response object
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token é obrigatório",
      });
    }

    // Busca usuário pelo refresh token
    const usuario = await prisma.usuario.findFirst({
      where: { refreshToken },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        supabaseId: true,
      },
    });

    if (!usuario) {
      return res.status(401).json({
        message: "Refresh token inválido",
      });
    }

    if (usuario.status !== "ATIVO") {
      return res.status(403).json({
        message: `Conta ${usuario.status.toLowerCase()}`,
      });
    }

    res.json({
      message: "Token válido",
      usuario: {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role,
        supabaseId: usuario.supabaseId,
      },
    });
  } catch (error) {
    console.error("Erro ao validar refresh token:", error);
    res.status(500).json({
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

/**
 * Controller para obter perfil do usuário autenticado
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const obterPerfil = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuário não autenticado",
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
      message: "Perfil obtido com sucesso",
      usuario,
    });
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    res.status(500).json({
      message: "Erro interno do servidor",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
};

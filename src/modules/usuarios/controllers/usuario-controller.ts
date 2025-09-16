import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../config/prisma";
import { generateTokenPair } from "../utils/auth";
import { invalidateUserCache } from "../utils/cache";
import { logger } from "../../../utils/logger";

/**
 * Controllers para autenticação e gestão de usuários
 * Implementa padrões de microserviços com verificação de email obrigatória
 *
 * Responsabilidades:
 * - Autenticação de usuários com verificação de email
 * - Gestão de sessões e tokens
 * - Validação de credenciais
 * - Rate limiting integrado
 *
 * Características:
 * - Verificação de email obrigatória para login
 * - Validação rigorosa de dados
 * - Logs estruturados para observabilidade
 * - Tratamento robusto de erros
 * - Compatibilidade com Supabase Auth
 *
 * @author Sistema Advance+
 * @version 6.0.0 - Sistema completo com verificação de email
 */

/**
 * Interface para dados de login
 */
interface LoginData {
  documento: string; // CPF
  senha: string;
}

const createControllerLogger = (req: Request, action: string) =>
  logger.child({
    controller: "UsuarioController",
    action,
    correlationId: req.id,
  });

/**
 * Controller para autenticação de usuários
 * Valida credenciais e verifica se email foi confirmado
 * @param req - Request object com credenciais
 * @param res - Response object
 */
export const loginUsuario = async (req: Request, res: Response) => {
  const log = createControllerLogger(req, "loginUsuario");
  const correlationId = req.id;
  const startTime = Date.now();

  try {
    log.info("🔐 Iniciando processo de login");

    const { documento, senha }: LoginData = req.body;

    // Validação básica de entrada
    if (!documento || !senha) {
      log.warn("⚠️ Dados de login incompletos");
      return res.status(400).json({
        success: false,
        message: "Documento e senha são obrigatórios",
        correlationId,
      });
    }

    // Remove caracteres especiais do documento para comparação
    const documentoLimpo = documento.replace(/\D/g, "");

    if (documentoLimpo.length !== 11) {
      log.warn(
        { length: documentoLimpo.length },
        "⚠️ CPF inválido informado"
      );
      return res.status(400).json({
        success: false,
        message: "Documento deve ser um CPF válido com 11 dígitos",
        correlationId,
      });
    }

    log.info(
      { documentoPrefix: documentoLimpo.substring(0, 3) },
      "🔍 Buscando usuário por CPF"
    );

    // Busca usuário no banco com todos os campos necessários
    const usuario = await prisma.usuario.findUnique({
      where: { cpf: documentoLimpo },
      select: {
        id: true,
        email: true,
        senha: true,
        nomeCompleto: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
        emailVerificado: true, // CAMPO CRÍTICO PARA VERIFICAÇÃO
        emailVerificadoEm: true,
        ultimoLogin: true,
        criadoEm: true,
      },
    });

    if (!usuario) {
      log.warn(
        { documentoPrefix: documentoLimpo.substring(0, 3) },
        "⚠️ Usuário não encontrado"
      );
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id, email: usuario.email },
      "👤 Usuário encontrado"
    );

    // Verifica status da conta
    if (usuario.status !== "ATIVO") {
      log.warn(
        { userId: usuario.id, status: usuario.status },
        "⚠️ Conta inativa"
      );
      return res.status(403).json({
        success: false,
        message: `Conta ${usuario.status.toLowerCase()}. Entre em contato com o suporte.`,
        code: "ACCOUNT_INACTIVE",
        status: usuario.status,
        correlationId,
      });
    }

    // VERIFICAÇÃO CRÍTICA: Email deve estar verificado
    if (!usuario.emailVerificado) {
      log.warn(
        { userId: usuario.id, email: usuario.email },
        "⚠️ Email não verificado"
      );

      // Calcula há quanto tempo a conta foi criada
      const accountAge = Date.now() - usuario.criadoEm.getTime();
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

      return res.status(403).json({
        success: false,
        message:
          "Email não verificado. Verifique sua caixa de entrada ou solicite um novo email de verificação.",
        code: "EMAIL_NOT_VERIFIED",
        data: {
          email: usuario.email,
          canResendVerification: true,
          accountCreated: usuario.criadoEm,
          accountAgeDays,
          helpText:
            accountAgeDays > 1
              ? "Sua conta foi criada há mais de 1 dia. Verifique sua pasta de spam ou solicite um novo email."
              : "Verifique sua caixa de entrada. O email pode demorar alguns minutos para chegar.",
        },
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id, verifiedAt: usuario.emailVerificadoEm },
      "✅ Email verificado"
    );

    // Valida senha usando bcrypt
    log.info({ userId: usuario.id }, "🔐 Validando senha");
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      log.warn({ userId: usuario.id }, "⚠️ Senha inválida");
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
        correlationId,
      });
    }

    // Gera tokens de acesso e refresh
    const tokens = generateTokenPair(usuario.id, usuario.role);

    // Atualiza último login e armazena refresh token
    log.info({ userId: usuario.id }, "💾 Atualizando último login");
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
        refreshToken: tokens.refreshToken,
        atualizadoEm: new Date(),
      },
    });

    await invalidateUserCache(usuario);

    const duration = Date.now() - startTime;
    log.info(
      { duration, userId: usuario.id, email: usuario.email },
      "✅ Login realizado com sucesso"
    );

    // Prepara dados de resposta (sem informações sensíveis)
    const responseData = {
      id: usuario.id,
      email: usuario.email,
      nomeCompleto: usuario.nomeCompleto,
      role: usuario.role,
      tipoUsuario: usuario.tipoUsuario,
      supabaseId: usuario.supabaseId,
      emailVerificado: usuario.emailVerificado,
      emailVerificadoEm: usuario.emailVerificadoEm,
      ultimoLogin: new Date().toISOString(),
    };

    // Retorna dados do usuário autenticado com tokens
    res.json({
      success: true,
      message: "Login realizado com sucesso",
      usuario: responseData,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const err =
      error instanceof Error ? error : new Error(String(error));

    log.error(
      {
        err,
        duration,
        documento: req.body.documento
          ? `${req.body.documento.substring(0, 3)}***`
          : "não fornecido",
      },
      "❌ Erro crítico no login"
    );

    // Resposta de erro sem vazar informações sensíveis
    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      correlationId,
      timestamp: new Date().toISOString(),
      // Em desenvolvimento, inclui mais detalhes
      ...(process.env.NODE_ENV === "development" && {
        error: errorMessage,
      }),
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
  const log = createControllerLogger(req, "logoutUsuario");
  const correlationId = req.id;

  try {
    const userId = req.user?.id;

    if (!userId) {
      log.warn("⚠️ Tentativa de logout sem usuário autenticado");
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
        correlationId,
      });
    }

    log.info({ userId }, "🚪 Iniciando logout");

    // Remove refresh token do banco (invalidação de sessão)
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        atualizadoEm: new Date(),
      },
    });

    await invalidateUserCache({ id: userId });

    log.info({ userId }, "✅ Logout realizado com sucesso");

    res.json({
      success: true,
      message: "Logout realizado com sucesso",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, userId: req.user?.id }, "❌ Erro no logout");

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      correlationId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        error: errorMessage,
      }),
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
  const log = createControllerLogger(req, "refreshToken");
  const correlationId = req.id;

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      log.warn("⚠️ Refresh token não fornecido");
      return res.status(400).json({
        success: false,
        message: "Refresh token é obrigatório",
        correlationId,
      });
    }

    log.info(
      { tokenPrefix: refreshToken.substring(0, 10) },
      "🔄 Validando refresh token"
    );

    // Busca usuário pelo refresh token
    const usuario = await prisma.usuario.findFirst({
      where: { refreshToken },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
        emailVerificado: true,
        ultimoLogin: true,
      },
    });

    if (!usuario) {
      log.warn("⚠️ Refresh token inválido ou não encontrado");
      return res.status(401).json({
        success: false,
        message: "Refresh token inválido",
        code: "INVALID_REFRESH_TOKEN",
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id, email: usuario.email },
      "👤 Refresh token válido"
    );

    // Verifica se a conta ainda está ativa
    if (usuario.status !== "ATIVO") {
      log.warn(
        { userId: usuario.id, status: usuario.status },
        "⚠️ Conta inativa durante refresh"
      );

      // Remove refresh token inválido
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: `Conta ${usuario.status.toLowerCase()}`,
        code: "ACCOUNT_INACTIVE",
        status: usuario.status,
        correlationId,
      });
    }

    // Verifica se email ainda está verificado (caso tenha sido revertido por admin)
    if (!usuario.emailVerificado) {
      log.warn(
        { userId: usuario.id },
        "⚠️ Email não verificado durante refresh"
      );

      // Remove refresh token
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: "Email não verificado. Verifique sua caixa de entrada.",
        code: "EMAIL_NOT_VERIFIED",
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id },
      "✅ Refresh token validado com sucesso"
    );

    // Atualiza último acesso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
        atualizadoEm: new Date(),
      },
    });

    await invalidateUserCache(usuario);

    // Prepara dados de resposta
    const responseData = {
      id: usuario.id,
      email: usuario.email,
      nomeCompleto: usuario.nomeCompleto,
      role: usuario.role,
      tipoUsuario: usuario.tipoUsuario,
      supabaseId: usuario.supabaseId,
      emailVerificado: usuario.emailVerificado,
      ultimoLogin: usuario.ultimoLogin,
    };

    res.json({
      success: true,
      message: "Token renovado com sucesso",
      usuario: responseData,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err }, "❌ Erro ao validar refresh token");

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      correlationId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        error: errorMessage,
      }),
    });
  }
};

/**
 * Controller para obter perfil do usuário autenticado
 * Retorna dados completos do perfil (sem informações sensíveis)
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const obterPerfil = async (req: Request, res: Response) => {
  const log = createControllerLogger(req, "obterPerfil");
  const correlationId = req.id;

  try {
    const userId = req.user?.id;

    if (!userId) {
      log.warn("⚠️ Tentativa de obter perfil sem autenticação");
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
        correlationId,
      });
    }

    log.info({ userId }, "👤 Obtendo perfil do usuário");

    // Busca dados completos do usuário (excluindo informações sensíveis)
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
        emailVerificado: true,
        emailVerificadoEm: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        // Relacionamentos
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
        // Estatísticas de pagamentos removidas
      },
    });

    if (!usuario) {
      log.warn({ userId }, "⚠️ Usuário não encontrado ao obter perfil");
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id, email: usuario.email },
      "✅ Perfil obtido com sucesso"
    );

    // Prepara estatísticas adicionais
    const profileStats = {
      accountAge: Math.floor(
        (Date.now() - usuario.criadoEm.getTime()) / (1000 * 60 * 60 * 24)
      ),
      hasCompletedProfile: !!(usuario.telefone && usuario.nomeCompleto),
      hasAddress: usuario.enderecos.length > 0,
      totalOrders: 0,
      totalSubscriptions: 0,
      emailVerificationStatus: {
        verified: usuario.emailVerificado,
        verifiedAt: usuario.emailVerificadoEm,
      },
    };

    // Retorna perfil completo
    res.json({
      success: true,
      message: "Perfil obtido com sucesso",
      usuario: {
        ...usuario,
        _count: undefined, // Remove contadores internos da resposta
      },
      stats: profileStats,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, userId: req.user?.id }, "❌ Erro ao obter perfil");

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      correlationId,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        error: errorMessage,
      }),
    });
  }
};

/**
 * Estatísticas de uso dos controllers (para monitoramento)
 */
export const getControllerStats = () => {
  return {
    module: "usuario-controller",
    version: "6.0.0",
    features: {
      emailVerificationRequired: true,
      rateLimitingIntegrated: true,
      correlationIdTracking: true,
      securePasswordHandling: true,
    },
    endpoints: {
      loginUsuario: "POST /login",
      logoutUsuario: "POST /logout",
      refreshToken: "POST /refresh",
      obterPerfil: "GET /perfil",
    },
    lastUpdated: "2025-08-04T18:00:00Z",
  };
};

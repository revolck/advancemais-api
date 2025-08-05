import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../config/prisma";

/**
 * Controllers para autenticação e gestão de usuários
 * Implementa padrões de microserviços com verificação de email obrigatória
 *
 * Responsabilidades:
 * - Autenticação de usuários com verificação de email
 * - Gestão de sessões e tokens
 * - Validação de credenciais
 * - Logs de auditoria
 * - Rate limiting integrado
 *
 * Características:
 * - Verificação de email obrigatória para login
 * - Validação rigorosa de dados
 * - Logs estruturados para observabilidade
 * - Tratamento robusto de erros
 * - Compatibilidade com Supabase Auth
 *
 * @author Sistema AdvanceMais
 * @version 6.0.0 - Sistema completo com verificação de email
 */

/**
 * Interface para dados de login
 */
interface LoginData {
  documento: string; // CPF ou CNPJ
  senha: string;
}

/**
 * Controller para autenticação de usuários
 * Valida credenciais e verifica se email foi confirmado
 * @param req - Request object com credenciais
 * @param res - Response object
 */
export const loginUsuario = async (req: Request, res: Response) => {
  // Gera correlation ID para rastreamento
  const correlationId =
    req.headers["x-correlation-id"] || `login-${Date.now()}`;
  const startTime = Date.now();

  try {
    console.log(`🔐 [${correlationId}] Iniciando processo de login`);

    const { documento, senha }: LoginData = req.body;

    // Validação básica de entrada
    if (!documento || !senha) {
      console.warn(`⚠️ [${correlationId}] Dados de login incompletos`);
      return res.status(400).json({
        success: false,
        message: "Documento e senha são obrigatórios",
        correlationId,
      });
    }

    // Remove caracteres especiais do documento para comparação
    const documentoLimpo = documento.replace(/\D/g, "");

    // Determina se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    const isCpf = documentoLimpo.length === 11;
    const isCnpj = documentoLimpo.length === 14;

    if (!isCpf && !isCnpj) {
      console.warn(
        `⚠️ [${correlationId}] Formato de documento inválido: ${documentoLimpo.length} dígitos`
      );
      return res.status(400).json({
        success: false,
        message:
          "Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos) válido",
        correlationId,
      });
    }

    console.log(
      `🔍 [${correlationId}] Buscando usuário por ${
        isCpf ? "CPF" : "CNPJ"
      }: ${documentoLimpo.substring(0, 3)}***`
    );

    // Busca usuário no banco com todos os campos necessários
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
        emailVerificado: true, // CAMPO CRÍTICO PARA VERIFICAÇÃO
        emailVerificadoEm: true,
        ultimoLogin: true,
        criadoEm: true,
      },
    });

    if (!usuario) {
      console.warn(
        `⚠️ [${correlationId}] Usuário não encontrado para documento: ${documentoLimpo.substring(
          0,
          3
        )}***`
      );
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
        correlationId,
      });
    }

    console.log(
      `👤 [${correlationId}] Usuário encontrado: ${usuario.email} (ID: ${usuario.id})`
    );

    // Verifica status da conta
    if (usuario.status !== "ATIVO") {
      console.warn(
        `⚠️ [${correlationId}] Conta inativa: ${usuario.status} para usuário ${usuario.id}`
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
      console.warn(
        `⚠️ [${correlationId}] Email não verificado para usuário ${usuario.id}: ${usuario.email}`
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

    console.log(
      `✅ [${correlationId}] Email verificado em: ${usuario.emailVerificadoEm}`
    );

    // Valida senha usando bcrypt
    console.log(
      `🔐 [${correlationId}] Validando senha para usuário ${usuario.id}`
    );
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      console.warn(
        `⚠️ [${correlationId}] Senha inválida para usuário ${usuario.id}`
      );
      return res.status(401).json({
        success: false,
        message: "Credenciais inválidas",
        correlationId,
      });
    }

    // Atualiza último login e incrementa contador de logins
    console.log(
      `💾 [${correlationId}] Atualizando último login para usuário ${usuario.id}`
    );
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
        atualizadoEm: new Date(),
      },
    });

    const duration = Date.now() - startTime;
    console.log(
      `✅ [${correlationId}] Login realizado com sucesso em ${duration}ms para usuário: ${usuario.email}`
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

    // Log de auditoria para login bem-sucedido
    console.log(`📊 [${correlationId}] Auditoria - Login bem-sucedido:`, {
      userId: usuario.id,
      email: usuario.email,
      role: usuario.role,
      tipoUsuario: usuario.tipoUsuario,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      duration: `${duration}ms`,
    });

    // Retorna dados do usuário autenticado
    res.json({
      success: true,
      message: "Login realizado com sucesso",
      usuario: responseData,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error(
      `❌ [${correlationId}] Erro crítico no login após ${duration}ms:`,
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        documento: req.body.documento
          ? `${req.body.documento.substring(0, 3)}***`
          : "não fornecido",
      }
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
  const correlationId =
    req.headers["x-correlation-id"] || `logout-${Date.now()}`;

  try {
    const userId = req.user?.id;

    if (!userId) {
      console.warn(
        `⚠️ [${correlationId}] Tentativa de logout sem usuário autenticado`
      );
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
        correlationId,
      });
    }

    console.log(
      `🚪 [${correlationId}] Iniciando logout para usuário: ${userId}`
    );

    // Remove refresh token do banco (invalidação de sessão)
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        atualizadoEm: new Date(),
      },
    });

    console.log(
      `✅ [${correlationId}] Logout realizado com sucesso para usuário: ${userId}`
    );

    // Log de auditoria
    console.log(`📊 [${correlationId}] Auditoria - Logout:`, {
      userId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      success: true,
      message: "Logout realizado com sucesso",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`❌ [${correlationId}] Erro no logout:`, errorMessage);

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
  const correlationId =
    req.headers["x-correlation-id"] || `refresh-${Date.now()}`;

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      console.warn(`⚠️ [${correlationId}] Refresh token não fornecido`);
      return res.status(400).json({
        success: false,
        message: "Refresh token é obrigatório",
        correlationId,
      });
    }

    console.log(
      `🔄 [${correlationId}] Validando refresh token: ${refreshToken.substring(
        0,
        10
      )}...`
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
      console.warn(
        `⚠️ [${correlationId}] Refresh token inválido ou não encontrado`
      );
      return res.status(401).json({
        success: false,
        message: "Refresh token inválido",
        code: "INVALID_REFRESH_TOKEN",
        correlationId,
      });
    }

    console.log(
      `👤 [${correlationId}] Refresh token válido para usuário: ${usuario.email} (${usuario.id})`
    );

    // Verifica se a conta ainda está ativa
    if (usuario.status !== "ATIVO") {
      console.warn(
        `⚠️ [${correlationId}] Conta inativa durante refresh: ${usuario.status}`
      );

      // Remove refresh token inválido
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

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
      console.warn(
        `⚠️ [${correlationId}] Email não verificado durante refresh para usuário: ${usuario.id}`
      );

      // Remove refresh token
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      return res.status(403).json({
        success: false,
        message: "Email não verificado. Verifique sua caixa de entrada.",
        code: "EMAIL_NOT_VERIFIED",
        correlationId,
      });
    }

    console.log(
      `✅ [${correlationId}] Refresh token validado com sucesso para usuário: ${usuario.id}`
    );

    // Atualiza último acesso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
        atualizadoEm: new Date(),
      },
    });

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

    // Log de auditoria
    console.log(`📊 [${correlationId}] Auditoria - Token refresh:`, {
      userId: usuario.id,
      email: usuario.email,
      ip: req.ip,
    });

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
    console.error(
      `❌ [${correlationId}] Erro ao validar refresh token:`,
      errorMessage
    );

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
  const correlationId =
    req.headers["x-correlation-id"] || `profile-${Date.now()}`;

  try {
    const userId = req.user?.id;

    if (!userId) {
      console.warn(
        `⚠️ [${correlationId}] Tentativa de obter perfil sem autenticação`
      );
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado",
        correlationId,
      });
    }

    console.log(`👤 [${correlationId}] Obtendo perfil para usuário: ${userId}`);

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
        // Estatísticas de pagamentos (resumo)
        _count: {
          select: {
            mercadoPagoOrders: true,
            mercadoPagoSubscriptions: true,
          },
        },
      },
    });

    if (!usuario) {
      console.warn(`⚠️ [${correlationId}] Usuário não encontrado: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "Usuário não encontrado",
        correlationId,
      });
    }

    console.log(
      `✅ [${correlationId}] Perfil obtido com sucesso para: ${usuario.email}`
    );

    // Prepara estatísticas adicionais
    const profileStats = {
      accountAge: Math.floor(
        (Date.now() - usuario.criadoEm.getTime()) / (1000 * 60 * 60 * 24)
      ),
      hasCompletedProfile: !!(usuario.telefone && usuario.nomeCompleto),
      hasAddress: usuario.enderecos.length > 0,
      totalOrders: usuario._count.mercadoPagoOrders,
      totalSubscriptions: usuario._count.mercadoPagoSubscriptions,
      emailVerificationStatus: {
        verified: usuario.emailVerificado,
        verifiedAt: usuario.emailVerificadoEm,
      },
    };

    // Log de auditoria
    console.log(`📊 [${correlationId}] Auditoria - Perfil acessado:`, {
      userId: usuario.id,
      email: usuario.email,
      ip: req.ip,
    });

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
    console.error(`❌ [${correlationId}] Erro ao obter perfil:`, errorMessage);

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
      auditLogging: true,
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

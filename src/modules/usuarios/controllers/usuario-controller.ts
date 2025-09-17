import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { getCache, setCache } from '@/utils/cache';
import { generateTokenPair } from '@/modules/usuarios/utils/auth';
import { limparDocumento, validarCNPJ, validarCPF } from '@/modules/usuarios/utils';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { formatZodErrors, loginSchema } from '../validators/auth.schema';

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

const createControllerLogger = (req: Request, action: string) =>
  logger.child({
    controller: 'UsuarioController',
    action,
    correlationId: req.id,
  });

interface UsuarioEndereco {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
}

interface UsuarioPerfil {
  id: string;
  email: string;
  nomeCompleto: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  dataNasc: Date | null;
  genero: string | null;
  matricula: string | null;
  role: string;
  status: string;
  tipoUsuario: string;
  supabaseId: string | null;
  emailVerificado: boolean;
  emailVerificadoEm: Date | null;
  ultimoLogin: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  cidade: string | null;
  estado: string | null;
  avatarUrl: string | null;
  descricao: string | null;
  instagram: string | null;
  linkedin: string | null;
  codUsuario: string;
  enderecos: UsuarioEndereco[];
}

const USER_PROFILE_CACHE_TTL = 300;

const ensureEnderecosArray = (enderecos: unknown): UsuarioEndereco[] => {
  if (!Array.isArray(enderecos)) {
    return [];
  }

  return (enderecos as UsuarioEndereco[])
    .filter((endereco) => typeof endereco === 'object' && endereco !== null)
    .map((endereco) => ({
      id: endereco.id,
      logradouro: endereco.logradouro ?? null,
      numero: endereco.numero ?? null,
      bairro: endereco.bairro ?? null,
      cidade: endereco.cidade ?? null,
      estado: endereco.estado ?? null,
      cep: endereco.cep ?? null,
    }));
};

const reviveUsuario = (usuario: UsuarioPerfil): UsuarioPerfil => ({
  ...usuario,
  criadoEm: new Date(usuario.criadoEm),
  atualizadoEm: new Date(usuario.atualizadoEm),
  emailVerificadoEm: usuario.emailVerificadoEm ? new Date(usuario.emailVerificadoEm) : null,
  ultimoLogin: usuario.ultimoLogin ? new Date(usuario.ultimoLogin) : null,
  dataNasc: usuario.dataNasc ? new Date(usuario.dataNasc) : null,
  enderecos: ensureEnderecosArray(usuario.enderecos),
});

const buildProfileStats = (usuario: UsuarioPerfil) => ({
  accountAge: Math.floor((Date.now() - usuario.criadoEm.getTime()) / (1000 * 60 * 60 * 24)),
  hasCompletedProfile: !!(usuario.telefone && usuario.nomeCompleto),
  hasAddress: ensureEnderecosArray(usuario.enderecos).length > 0,
  totalOrders: 0,
  totalSubscriptions: 0,
  emailVerificationStatus: {
    verified: usuario.emailVerificado,
    verifiedAt: usuario.emailVerificadoEm,
  },
});

/**
 * Controller para autenticação de usuários
 * Valida credenciais e verifica se email foi confirmado
 * @param req - Request object com credenciais
 * @param res - Response object
 */
export const loginUsuario = async (req: Request, res: Response, next: NextFunction) => {
  const log = createControllerLogger(req, 'loginUsuario');
  const correlationId = req.id;
  const startTime = Date.now();

  try {
    log.info('🔐 Iniciando processo de login');

    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = formatZodErrors(validation.error);
      log.warn({ errors }, '⚠️ Dados de login inválidos');
      return res.status(400).json({
        success: false,
        message: 'Dados de login inválidos',
        errors,
        correlationId,
      });
    }

    const { documento, senha } = validation.data;

    // Remove caracteres especiais do documento para comparação
    const documentoLimpo = limparDocumento(documento);

    let campoBusca: 'cpf' | 'cnpj' | null = null;
    if (validarCPF(documentoLimpo)) {
      campoBusca = 'cpf';
    } else if (validarCNPJ(documentoLimpo)) {
      campoBusca = 'cnpj';
    }

    if (!campoBusca) {
      log.warn({ length: documentoLimpo.length }, '⚠️ Documento inválido informado');
      return res.status(400).json({
        success: false,
        message: 'Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos) válido',
        correlationId,
      });
    }

    log.info(
      {
        documentoPrefix:
          campoBusca === 'cpf' ? documentoLimpo.substring(0, 3) : documentoLimpo.substring(0, 5),
        tipoDocumento: campoBusca.toUpperCase(),
      },
      '🔍 Buscando usuário por documento',
    );

    // Busca usuário no banco com todos os campos necessários
    const usuario = await prisma.usuario.findUnique({
      where: campoBusca === 'cpf' ? { cpf: documentoLimpo } : { cnpj: documentoLimpo },
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
        cidade: true,
        estado: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
      },
    });

    if (!usuario) {
      log.warn(
        {
          documentoPrefix:
            campoBusca === 'cpf' ? documentoLimpo.substring(0, 3) : documentoLimpo.substring(0, 5),
          tipoDocumento: campoBusca.toUpperCase(),
        },
        '⚠️ Usuário não encontrado',
      );
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        correlationId,
      });
    }

    log.info({ userId: usuario.id, email: usuario.email }, '👤 Usuário encontrado');

    // Verifica status da conta
    if (usuario.status !== 'ATIVO') {
      log.warn({ userId: usuario.id, status: usuario.status }, '⚠️ Conta inativa');
      return res.status(403).json({
        success: false,
        message: `Conta ${usuario.status.toLowerCase()}. Entre em contato com o suporte.`,
        code: 'ACCOUNT_INACTIVE',
        status: usuario.status,
        correlationId,
      });
    }

    // VERIFICAÇÃO CRÍTICA: Email deve estar verificado
    if (!usuario.emailVerificado) {
      log.warn({ userId: usuario.id, email: usuario.email }, '⚠️ Email não verificado');

      // Calcula há quanto tempo a conta foi criada
      const accountAge = Date.now() - usuario.criadoEm.getTime();
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

      return res.status(403).json({
        success: false,
        message:
          'Email não verificado. Verifique sua caixa de entrada ou solicite um novo email de verificação.',
        code: 'EMAIL_NOT_VERIFIED',
        data: {
          email: usuario.email,
          canResendVerification: true,
          accountCreated: usuario.criadoEm,
          accountAgeDays,
          helpText:
            accountAgeDays > 1
              ? 'Sua conta foi criada há mais de 1 dia. Verifique sua pasta de spam ou solicite um novo email.'
              : 'Verifique sua caixa de entrada. O email pode demorar alguns minutos para chegar.',
        },
        correlationId,
      });
    }

    log.info({ userId: usuario.id, verifiedAt: usuario.emailVerificadoEm }, '✅ Email verificado');

    // Valida senha usando bcrypt
    log.info({ userId: usuario.id }, '🔐 Validando senha');
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      log.warn({ userId: usuario.id }, '⚠️ Senha inválida');
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        correlationId,
      });
    }

    // Gera tokens de acesso e refresh
    const tokens = generateTokenPair(usuario.id, usuario.role);

    // Atualiza último login e armazena refresh token
    log.info({ userId: usuario.id }, '💾 Atualizando último login');
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
      '✅ Login realizado com sucesso',
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
      codUsuario: usuario.codUsuario,
      cidade: usuario.cidade,
      estado: usuario.estado,
      avatarUrl: usuario.avatarUrl,
      descricao: usuario.descricao,
      instagram: usuario.instagram,
      linkedin: usuario.linkedin,
    };

    // Retorna dados do usuário autenticado com tokens
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
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
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error(
      {
        err,
        duration,
        documento: req.body.documento
          ? `${req.body.documento.substring(0, 3)}***`
          : 'não fornecido',
      },
      '❌ Erro crítico no login',
    );

    err.message = errorMessage;
    return next(err);
  }
};

/**
 * Controller para logout de usuários
 * Remove refresh token do banco de dados
 * @param req - Request object com dados do usuário autenticado
 * @param res - Response object
 */
export const logoutUsuario = async (req: Request, res: Response, next: NextFunction) => {
  const log = createControllerLogger(req, 'logoutUsuario');
  const correlationId = req.id;

  try {
    const userId = req.user?.id;

    if (!userId) {
      log.warn('⚠️ Tentativa de logout sem usuário autenticado');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        correlationId,
      });
    }

    log.info({ userId }, '🚪 Iniciando logout');

    // Remove refresh token do banco (invalidação de sessão)
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        atualizadoEm: new Date(),
      },
    });

    await invalidateUserCache({ id: userId });

    log.info({ userId }, '✅ Logout realizado com sucesso');

    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, userId: req.user?.id }, '❌ Erro no logout');

    err.message = errorMessage;
    return next(err);
  }
};

/**
 * Controller para renovação de tokens
 * Valida refresh token e gera novos tokens de acesso
 * @param req - Request object com refresh token
 * @param res - Response object
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  const log = createControllerLogger(req, 'refreshToken');
  const correlationId = req.id;

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      log.warn('⚠️ Refresh token não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Refresh token é obrigatório',
        correlationId,
      });
    }

    log.info({ tokenPrefix: refreshToken.substring(0, 10) }, '🔄 Validando refresh token');

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
        codUsuario: true,
        cidade: true,
        estado: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        emailVerificado: true,
        ultimoLogin: true,
      },
    });

    if (!usuario) {
      log.warn('⚠️ Refresh token inválido ou não encontrado');
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido',
        code: 'INVALID_REFRESH_TOKEN',
        correlationId,
      });
    }

    log.info({ userId: usuario.id, email: usuario.email }, '👤 Refresh token válido');

    // Verifica se a conta ainda está ativa
    if (usuario.status !== 'ATIVO') {
      log.warn({ userId: usuario.id, status: usuario.status }, '⚠️ Conta inativa durante refresh');

      // Remove refresh token inválido
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: `Conta ${usuario.status.toLowerCase()}`,
        code: 'ACCOUNT_INACTIVE',
        status: usuario.status,
        correlationId,
      });
    }

    // Verifica se email ainda está verificado (caso tenha sido revertido por admin)
    if (!usuario.emailVerificado) {
      log.warn({ userId: usuario.id }, '⚠️ Email não verificado durante refresh');

      // Remove refresh token
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: 'Email não verificado. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        correlationId,
      });
    }

    log.info({ userId: usuario.id }, '✅ Refresh token validado com sucesso');

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
      codUsuario: usuario.codUsuario,
      cidade: usuario.cidade,
      estado: usuario.estado,
      avatarUrl: usuario.avatarUrl,
      descricao: usuario.descricao,
      instagram: usuario.instagram,
      linkedin: usuario.linkedin,
    };

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      usuario: responseData,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err }, '❌ Erro ao validar refresh token');

    err.message = errorMessage;
    return next(err);
  }
};

/**
 * Controller para obter perfil do usuário autenticado
 * Retorna dados completos do perfil (sem informações sensíveis)
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const obterPerfil = async (req: Request, res: Response, next: NextFunction) => {
  const log = createControllerLogger(req, 'obterPerfil');
  const correlationId = req.id;

  try {
    const userId = req.user?.id;

    if (!userId) {
      log.warn('⚠️ Tentativa de obter perfil sem autenticação');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        correlationId,
      });
    }

    log.info({ userId }, '👤 Obtendo perfil do usuário');

    const cacheKey = `user:${userId}`;
    const cached = await getCache<UsuarioPerfil>(cacheKey);

    if (cached) {
      log.debug({ userId }, '🧠 Perfil obtido do cache');
      const usuario = reviveUsuario(cached);
      const profileStats = buildProfileStats(usuario);

      return res.json({
        success: true,
        message: 'Perfil obtido com sucesso',
        usuario: { ...usuario, _count: undefined },
        stats: profileStats,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    // Busca dados completos do usuário (excluindo informações sensíveis)
    const usuarioDb = await prisma.usuario.findUnique({
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
        cidade: true,
        estado: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
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

    const usuario = usuarioDb
      ? ({
          ...usuarioDb,
          enderecos: ensureEnderecosArray(usuarioDb.enderecos),
        } as UsuarioPerfil)
      : null;

    if (!usuario) {
      log.warn({ userId }, '⚠️ Usuário não encontrado ao obter perfil');
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        correlationId,
      });
    }

    log.info({ userId: usuario.id, email: usuario.email }, '✅ Perfil obtido com sucesso');

    await setCache(cacheKey, usuario, USER_PROFILE_CACHE_TTL);
    if (usuario.supabaseId) {
      await setCache(`user:${usuario.supabaseId}`, usuario, USER_PROFILE_CACHE_TTL);
    }

    // Prepara estatísticas adicionais
    const profileStats = buildProfileStats(usuario);

    // Retorna perfil completo
    res.json({
      success: true,
      message: 'Perfil obtido com sucesso',
      usuario: {
        ...usuario,
        _count: undefined, // Remove contadores internos da resposta
      },
      stats: profileStats,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, userId: req.user?.id }, '❌ Erro ao obter perfil');

    err.message = errorMessage;
    return next(err);
  }
};

/**
 * Estatísticas de uso dos controllers (para monitoramento)
 */
export const getControllerStats = () => {
  return {
    module: 'usuario-controller',
    version: '6.0.0',
    features: {
      emailVerificationRequired: true,
      rateLimitingIntegrated: true,
      correlationIdTracking: true,
      securePasswordHandling: true,
    },
    endpoints: {
      loginUsuario: 'POST /login',
      logoutUsuario: 'POST /logout',
      refreshToken: 'POST /refresh',
      obterPerfil: 'GET /perfil',
    },
    lastUpdated: '2025-08-04T18:00:00Z',
  };
};

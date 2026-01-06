import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { loginCache, getCache, userCache, setCache, deleteCache } from '@/utils/cache';
import {
  clearRefreshTokenCookie,
  extractRefreshTokenFromRequest,
  generateTokenPair,
  getRefreshTokenExpiration,
  setRefreshTokenCookie,
} from '@/modules/usuarios/utils/auth';
import { limparDocumento, validarCNPJ, validarCPF } from '@/modules/usuarios/utils';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { formatZodErrors, loginSchema, updateProfileSchema } from '../validators/auth.schema';
import {
  attachEnderecoResumo,
  normalizeUsuarioEnderecos,
  UsuarioEnderecoDto,
} from '../utils/address';
import {
  mapUsuarioInformacoes,
  mergeUsuarioInformacoes,
  usuarioInformacoesSelect,
} from '../utils/information';
import {
  mapSocialLinks,
  sanitizeSocialLinks,
  buildSocialLinksUpdateData,
} from '../utils/social-links';
import type { UsuarioSocialLinks } from '../utils/types';
import {
  buildEmailVerificationSummary,
  UsuariosVerificacaoEmailSelect,
  normalizeEmailVerification,
} from '../utils/email-verification';

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

interface UsuarioPerfil {
  id: string;
  email: string;
  nomeCompleto: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  dataNasc: Date | null;
  genero: string | null;
  inscricao: string | null;
  role: string;
  status: string;
  tipoUsuario: string;
  authId: string | null;
  emailVerificado: boolean;
  emailVerificadoEm: Date | null;
  ultimoLogin: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  cidade: string | null;
  estado: string | null;
  avatarUrl: string | null;
  descricao: string | null;
  aceitarTermos: boolean;
  informacoes: ReturnType<typeof mapUsuarioInformacoes>;
  codUsuario: string;
  UsuariosVerificacaoEmail: ReturnType<typeof buildEmailVerificationSummary>;
  enderecos: UsuarioEnderecoDto[];
  redesSociais: UsuarioSocialLinks | null;
  UsuariosEnderecos?: UsuarioEnderecoDto[];
  UsuariosInformation?: ReturnType<typeof mapUsuarioInformacoes> | null;
}

const USER_PROFILE_CACHE_TTL = 300;

const reviveUsuario = (usuario: UsuarioPerfil): UsuarioPerfil => {
  const UsuariosVerificacaoEmailSummary =
    usuario.UsuariosVerificacaoEmail ?? buildEmailVerificationSummary();
  const enderecos = normalizeUsuarioEnderecos(
    usuario.UsuariosEnderecos ?? (usuario as any).enderecos ?? [],
  );
  const [principal] = enderecos;

  // Mapear informações - suporta tanto do cache (já processado) quanto do banco (raw)
  // Se já tem campos no nível raiz (do cache), usa eles
  // Se não, mapeia de UsuariosInformation (do banco)
  const informacoes = usuario.informacoes
    ? usuario.informacoes
    : mapUsuarioInformacoes(usuario.UsuariosInformation);

  // Garantir que campos estejam no nível raiz (priorizar valores já processados)
  // Campos podem vir do cache (já processados) ou do banco (raw)
  const telefone = usuario.telefone ?? informacoes.telefone ?? null;
  const genero = usuario.genero ?? informacoes.genero ?? null;

  // dataNasc pode vir como Date, string ISO, ou null
  let dataNasc: Date | null = null;
  if (usuario.dataNasc) {
    dataNasc = usuario.dataNasc instanceof Date ? usuario.dataNasc : new Date(usuario.dataNasc);
  } else if (informacoes.dataNasc) {
    dataNasc =
      informacoes.dataNasc instanceof Date ? informacoes.dataNasc : new Date(informacoes.dataNasc);
  }

  const inscricao = usuario.inscricao ?? informacoes.inscricao ?? null;
  const avatarUrl = usuario.avatarUrl ?? informacoes.avatarUrl ?? null;
  const descricao = usuario.descricao ?? informacoes.descricao ?? null;
  const aceitarTermos = usuario.aceitarTermos ?? informacoes.aceitarTermos ?? false;

  // Garantir que criadoEm e atualizadoEm sejam sempre Date válidos
  const criadoEm =
    usuario.criadoEm instanceof Date
      ? usuario.criadoEm
      : usuario.criadoEm
        ? new Date(usuario.criadoEm)
        : new Date();

  const atualizadoEm =
    usuario.atualizadoEm instanceof Date
      ? usuario.atualizadoEm
      : usuario.atualizadoEm
        ? new Date(usuario.atualizadoEm)
        : new Date();

  return {
    ...usuario,
    redesSociais: mapSocialLinks(usuario.redesSociais),
    criadoEm,
    atualizadoEm,
    emailVerificadoEm: usuario.emailVerificadoEm ? new Date(usuario.emailVerificadoEm) : null,
    ultimoLogin: usuario.ultimoLogin ? new Date(usuario.ultimoLogin) : null,
    dataNasc,
    telefone,
    genero,
    inscricao,
    avatarUrl,
    descricao,
    aceitarTermos,
    // REMOVIDO: objeto informacoes redundante - campos já estão no nível raiz
    UsuariosVerificacaoEmail: {
      ...UsuariosVerificacaoEmailSummary,
      verifiedAt: UsuariosVerificacaoEmailSummary.verifiedAt
        ? new Date(UsuariosVerificacaoEmailSummary.verifiedAt)
        : null,
      tokenExpiration: UsuariosVerificacaoEmailSummary.tokenExpiration
        ? new Date(UsuariosVerificacaoEmailSummary.tokenExpiration)
        : null,
      lastAttemptAt: UsuariosVerificacaoEmailSummary.lastAttemptAt
        ? new Date(UsuariosVerificacaoEmailSummary.lastAttemptAt)
        : null,
    },
    enderecos,
    cidade: principal?.cidade ?? usuario.cidade ?? null,
    estado: principal?.estado ?? usuario.estado ?? null,
  };
};

/**
 * Formata a resposta do perfil removendo redundâncias e simplificando a estrutura
 */
const formatUsuarioResponse = (usuario: UsuarioPerfil) => {
  // Preservar UsuariosInformation e informacoes ANTES do destructuring para uso posterior
  const UsuariosInformation = (usuario as any).UsuariosInformation;
  const informacoes = (usuario as any).informacoes;

  // Extrair apenas o necessário, removendo redundâncias
  const {
    UsuariosInformation: _,
    UsuariosEnderecos,
    UsuariosVerificacaoEmail,
    informacoes: __,
    _count,
    ...usuarioBase
  } = usuario as any;

  // Garantir que datas sejam sempre Date válidos
  const criadoEm =
    usuario.criadoEm instanceof Date
      ? usuario.criadoEm
      : usuario.criadoEm
        ? new Date(usuario.criadoEm)
        : new Date();

  const atualizadoEm =
    usuario.atualizadoEm instanceof Date
      ? usuario.atualizadoEm
      : usuario.atualizadoEm
        ? new Date(usuario.atualizadoEm)
        : new Date();

  // Garantir que campos de informações estejam explicitamente no nível raiz
  // (podem vir do mergeUsuarioInformacoes ou do cache)
  // Se informacoes não estiver disponível, mapear diretamente de UsuariosInformation
  const informacoesMapeadas =
    informacoes ?? (UsuariosInformation ? mapUsuarioInformacoes(UsuariosInformation) : null);

  // Usar valores do nível raiz (que já vêm do merge) OU dos informacoes mapeados como fallback
  // Priorizar valores do nível raiz primeiro (que já vêm do mergeUsuarioInformacoes)
  const telefone = usuario.telefone ?? informacoesMapeadas?.telefone ?? null;
  const genero = usuario.genero ?? informacoesMapeadas?.genero ?? null;
  const dataNasc = usuario.dataNasc ?? informacoesMapeadas?.dataNasc ?? null;
  const descricao = usuario.descricao ?? informacoesMapeadas?.descricao ?? null;
  const inscricao = usuario.inscricao ?? informacoesMapeadas?.inscricao ?? null;
  const avatarUrl = usuario.avatarUrl ?? informacoesMapeadas?.avatarUrl ?? null;
  const aceitarTermos = usuario.aceitarTermos ?? informacoesMapeadas?.aceitarTermos ?? false;

  return {
    ...usuarioBase,
    criadoEm,
    atualizadoEm,
    // Garantir que campos de informações estejam no nível raiz
    telefone,
    genero,
    dataNasc,
    descricao,
    inscricao,
    avatarUrl,
    aceitarTermos,
    // Simplificar nome do objeto de verificação de email
    emailVerification: {
      verified: UsuariosVerificacaoEmail?.verified ?? false,
      verifiedAt: UsuariosVerificacaoEmail?.verifiedAt ?? null,
      token: UsuariosVerificacaoEmail?.token ?? null,
      tokenExpiration: UsuariosVerificacaoEmail?.tokenExpiration ?? null,
      attempts: UsuariosVerificacaoEmail?.attempts ?? 0,
      lastAttemptAt: UsuariosVerificacaoEmail?.lastAttemptAt ?? null,
    },
    // enderecos já está normalizado
  };
};

const buildProfileStats = (usuario: UsuarioPerfil) => {
  const criadoEm =
    usuario.criadoEm instanceof Date
      ? usuario.criadoEm
      : usuario.criadoEm
        ? new Date(usuario.criadoEm)
        : new Date();

  return {
    accountAge: Math.floor((Date.now() - criadoEm.getTime()) / (1000 * 60 * 60 * 24)),
    hasCompletedProfile: !!(usuario.telefone && usuario.nomeCompleto),
    hasAddress: (usuario.enderecos ?? []).length > 0,
    totalOrders: 0,
    totalSubscriptions: 0,
    emailVerification: {
      verified: usuario.UsuariosVerificacaoEmail?.verified ?? false,
      verifiedAt: usuario.UsuariosVerificacaoEmail?.verifiedAt ?? null,
      tokenExpiration: usuario.UsuariosVerificacaoEmail?.tokenExpiration ?? null,
    },
  };
};

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

    const { documento, senha, rememberMe } = validation.data;

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

    // ✅ Cache: Verificar se usuário está bloqueado (rate limiting)
    const isBlocked = await loginCache.getBlocked(documentoLimpo);
    if (isBlocked) {
      log.warn(
        { documentoPrefix: documentoLimpo.substring(0, 3) },
        '⚠️ Tentativa de login bloqueada (cache)',
      );
      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas de login. Tente novamente mais tarde.',
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

    // ✅ Busca usuário no banco com todos os campos necessários
    // Timeout de 3s por tentativa (fail-fast) para evitar esperas longas
    // Usa índices otimizados (cpf/cnpj unique + índice composto com status)
    const usuarioRecord = await retryOperation(
      () =>
        prisma.usuarios.findUnique({
          where: campoBusca === 'cpf' ? { cpf: documentoLimpo } : { cnpj: documentoLimpo },
          select: {
            id: true,
            email: true,
            senha: true,
            nomeCompleto: true,
            role: true,
            status: true,
            tipoUsuario: true,
            authId: true,
            ultimoLogin: true,
            criadoEm: true,
            UsuariosRedesSociais: {
              select: {
                id: true,
                instagram: true,
                linkedin: true,
                facebook: true,
                youtube: true,
                twitter: true,
                tiktok: true,
              },
            },
            codUsuario: true,
            UsuariosInformation: {
              select: usuarioInformacoesSelect,
            },
            UsuariosEnderecos: {
              orderBy: { criadoEm: 'asc' },
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
            UsuariosVerificacaoEmail: {
              select: UsuariosVerificacaoEmailSelect,
            },
          },
        }),
      2, // 2 tentativas apenas (reduzido de 3)
      500, // 500ms delay entre tentativas
      3000, // 3s timeout por tentativa (fail-fast)
    );

    if (!usuarioRecord) {
      // ✅ Cache: Incrementar tentativas de login falhadas
      const attempts = (await loginCache.getAttempts(documentoLimpo)) || 0;
      await loginCache.setAttempts(documentoLimpo, attempts + 1, 900); // 15 min TTL

      // Bloquear após 5 tentativas
      if (attempts + 1 >= 5) {
        await loginCache.setBlocked(documentoLimpo, true, 3600); // 1 hora bloqueado
      }

      log.warn(
        {
          documentoPrefix:
            campoBusca === 'cpf' ? documentoLimpo.substring(0, 3) : documentoLimpo.substring(0, 5),
          tipoDocumento: campoBusca.toUpperCase(),
          attempts: attempts + 1,
        },
        '⚠️ Usuário não encontrado',
      );
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
        correlationId,
      });
    }

    const {
      UsuariosVerificacaoEmail: UsuariosVerificacaoEmail,
      UsuariosRedesSociais,
      UsuariosEnderecos,
      ...UsuariosSemVerificacao
    } = usuarioRecord;
    const verification = normalizeEmailVerification(UsuariosVerificacaoEmail);
    const usuarioComInformacoes = mergeUsuarioInformacoes({
      ...UsuariosSemVerificacao,
      emailVerificado: verification.emailVerificado,
      emailVerificadoEm: verification.emailVerificadoEm,
      UsuariosVerificacaoEmail: buildEmailVerificationSummary(UsuariosVerificacaoEmail),
      redesSociais: UsuariosRedesSociais,
      UsuariosEnderecos,
    });
    const usuario = attachEnderecoResumo(usuarioComInformacoes);
    if (!usuario) {
      log.error({ documento: campoBusca }, '❌ Falha ao montar dados do usuário');
      return res.status(500).json({
        success: false,
        message: 'Erro ao montar dados do usuário',
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
    const tokens = generateTokenPair(usuario.id, usuario.role, { rememberMe });
    const refreshSettings = getRefreshTokenExpiration(rememberMe);

    // Atualiza último login e armazena refresh token
    log.info({ userId: usuario.id }, '💾 Atualizando último login');
    await retryOperation(
      () =>
        prisma.usuarios.update({
          where: { id: usuario.id },
          data: {
            ultimoLogin: new Date(),
            refreshToken: tokens.refreshToken,
            atualizadoEm: new Date(),
          },
        }),
      3,
      500,
    );

    // Remove sessões expiradas antes de criar a nova
    await retryOperation(
      () =>
        prisma.usuariosSessoes.updateMany({
          where: {
            usuarioId: usuario.id,
            revogadoEm: null,
            expiraEm: { lt: new Date() },
          },
          data: { revogadoEm: new Date() },
        }),
      3,
      500,
    );

    const session = await retryOperation(
      () =>
        prisma.usuariosSessoes.create({
          data: {
            id: randomUUID(),
            usuarioId: usuario.id,
            refreshToken: tokens.refreshToken,
            rememberMe,
            ip: req.ip || null,
            userAgent: req.get('user-agent')?.slice(0, 512) || null,
            expiraEm: refreshSettings.expiresAt,
            atualizadoEm: new Date(),
          },
          select: {
            id: true,
            rememberMe: true,
            criadoEm: true,
            expiraEm: true,
          },
        }),
      3,
      500,
    );

    setRefreshTokenCookie(res, tokens.refreshToken, rememberMe);

    // ✅ Cache: Limpar tentativas de login e cache de bloqueio ao fazer login bem-sucedido
    await loginCache.deleteAttempts(documentoLimpo);
    await loginCache.deleteBlocked(documentoLimpo); // Remove bloqueio
    await invalidateUserCache(usuario);

    const duration = Date.now() - startTime;
    log.info(
      {
        duration,
        userId: usuario.id,
        email: usuario.email,
        sessionId: session.id,
        rememberMe,
        refreshExpiresAt: session.expiraEm,
      },
      '✅ Login realizado com sucesso',
    );

    // Prepara dados de resposta (sem informações sensíveis)
    const socialLinks = mapSocialLinks(usuario.redesSociais);

    const responseData = {
      id: usuario.id,
      email: usuario.email,
      nomeCompleto: usuario.nomeCompleto,
      telefone: usuario.telefone,
      genero: usuario.genero,
      dataNasc: usuario.dataNasc,
      inscricao: usuario.inscricao,
      role: usuario.role,
      tipoUsuario: usuario.tipoUsuario,
      authId: usuario.authId,
      emailVerificado: usuario.emailVerificado,
      emailVerificadoEm: usuario.emailVerificadoEm,
      UsuariosVerificacaoEmail: usuario.UsuariosVerificacaoEmail,
      ultimoLogin: new Date().toISOString(),
      codUsuario: usuario.codUsuario,
      cidade: usuario.cidade,
      estado: usuario.estado,
      avatarUrl: usuario.avatarUrl,
      descricao: usuario.descricao,
      aceitarTermos: usuario.aceitarTermos,
      informacoes: usuario.informacoes,
      socialLinks,
      enderecos: usuario.UsuariosEnderecos,
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
      rememberMe,
      refreshTokenExpiresIn: tokens.refreshExpiresIn,
      refreshTokenExpiresAt: refreshSettings.expiresAt.toISOString(),
      session: {
        id: session.id,
        rememberMe: session.rememberMe,
        createdAt: session.criadoEm.toISOString(),
        expiresAt: session.expiraEm.toISOString(),
      },
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

    const refreshTokenFromRequest = extractRefreshTokenFromRequest(req);
    let revokedSessions = 0;

    if (refreshTokenFromRequest) {
      const result = await prisma.usuariosSessoes.updateMany({
        where: {
          usuarioId: userId,
          refreshToken: refreshTokenFromRequest,
          revogadoEm: null,
        },
        data: { revogadoEm: new Date() },
      });
      revokedSessions = result.count;
    } else {
      const result = await prisma.usuariosSessoes.updateMany({
        where: { usuarioId: userId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      revokedSessions = result.count;
    }

    // Remove refresh token do banco (invalidação de sessão)
    await prisma.usuarios.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        atualizadoEm: new Date(),
      },
    });

    await invalidateUserCache({ id: userId });

    clearRefreshTokenCookie(res);

    log.info({ userId, revokedSessions }, '✅ Logout realizado com sucesso');

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
    const incomingRefreshToken = extractRefreshTokenFromRequest(req);

    if (!incomingRefreshToken) {
      log.warn('⚠️ Refresh token não fornecido');
      return res.status(400).json({
        success: false,
        message: 'Refresh token é obrigatório',
        correlationId,
      });
    }

    log.info({ tokenPrefix: incomingRefreshToken.substring(0, 10) }, '🔄 Validando refresh token');

    const sessionRecord = await prisma.usuariosSessoes.findFirst({
      where: {
        refreshToken: incomingRefreshToken,
        revogadoEm: null,
      },
      select: {
        id: true,
        usuarioId: true,
        rememberMe: true,
        expiraEm: true,
        criadoEm: true,
        Usuarios: {
          select: {
            id: true,
            email: true,
            nomeCompleto: true,
            role: true,
            status: true,
            tipoUsuario: true,
            authId: true,
            codUsuario: true,
            UsuariosRedesSociais: {
              select: {
                id: true,
                instagram: true,
                linkedin: true,
                facebook: true,
                youtube: true,
                twitter: true,
                tiktok: true,
              },
            },
            ultimoLogin: true,
            UsuariosInformation: {
              select: usuarioInformacoesSelect,
            },
            UsuariosEnderecos: {
              orderBy: { criadoEm: 'asc' },
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
            UsuariosVerificacaoEmail: {
              select: UsuariosVerificacaoEmailSelect,
            },
          },
        },
      },
    });

    if (!sessionRecord || !sessionRecord.Usuarios) {
      log.warn('⚠️ Sessão não encontrada para o refresh token informado');
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido',
        code: 'INVALID_REFRESH_TOKEN',
        correlationId,
      });
    }

    if (sessionRecord.expiraEm <= new Date()) {
      await prisma.usuariosSessoes.update({
        where: { id: sessionRecord.id },
        data: { revogadoEm: new Date() },
      });

      await prisma.usuarios.update({
        where: { id: sessionRecord.usuarioId },
        data: { refreshToken: null },
      });

      clearRefreshTokenCookie(res);

      log.warn({ sessionId: sessionRecord.id }, '⚠️ Refresh token expirado');
      return res.status(401).json({
        success: false,
        message: 'Refresh token expirado',
        code: 'REFRESH_TOKEN_EXPIRED',
        correlationId,
      });
    }

    const usuarioRecord = sessionRecord.Usuarios;
    const {
      UsuariosVerificacaoEmail: UsuariosVerificacaoEmail,
      UsuariosRedesSociais,
      UsuariosEnderecos,
      ...UsuariosSemVerificacao
    } = usuarioRecord;
    const verification = normalizeEmailVerification(UsuariosVerificacaoEmail);
    const usuarioComInformacoes = mergeUsuarioInformacoes({
      ...UsuariosSemVerificacao,
      emailVerificado: verification.emailVerificado,
      emailVerificadoEm: verification.emailVerificadoEm,
      UsuariosVerificacaoEmail: buildEmailVerificationSummary(UsuariosVerificacaoEmail),
      redesSociais: UsuariosRedesSociais,
      UsuariosEnderecos,
    });
    const usuario = attachEnderecoResumo(usuarioComInformacoes);
    if (!usuario) {
      log.error(
        { sessionId: sessionRecord.id },
        '❌ Falha ao reconstruir usuário no refresh token',
      );
      await prisma.usuariosSessoes.update({
        where: { id: sessionRecord.id },
        data: { revogadoEm: new Date() },
      });
      clearRefreshTokenCookie(res);
      return res.status(500).json({
        success: false,
        message: 'Erro ao reconstruir dados do usuário',
        correlationId,
      });
    }

    log.info(
      { userId: usuario.id, email: usuario.email, sessionId: sessionRecord.id },
      '👤 Refresh token válido',
    );

    if (usuario.status !== 'ATIVO') {
      log.warn({ userId: usuario.id, status: usuario.status }, '⚠️ Conta inativa durante refresh');

      await prisma.usuariosSessoes.update({
        where: { id: sessionRecord.id },
        data: { revogadoEm: new Date() },
      });

      await prisma.usuarios.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      clearRefreshTokenCookie(res);
      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: `Conta ${usuario.status.toLowerCase()}`,
        code: 'ACCOUNT_INACTIVE',
        status: usuario.status,
        correlationId,
      });
    }

    if (!usuario.emailVerificado) {
      log.warn({ userId: usuario.id }, '⚠️ Email não verificado durante refresh');

      await prisma.usuariosSessoes.update({
        where: { id: sessionRecord.id },
        data: { revogadoEm: new Date() },
      });

      await prisma.usuarios.update({
        where: { id: usuario.id },
        data: { refreshToken: null },
      });

      clearRefreshTokenCookie(res);
      await invalidateUserCache(usuario);

      return res.status(403).json({
        success: false,
        message: 'Email não verificado. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        correlationId,
      });
    }

    const tokens = generateTokenPair(usuario.id, usuario.role, {
      rememberMe: sessionRecord.rememberMe,
    });
    const refreshSettings = getRefreshTokenExpiration(sessionRecord.rememberMe);

    const updatedUser = await prisma.usuarios.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
        refreshToken: tokens.refreshToken,
        atualizadoEm: new Date(),
      },
    });

    const updatedSession = await prisma.usuariosSessoes.update({
      where: { id: sessionRecord.id },
      data: {
        refreshToken: tokens.refreshToken,
        expiraEm: refreshSettings.expiresAt,
        revogadoEm: null,
      },
      select: {
        id: true,
        rememberMe: true,
        criadoEm: true,
        expiraEm: true,
      },
    });

    await invalidateUserCache(usuario.id);

    setRefreshTokenCookie(res, tokens.refreshToken, sessionRecord.rememberMe);

    const socialLinks = mapSocialLinks(usuario.redesSociais);

    const responseData = {
      id: usuario.id,
      email: usuario.email,
      nomeCompleto: usuario.nomeCompleto,
      telefone: usuario.telefone,
      genero: usuario.genero,
      dataNasc: usuario.dataNasc,
      inscricao: usuario.inscricao,
      role: usuario.role,
      tipoUsuario: usuario.tipoUsuario,
      authId: usuario.authId,
      emailVerificado: usuario.emailVerificado,
      ultimoLogin: updatedUser.ultimoLogin,
      codUsuario: usuario.codUsuario,
      cidade: usuario.cidade,
      estado: usuario.estado,
      avatarUrl: usuario.avatarUrl,
      descricao: usuario.descricao,
      aceitarTermos: usuario.aceitarTermos,
      informacoes: usuario.informacoes,
      socialLinks,
      enderecos: usuario.UsuariosEnderecos,
    };

    log.info(
      {
        userId: usuario.id,
        sessionId: updatedSession.id,
        rememberMe: updatedSession.rememberMe,
        refreshExpiresAt: updatedSession.expiraEm,
      },
      '✅ Tokens renovados com sucesso',
    );

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      usuario: responseData,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      rememberMe: updatedSession.rememberMe,
      refreshTokenExpiresIn: tokens.refreshExpiresIn,
      refreshTokenExpiresAt: refreshSettings.expiresAt.toISOString(),
      session: {
        id: updatedSession.id,
        rememberMe: updatedSession.rememberMe,
        createdAt: updatedSession.criadoEm.toISOString(),
        expiresAt: updatedSession.expiraEm.toISOString(),
      },
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

    // TEMPORARIAMENTE DESABILITADO: Cache causando problemas de sincronização
    // Os dados estão sendo salvos no banco, mas o cache está retornando dados antigos
    // TODO: Reabilitar cache após resolver problema de invalidação
    // const cacheKey = `user:${userId}`;
    // const cached = await getCache<UsuarioPerfil>(cacheKey);

    // if (cached) {
    //   log.debug({ userId }, '🧠 Perfil obtido do cache');
    //   const usuario = reviveUsuario(cached);
    //   const profileStats = buildProfileStats(usuario);

    //   return res.json({
    //     success: true,
    //     message: 'Perfil obtido com sucesso',
    //     usuario: { ...usuario, _count: undefined },
    //     stats: profileStats,
    //     correlationId,
    //     timestamp: new Date().toISOString(),
    //   });
    // }

    const cacheKey = `user:${userId}`;

    // Busca dados completos do usuário (excluindo informações sensíveis)
    const usuarioDb = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        cnpj: true,
        role: true,
        status: true,
        tipoUsuario: true,
        authId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        UsuariosRedesSociais: {
          select: {
            id: true,
            instagram: true,
            linkedin: true,
            facebook: true,
            youtube: true,
            twitter: true,
            tiktok: true,
          },
        },
        codUsuario: true,
        UsuariosInformation: {
          select: usuarioInformacoesSelect,
        },
        UsuariosEnderecos: {
          orderBy: { criadoEm: 'asc' },
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
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
        // Estatísticas de pagamentos removidas
      },
    });

    const {
      UsuariosVerificacaoEmail: UsuariosVerificacaoEmail,
      UsuariosRedesSociais,
      UsuariosEnderecos,
      UsuariosInformation: UsuariosInformationFromQuery,
      ...UsuariosSemVerificacao
    } = usuarioDb ?? {};

    // CORREÇÃO CRÍTICA: SEMPRE buscar UsuariosInformation diretamente do banco
    // O Prisma pode não retornar relações one-to-one opcionais corretamente em alguns casos
    // (especialmente com poolers, após transações, ou problemas de cache do Prisma).
    // Buscar diretamente SEMPRE garante que temos os dados mais atualizados do banco.
    let UsuariosInformation: any = null;
    if (usuarioDb?.id) {
      try {
        UsuariosInformation = await prisma.usuariosInformation.findUnique({
          where: { usuarioId: usuarioDb.id },
          select: usuarioInformacoesSelect,
        });
        log.info(
          {
            userId: usuarioDb.id,
            hasInfo: !!UsuariosInformation,
            genero: UsuariosInformation?.genero,
            dataNasc: UsuariosInformation?.dataNasc,
            descricao: UsuariosInformation?.descricao,
            telefone: UsuariosInformation?.telefone,
          },
          '📊 UsuariosInformation buscado diretamente do banco',
        );
      } catch (error) {
        log.error(
          { err: error, userId: usuarioDb.id },
          '❌ Erro ao buscar UsuariosInformation diretamente',
        );
        // Se a busca direta falhar, tentar usar o que veio da query
        if (UsuariosInformationFromQuery) {
          UsuariosInformation = UsuariosInformationFromQuery;
          log.warn(
            { userId: usuarioDb.id },
            '⚠️ Usando UsuariosInformation da query como fallback',
          );
        }
      }
    }

    const verification = normalizeEmailVerification(UsuariosVerificacaoEmail);
    const usuario = attachEnderecoResumo(
      usuarioDb
        ? mergeUsuarioInformacoes({
            ...UsuariosSemVerificacao,
            UsuariosInformation, // Garantir que UsuariosInformation seja passado explicitamente
            emailVerificado: verification.emailVerificado,
            emailVerificadoEm: verification.emailVerificadoEm,
            UsuariosVerificacaoEmail: buildEmailVerificationSummary(UsuariosVerificacaoEmail),
            redesSociais: UsuariosRedesSociais,
            UsuariosEnderecos,
          })
        : null,
    ) as UsuarioPerfil | null;

    if (!usuario) {
      log.warn({ userId }, '⚠️ Usuário não encontrado ao obter perfil');
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        correlationId,
      });
    }

    log.info(
      {
        userId: usuario.id,
        email: usuario.email,
        telefone: usuario.telefone,
        genero: usuario.genero,
        descricao: usuario.descricao,
        dataNasc: usuario.dataNasc,
        UsuariosInformation: usuario.UsuariosInformation,
        informacoes: (usuario as any).informacoes,
      },
      '✅ Perfil obtido com sucesso (ANTES formatUsuarioResponse)',
    );

    // TEMPORARIAMENTE DESABILITADO: Cache causando problemas de sincronização
    // await setCache(cacheKey, usuario, USER_PROFILE_CACHE_TTL);

    // Prepara estatísticas adicionais
    const profileStats = buildProfileStats(usuario);

    // Formata resposta removendo redundâncias
    const usuarioResponse = formatUsuarioResponse(usuario);

    log.info(
      {
        userId: usuarioResponse.id,
        telefone: usuarioResponse.telefone,
        genero: usuarioResponse.genero,
        descricao: usuarioResponse.descricao,
        dataNasc: usuarioResponse.dataNasc,
      },
      '✅ Perfil formatado (DEPOIS formatUsuarioResponse)',
    );

    res.json({
      success: true,
      message: 'Perfil obtido com sucesso',
      usuario: usuarioResponse,
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
 * Controller para atualizar perfil do próprio usuário
 * Permite atualização de dados pessoais, endereço e redes sociais
 * Email só pode ser alterado se já estiver verificado
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const atualizarPerfil = async (req: Request, res: Response, next: NextFunction) => {
  const log = createControllerLogger(req, 'atualizarPerfil');
  const correlationId = req.id;

  try {
    const userId = req.user?.id;

    if (!userId) {
      log.warn('⚠️ Tentativa de atualizar perfil sem autenticação');
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        correlationId,
      });
    }

    log.info({ userId }, '👤 Iniciando atualização de perfil');

    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = formatZodErrors(parseResult.error);
      log.warn({ errors }, '⚠️ Dados inválidos para atualização de perfil');
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors,
        correlationId,
      });
    }

    const dados = parseResult.data;

    // CRÍTICO: Preservar req.body original para verificar quais campos foram realmente enviados
    // O Zod pode transformar campos não enviados, então precisamos verificar o body original
    const bodyOriginal = req.body;

    // Log dos dados recebidos após validação
    log.info(
      {
        userId,
        dadosRecebidos: dados,
        dadosKeys: Object.keys(dados),
        bodyOriginal,
        bodyOriginalKeys: Object.keys(bodyOriginal),
      },
      '📥 Dados recebidos após validação Zod',
    );

    // Buscar usuário atual para verificar email verificado
    const usuarioAtual = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        UsuariosVerificacaoEmail: {
          select: {
            emailVerificado: true,
            emailVerificadoEm: true,
          },
        },
      },
    });

    if (!usuarioAtual) {
      log.warn({ userId }, '⚠️ Usuário não encontrado ao atualizar perfil');
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        correlationId,
      });
    }

    const emailVerificado = usuarioAtual.UsuariosVerificacaoEmail?.emailVerificado ?? false;

    // Validar se pode alterar email
    if (dados.email !== undefined && dados.email !== usuarioAtual.email) {
      if (!emailVerificado) {
        log.warn({ userId }, '⚠️ Tentativa de alterar email não verificado');
        return res.status(403).json({
          success: false,
          message:
            'Email só pode ser alterado após verificação. Verifique seu email atual primeiro.',
          code: 'EMAIL_NOT_VERIFIED',
          correlationId,
        });
      }

      // Verificar se novo email já está em uso
      const emailJaExiste = await prisma.usuarios.findFirst({
        where: {
          email: dados.email.trim().toLowerCase(),
          id: { not: userId },
        },
      });

      if (emailJaExiste) {
        log.warn({ userId, email: dados.email }, '⚠️ Email já está em uso');
        return res.status(409).json({
          success: false,
          message: 'Este e-mail já está em uso por outro usuário',
          code: 'EMAIL_ALREADY_EXISTS',
          correlationId,
        });
      }
    }

    // Utilitários já importados no topo do arquivo

    // Atualizar dados em transação
    let usuarioAtualizado;
    try {
      usuarioAtualizado = await prisma.$transaction(
        async (tx) => {
          // Preparar dados de atualização do usuário
          const dadosAtualizacao: any = {};
          if (dados.nomeCompleto !== undefined) {
            dadosAtualizacao.nomeCompleto = dados.nomeCompleto.trim();
          }
          if (dados.email !== undefined && dados.email !== usuarioAtual.email) {
            dadosAtualizacao.email = dados.email.trim().toLowerCase();
            // Se email mudou, precisa re-verificar
            await tx.usuariosVerificacaoEmail.update({
              where: { usuarioId: userId },
              data: {
                emailVerificado: false,
                emailVerificadoEm: null,
                emailVerificationToken: null,
                emailVerificationTokenExp: null,
              },
            });
          }

          // Verificar se há qualquer atualização (dados básicos, informações, endereço, redes sociais)
          const temAtualizacaoBasica = Object.keys(dadosAtualizacao).length > 0;
          const temAtualizacaoInformacoes =
            dados.telefone !== undefined ||
            dados.genero !== undefined ||
            dados.dataNasc !== undefined ||
            dados.descricao !== undefined ||
            dados.avatarUrl !== undefined;
          const temAtualizacaoEndereco = dados.endereco !== undefined;
          const temAtualizacaoRedesSociais = dados.redesSociais !== undefined;

          const temQualquerAtualizacao =
            temAtualizacaoBasica ||
            temAtualizacaoInformacoes ||
            temAtualizacaoEndereco ||
            temAtualizacaoRedesSociais;

          // Sempre atualizar atualizadoEm quando houver qualquer mudança
          if (temQualquerAtualizacao) {
            dadosAtualizacao.atualizadoEm = new Date();
          }

          // Atualizar dados básicos (sempre atualiza atualizadoEm se houver qualquer mudança)
          if (temQualquerAtualizacao) {
            await tx.usuarios.update({
              where: { id: userId },
              data: dadosAtualizacao,
            });
          }

          // Preparar dados de informações
          // CRÍTICO: Processar apenas campos que foram REALMENTE enviados no req.body original
          // O Zod pode transformar campos não enviados, então verificamos bodyOriginal
          const dadosInformacoes: any = {};

          // telefone: obrigatório no schema, mas pode ser string vazia
          // Só processar se estiver presente no body original
          if ('telefone' in bodyOriginal) {
            if (dados.telefone !== undefined && dados.telefone !== null) {
              const telefoneLimpo = typeof dados.telefone === 'string' ? dados.telefone.trim() : '';
              dadosInformacoes.telefone = telefoneLimpo !== '' ? telefoneLimpo : '';
            } else {
              dadosInformacoes.telefone = '';
            }
          }

          // genero: pode ser null explicitamente
          // Só processar se estiver presente no body original
          if ('genero' in bodyOriginal) {
            dadosInformacoes.genero = dados.genero ?? null;
          }

          // dataNasc: pode ser null explicitamente
          // Só processar se estiver presente no body original
          if ('dataNasc' in bodyOriginal) {
            if (dados.dataNasc === null || dados.dataNasc === '' || dados.dataNasc === undefined) {
              dadosInformacoes.dataNasc = null;
            } else {
              // Converter string ISO para Date
              const dataNascDate = new Date(dados.dataNasc);
              if (!isNaN(dataNascDate.getTime()) && dataNascDate <= new Date()) {
                dadosInformacoes.dataNasc = dataNascDate;
              } else {
                log.warn(
                  { dataNasc: dados.dataNasc },
                  '⚠️ Data de nascimento inválida ou futura, definindo como null',
                );
                dadosInformacoes.dataNasc = null;
              }
            }
          }

          // descricao: pode ser null explicitamente
          // Só processar se estiver presente no body original
          if ('descricao' in bodyOriginal) {
            if (
              dados.descricao === null ||
              dados.descricao === '' ||
              dados.descricao === undefined
            ) {
              dadosInformacoes.descricao = null;
            } else {
              const descricaoLimpa =
                typeof dados.descricao === 'string' ? dados.descricao.trim() : '';
              dadosInformacoes.descricao = descricaoLimpa !== '' ? descricaoLimpa : null;
            }
          }

          // avatarUrl: pode ser null explicitamente
          // Só processar se estiver presente no body original
          if ('avatarUrl' in bodyOriginal) {
            if (
              dados.avatarUrl === null ||
              dados.avatarUrl === '' ||
              dados.avatarUrl === undefined
            ) {
              dadosInformacoes.avatarUrl = null;
            } else {
              const avatarUrlLimpo =
                typeof dados.avatarUrl === 'string' ? dados.avatarUrl.trim() : '';
              dadosInformacoes.avatarUrl = avatarUrlLimpo !== '' ? avatarUrlLimpo : null;
            }
          }

          // inscricao: pode ser null explicitamente (se existir no schema)
          // Só processar se estiver presente no body original
          if ('inscricao' in bodyOriginal) {
            if (
              dados.inscricao === null ||
              dados.inscricao === '' ||
              dados.inscricao === undefined
            ) {
              dadosInformacoes.inscricao = null;
            } else {
              const inscricaoLimpa =
                typeof dados.inscricao === 'string' ? dados.inscricao.trim() : '';
              dadosInformacoes.inscricao = inscricaoLimpa !== '' ? inscricaoLimpa : null;
            }
          }

          // Log para debug - sempre logar, mesmo se vazio
          log.info(
            {
              dadosInformacoes,
              userId,
              keysCount: Object.keys(dadosInformacoes).length,
              keys: Object.keys(dadosInformacoes),
              dadosRecebidos: {
                telefone: dados.telefone,
                genero: dados.genero,
                dataNasc: dados.dataNasc,
                descricao: dados.descricao,
              },
            },
            '📝 Dados de informações processados',
          );

          // Atualizar ou criar informações
          // IMPORTANTE: Sempre processar informações se houver campos para atualizar
          // Mesmo que alguns campos sejam null, eles devem ser salvos explicitamente
          if (Object.keys(dadosInformacoes).length > 0 || temAtualizacaoInformacoes) {
            // Verificar se registro existe ANTES de qualquer operação
            const infoExistente = await tx.usuariosInformation.findUnique({
              where: { usuarioId: userId },
            });

            log.info(
              {
                userId,
                infoExistente: !!infoExistente,
                infoExistenteGenero: infoExistente?.genero,
                infoExistenteDataNasc: infoExistente?.dataNasc,
                infoExistenteDescricao: infoExistente?.descricao,
                dadosInformacoes,
                keysCount: Object.keys(dadosInformacoes).length,
                keysList: Object.keys(dadosInformacoes),
              },
              '🔍 Verificando informações existentes',
            );

            if (infoExistente) {
              log.info(
                {
                  dadosInformacoes,
                  userId,
                  infoExistenteId: infoExistente.usuarioId,
                  dadosAntes: {
                    genero: infoExistente.genero,
                    dataNasc: infoExistente.dataNasc,
                    descricao: infoExistente.descricao,
                  },
                },
                '🔄 Atualizando informações existentes',
              );

              // IMPORTANTE: Usar dadosInformacoes diretamente, que já contém todos os campos processados
              // Se um campo está em dadosInformacoes (mesmo que null), ele deve ser atualizado
              // Se não está em dadosInformacoes, preservar valor existente
              const dataToUpdate: any = {};

              // Apenas incluir campos que foram explicitamente enviados (estão em dadosInformacoes)
              if ('telefone' in dadosInformacoes) {
                dataToUpdate.telefone =
                  dadosInformacoes.telefone !== null && dadosInformacoes.telefone !== ''
                    ? dadosInformacoes.telefone
                    : '';
              }
              if ('genero' in dadosInformacoes) {
                dataToUpdate.genero = dadosInformacoes.genero; // Pode ser null
              }
              if ('dataNasc' in dadosInformacoes) {
                dataToUpdate.dataNasc = dadosInformacoes.dataNasc; // Pode ser null
              }
              if ('descricao' in dadosInformacoes) {
                dataToUpdate.descricao = dadosInformacoes.descricao; // Pode ser null
              }
              if ('avatarUrl' in dadosInformacoes) {
                dataToUpdate.avatarUrl = dadosInformacoes.avatarUrl; // Pode ser null
              }
              if ('inscricao' in dadosInformacoes) {
                dataToUpdate.inscricao = dadosInformacoes.inscricao; // Pode ser null
              }

              log.info(
                {
                  userId,
                  dataToUpdate,
                  dadosInformacoes,
                  keysInDadosInformacoes: Object.keys(dadosInformacoes),
                },
                '📝 Dados preparados para update',
              );

              if (Object.keys(dataToUpdate).length === 0) {
                log.warn(
                  { userId, dadosInformacoes },
                  '⚠️ Nenhum campo para atualizar após processamento',
                );
              } else {
                const updated = await tx.usuariosInformation.update({
                  where: { usuarioId: userId },
                  data: dataToUpdate,
                });
                log.info(
                  {
                    userId,
                    updated: {
                      genero: updated.genero,
                      dataNasc: updated.dataNasc,
                      descricao: updated.descricao,
                      telefone: updated.telefone,
                    },
                  },
                  '✅ Informações atualizadas com sucesso - verificando persistência',
                );

                // Verificar imediatamente após update se foi salvo
                const verifyAfterUpdate = await tx.usuariosInformation.findUnique({
                  where: { usuarioId: userId },
                });
                log.info(
                  {
                    userId,
                    verifyAfterUpdate: {
                      genero: verifyAfterUpdate?.genero,
                      dataNasc: verifyAfterUpdate?.dataNasc,
                      descricao: verifyAfterUpdate?.descricao,
                      telefone: verifyAfterUpdate?.telefone,
                    },
                  },
                  '🔍 Verificação imediata após update',
                );
              }
            } else {
              log.info(
                { dadosInformacoes, userId, keysInDadosInformacoes: Object.keys(dadosInformacoes) },
                '➕ Criando novas informações',
              );

              // Ao criar, garantir que telefone tenha um valor válido (é obrigatório no schema)
              // Se telefone não foi enviado ou está vazio, usar string vazia como padrão
              if (
                !('telefone' in dadosInformacoes) ||
                !dadosInformacoes.telefone ||
                dadosInformacoes.telefone === ''
              ) {
                dadosInformacoes.telefone = '';
              }

              // Garantir que todos os campos estejam presentes (mesmo que null)
              // IMPORTANTE: Usar valores de dadosInformacoes diretamente, que já foram processados
              // Declarado fora do try para ser acessível no catch
              const dataToCreate: any = {
                usuarioId: userId,
                aceitarTermos: false,
                telefone: dadosInformacoes.telefone || '',
              };

              // Adicionar campos apenas se estiverem em dadosInformacoes
              if ('genero' in dadosInformacoes) {
                dataToCreate.genero = dadosInformacoes.genero; // Pode ser null
              }
              if ('dataNasc' in dadosInformacoes) {
                dataToCreate.dataNasc = dadosInformacoes.dataNasc; // Pode ser null
              }
              if ('descricao' in dadosInformacoes) {
                dataToCreate.descricao = dadosInformacoes.descricao; // Pode ser null
              }
              if ('avatarUrl' in dadosInformacoes) {
                dataToCreate.avatarUrl = dadosInformacoes.avatarUrl; // Pode ser null
              }
              if ('inscricao' in dadosInformacoes) {
                dataToCreate.inscricao = dadosInformacoes.inscricao; // Pode ser null
              }

              try {
                log.info(
                  {
                    userId,
                    dataToCreate,
                    dataToCreateKeys: Object.keys(dataToCreate),
                    dadosInformacoes,
                  },
                  '➕ Tentando criar UsuariosInformation com dados completos',
                );

                const created = await tx.usuariosInformation.create({
                  data: dataToCreate,
                });
                log.info(
                  {
                    userId,
                    created: {
                      genero: created.genero,
                      dataNasc: created.dataNasc,
                      descricao: created.descricao,
                      telefone: created.telefone,
                    },
                  },
                  '✅ Informações criadas com sucesso - verificando persistência',
                );

                // Verificar imediatamente após create se foi salvo (dentro da mesma transação)
                const verifyAfterCreate = await tx.usuariosInformation.findUnique({
                  where: { usuarioId: userId },
                });
                if (verifyAfterCreate) {
                  log.info(
                    {
                      userId,
                      verifyAfterCreate: {
                        genero: verifyAfterCreate.genero,
                        dataNasc: verifyAfterCreate.dataNasc,
                        descricao: verifyAfterCreate.descricao,
                        telefone: verifyAfterCreate.telefone,
                      },
                    },
                    '🔍 Verificação imediata após create - registro encontrado',
                  );
                } else {
                  log.error(
                    { userId },
                    '❌ CRÍTICO: Registro não encontrado após create na mesma transação!',
                  );
                }
              } catch (createError: any) {
                const errorDetails = {
                  name: createError?.name,
                  message: createError?.message,
                  code: createError?.code,
                  meta: createError?.meta,
                  cause: createError?.cause,
                  stack: createError?.stack?.substring(0, 500),
                };
                log.error(
                  { err: createError, errorDetails, userId, dadosInformacoes, dataToCreate },
                  '❌ Erro ao criar UsuariosInformation',
                );

                // Se for erro do Prisma, logar detalhes específicos
                if (createError?.code) {
                  log.error(
                    {
                      prismaErrorCode: createError.code,
                      prismaMeta: createError.meta,
                      prismaMessage: createError.message,
                    },
                    '❌ Erro do Prisma detectado',
                  );
                }

                throw createError;
              }
            }
          } else {
            log.warn({ userId, dados }, '⚠️ Nenhum dado de informações para atualizar');
          }

          // Atualizar redes sociais
          const redesSociaisSanitizado = sanitizeSocialLinks(dados.redesSociais);
          const redesSociaisUpdate = buildSocialLinksUpdateData(redesSociaisSanitizado);

          if (redesSociaisUpdate) {
            const redesSociaisExistente = await tx.usuariosRedesSociais.findUnique({
              where: { usuarioId: userId },
            });

            if (redesSociaisExistente) {
              await tx.usuariosRedesSociais.update({
                where: { usuarioId: userId },
                data: {
                  ...redesSociaisUpdate,
                  updatedAt: new Date(),
                },
              });
            } else {
              await tx.usuariosRedesSociais.create({
                data: {
                  usuarioId: userId,
                  ...redesSociaisUpdate,
                  updatedAt: new Date(),
                },
              });
            }
          }

          // Atualizar endereço (atualiza o primeiro endereço ou cria novo)
          if (dados.endereco) {
            const enderecoSanitizado: any = {};
            if (dados.endereco.logradouro !== undefined)
              enderecoSanitizado.logradouro = dados.endereco.logradouro?.trim() || null;
            if (dados.endereco.numero !== undefined)
              enderecoSanitizado.numero = dados.endereco.numero?.trim() || null;
            if (dados.endereco.bairro !== undefined)
              enderecoSanitizado.bairro = dados.endereco.bairro?.trim() || null;
            if (dados.endereco.cidade !== undefined)
              enderecoSanitizado.cidade = dados.endereco.cidade?.trim() || null;
            if (dados.endereco.estado !== undefined)
              enderecoSanitizado.estado = dados.endereco.estado?.trim().toUpperCase() || null;
            if (dados.endereco.cep !== undefined) {
              const cepLimpo = dados.endereco.cep?.replace(/\D/g, '') || null;
              enderecoSanitizado.cep = cepLimpo;
            }

            if (Object.keys(enderecoSanitizado).length > 0) {
              enderecoSanitizado.atualizadoEm = new Date();

              const enderecoExistente = await tx.usuariosEnderecos.findFirst({
                where: { usuarioId: userId },
                orderBy: { criadoEm: 'asc' },
              });

              if (enderecoExistente) {
                await tx.usuariosEnderecos.update({
                  where: { id: enderecoExistente.id },
                  data: enderecoSanitizado,
                });
              } else {
                await tx.usuariosEnderecos.create({
                  data: {
                    usuarioId: userId,
                    ...enderecoSanitizado,
                    criadoEm: new Date(),
                  },
                });
              }
            }
          }

          // Buscar dados completos atualizados
          const usuarioCompleto = await tx.usuarios.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              nomeCompleto: true,
              cpf: true,
              cnpj: true,
              role: true,
              status: true,
              tipoUsuario: true,
              authId: true,
              ultimoLogin: true,
              criadoEm: true,
              atualizadoEm: true,
              codUsuario: true,
              UsuariosRedesSociais: {
                select: {
                  id: true,
                  instagram: true,
                  linkedin: true,
                  facebook: true,
                  youtube: true,
                  twitter: true,
                  tiktok: true,
                },
              },
              UsuariosInformation: {
                select: usuarioInformacoesSelect,
              },
              UsuariosEnderecos: {
                orderBy: { criadoEm: 'asc' },
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
              UsuariosVerificacaoEmail: {
                select: {
                  emailVerificado: true,
                  emailVerificadoEm: true,
                  emailVerificationToken: true,
                  emailVerificationTokenExp: true,
                  emailVerificationAttempts: true,
                  ultimaTentativaVerificacao: true,
                },
              },
            },
          });

          return usuarioCompleto!;
        },
        {
          timeout: 10000, // 10 segundos de timeout
          maxWait: 5000, // 5 segundos máximo de espera
        },
      );
    } catch (transactionError: any) {
      const errorDetails = {
        name: transactionError?.name,
        message: transactionError?.message,
        code: transactionError?.code,
        meta: transactionError?.meta,
        cause: transactionError?.cause,
        stack: transactionError?.stack?.substring(0, 500),
      };
      log.error(
        {
          err: transactionError,
          errorDetails,
          userId,
          dados,
          prismaErrorCode: transactionError?.code,
          prismaMeta: transactionError?.meta,
        },
        '❌ Erro na transação de atualização de perfil',
      );

      // Se for erro do Prisma, logar detalhes específicos
      if (transactionError?.code) {
        log.error(
          {
            prismaErrorCode: transactionError.code,
            prismaMeta: transactionError.meta,
            prismaMessage: transactionError.message,
          },
          '❌ Erro do Prisma na transação',
        );
      }

      throw transactionError;
    }

    // Log para debug - verificar se dados foram salvos
    log.info(
      {
        userId,
        UsuariosInformation: usuarioAtualizado.UsuariosInformation,
        atualizadoEm: usuarioAtualizado.atualizadoEm,
      },
      '✅ Dados atualizados no banco - verificando persistência',
    );

    // Validação pós-update: verificar diretamente no banco se dados foram persistidos
    try {
      const infoVerificada = await prisma.usuariosInformation.findUnique({
        where: { usuarioId: userId },
        select: {
          telefone: true,
          genero: true,
          dataNasc: true,
          descricao: true,
          avatarUrl: true,
          inscricao: true,
        },
      });

      if (infoVerificada) {
        log.info(
          {
            userId,
            dadosPersistidos: infoVerificada,
            dadosEsperados: {
              telefone: dados.telefone,
              genero: dados.genero,
              dataNasc: dados.dataNasc,
              descricao: dados.descricao,
            },
            match: {
              genero: infoVerificada.genero === (dados.genero || null),
              dataNasc:
                infoVerificada.dataNasc?.toISOString() ===
                (dados.dataNasc ? new Date(dados.dataNasc).toISOString() : null),
              descricao: infoVerificada.descricao === (dados.descricao || null),
            },
          },
          '🔍 Validação pós-update: dados verificados no banco',
        );
      } else {
        log.warn(
          { userId },
          '⚠️ Validação pós-update: registro não encontrado no banco após transação',
        );
      }
    } catch (validationError: any) {
      log.error({ err: validationError, userId }, '❌ Erro ao validar persistência pós-update');
      // Não lançar erro aqui, apenas logar - a transação já foi commitada
    }

    // Invalidar cache para forçar nova busca do banco
    const cacheKey = `user:${userId}`;
    try {
      // Invalidar diretamente pela chave exata usada no GET /perfil
      await deleteCache(cacheKey);
      await invalidateUserCache(usuarioAtualizado);
      log.info({ userId, cacheKey }, '🗑️ Cache invalidado com sucesso');
    } catch (cacheError: any) {
      log.error({ err: cacheError, userId, cacheKey }, '⚠️ Erro ao invalidar cache (não crítico)');
      // Tentar invalidar novamente para garantir
      try {
        await deleteCache(cacheKey);
      } catch (retryError) {
        log.error({ err: retryError, userId, cacheKey }, '❌ Falha ao invalidar cache no retry');
      }
    }

    // Preparar resposta
    const verification = normalizeEmailVerification(usuarioAtualizado.UsuariosVerificacaoEmail);
    const usuario = attachEnderecoResumo(
      mergeUsuarioInformacoes({
        ...usuarioAtualizado,
        emailVerificado: verification.emailVerificado,
        emailVerificadoEm: verification.emailVerificadoEm,
        UsuariosVerificacaoEmail: buildEmailVerificationSummary(
          usuarioAtualizado.UsuariosVerificacaoEmail,
        ),
        redesSociais: usuarioAtualizado.UsuariosRedesSociais,
        UsuariosEnderecos: usuarioAtualizado.UsuariosEnderecos,
      }),
    ) as UsuarioPerfil;

    const profileStats = buildProfileStats(usuario);

    // Formata resposta removendo redundâncias (mesma formatação do GET)
    const usuarioResponse = formatUsuarioResponse(usuario);

    log.info({ userId }, '✅ Perfil atualizado com sucesso');

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      usuario: usuarioResponse,
      stats: profileStats,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, userId: req.user?.id }, '❌ Erro ao atualizar perfil');

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
      UsuariosVerificacaoEmailRequired: true,
      rateLimitingIntegrated: true,
      correlationIdTracking: true,
      securePasswordHandling: true,
    },
    endpoints: {
      loginUsuario: 'POST /login',
      logoutUsuario: 'POST /logout',
      refreshToken: 'POST /refresh',
      obterPerfil: 'GET /perfil',
      atualizarPerfil: 'PUT /perfil',
    },
    lastUpdated: '2025-08-04T18:00:00Z',
  };
};

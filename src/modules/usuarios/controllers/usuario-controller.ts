import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { loginCache, getCache, userCache, setCache } from '@/utils/cache';
import {
  clearRefreshTokenCookie,
  extractRefreshTokenFromRequest,
  generateTokenPair,
  getRefreshTokenExpiration,
  setRefreshTokenCookie,
} from '@/modules/usuarios/utils/auth';
import { limparDocumento, validarCNPJ, validarCPF } from '@/modules/usuarios/utils';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { formatZodErrors, loginSchema } from '../validators/auth.schema';
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
import { mapSocialLinks } from '../utils/social-links';
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
    usuario.UsuariosEnderecos ?? (usuario as any).UsuariosEnderecos,
  );
  const [principal] = enderecos;
  const informacoes = mapUsuarioInformacoes(usuario.UsuariosInformation);
  const dataNasc = informacoes.dataNasc ?? (usuario.dataNasc ? new Date(usuario.dataNasc) : null);

  return {
    ...usuario,
    redesSociais: mapSocialLinks(usuario.redesSociais),
    criadoEm: new Date(usuario.criadoEm),
    atualizadoEm: new Date(usuario.atualizadoEm),
    emailVerificadoEm: usuario.emailVerificadoEm ? new Date(usuario.emailVerificadoEm) : null,
    ultimoLogin: usuario.ultimoLogin ? new Date(usuario.ultimoLogin) : null,
    dataNasc,
    telefone: informacoes.telefone,
    genero: informacoes.genero,
    inscricao: informacoes.inscricao,
    avatarUrl: informacoes.avatarUrl,
    descricao: informacoes.descricao,
    aceitarTermos: informacoes.aceitarTermos,
    informacoes: {
      ...informacoes,
      dataNasc,
    },
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
    cidade: principal?.cidade ?? null,
    estado: principal?.estado ?? null,
  };
};

const buildProfileStats = (usuario: UsuarioPerfil) => ({
  accountAge: Math.floor((Date.now() - usuario.criadoEm.getTime()) / (1000 * 60 * 60 * 24)),
  hasCompletedProfile: !!(usuario.telefone && usuario.nomeCompleto),
  hasAddress: (usuario.UsuariosEnderecos ?? usuario.enderecos ?? []).length > 0,
  totalOrders: 0,
  totalSubscriptions: 0,
  UsuariosVerificacaoEmailStatus: {
    verified: usuario.UsuariosVerificacaoEmail.verified,
    verifiedAt: usuario.UsuariosVerificacaoEmail.verifiedAt,
    tokenExpiration: usuario.UsuariosVerificacaoEmail.tokenExpiration,
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
            supabaseId: true,
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
    await loginCache.setBlocked(documentoLimpo, false, 0); // Remove bloqueio
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
      supabaseId: usuario.supabaseId,
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
            supabaseId: true,
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
      supabaseId: usuario.supabaseId,
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
        supabaseId: true,
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
      ...UsuariosSemVerificacao
    } = usuarioDb ?? {};
    const verification = normalizeEmailVerification(UsuariosVerificacaoEmail);
    const usuario = attachEnderecoResumo(
      usuarioDb
        ? mergeUsuarioInformacoes({
            ...UsuariosSemVerificacao,
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
    },
    lastUpdated: '2025-08-04T18:00:00Z',
  };
};

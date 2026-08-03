import { Router } from 'express';
import { criarUsuario } from '../register';
import {
  loginUsuario,
  logoutUsuario,
  refreshToken,
  obterPerfil,
  atualizarPerfil,
} from '../controllers';
import { supabaseAuthMiddleware } from '../auth';
import { WelcomeEmailMiddleware } from '../../brevo/middlewares/welcome-email-middleware';
import passwordRecoveryRoutes from './password-recovery';
import { asyncHandler } from '../../../utils/asyncHandler';
import { logger } from '@/utils/logger';

/**
 * Rotas de usuário atualizadas com sistema de verificação de email
 * Implementa middleware de email corrigido e funcional
 *
 * @author Sistema Advance+
 * @version 7.0.0 - Sistema de verificação de email implementado
 */
const router = Router();
const usuarioRoutesLogger = logger.child({ module: 'UsuarioRoutes' });

// ===========================
// MIDDLEWARES GLOBAIS
// ===========================

/**
 * Middleware de logging e correlation ID
 */
router.use((req, res, next) => {
  const startTime = Date.now();
  const correlationId =
    req.headers['x-correlation-id'] ||
    `user-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;

  // Adiciona correlation ID ao request
  req.headers['x-correlation-id'] = correlationId;

  const requestLogger = usuarioRoutesLogger.child({
    correlationId,
    method: req.method,
    path: req.path,
  });
  requestLogger.info('🌐 Requisição iniciada');

  // Override do res.json para capturar tempo de resposta
  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;
    requestLogger.info({ status: res.statusCode, duration }, '📤 Resposta enviada');
    return originalJson.call(this, data);
  };

  next();
});

/**
 * Rate limiting inteligente para autenticação
 */
const createAuthRateLimit = (maxRequests: number = 5, windowMinutes: number = 15) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: any, next: any) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;

    // Limpa entradas expiradas
    for (const [key, data] of attempts.entries()) {
      if (data.resetTime < now) {
        attempts.delete(key);
      }
    }

    // Verifica tentativas do cliente
    const clientAttempts = attempts.get(clientId) || {
      count: 0,
      resetTime: now + windowMs,
    };

    if (clientAttempts.count >= maxRequests && clientAttempts.resetTime > now) {
      const resetInMinutes = Math.ceil((clientAttempts.resetTime - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas. Tente novamente em ${resetInMinutes} minutos`,
        retryAfter: resetInMinutes * 60,
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    // Incrementa contador
    clientAttempts.count++;
    if (clientAttempts.resetTime < now) {
      clientAttempts.resetTime = now + windowMs;
      clientAttempts.count = 1;
    }

    attempts.set(clientId, clientAttempts);
    next();
  };
};

const passwordRecoveryRequestRateLimit = createAuthRateLimit(3, 60); // 3 tentativas por hora

// ===========================
// ROTAS PÚBLICAS
// ===========================

/**
 * Informações da API de usuários
 * GET /usuarios
 */
/**
 * @openapi
 * /api/v1/usuarios:
 *   get:
 *     summary: Informações do módulo de usuários
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Detalhes do módulo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 module: { type: string, example: "Usuários API" }
 *                 version: { type: string, example: "7.0.0" }
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T12:00:00Z"
 *                 environment: { type: string, example: "development" }
 *                 features:
 *                   type: object
 *                   properties:
 *                     UsuariosVerificacaoEmail: { type: boolean, example: true }
 *                     registration: { type: boolean, example: true }
 *                     authentication: { type: boolean, example: true }
 *                     profileManagement: { type: boolean, example: true }
 *                     passwordRecovery: { type: boolean, example: true }
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     auth:
 *                       type: object
 *                       properties:
 *                         register: { type: string, example: "POST /registrar" }
 *                         login: { type: string, example: "POST /login" }
 *                         logout: { type: string, example: "POST /logout" }
 *                         refresh: { type: string, example: "POST /refresh" }
 *                     profile:
 *                       type: object
 *                       properties:
 *                         get: { type: string, example: "GET /perfil" }
 *                         update: { type: string, example: "PUT /perfil" }
 *                     recovery:
 *                       type: object
 *                       properties:
 *                         request: { type: string, example: "POST /recuperar-senha" }
 *                         validate: { type: string, example: "GET /recuperar-senha/validar/:token" }
 *                         reset: { type: string, example: "POST /recuperar-senha/redefinir" }
 *                     verification:
 *                       type: object
 *                       properties:
 *                         verify: { type: string, example: "GET /verificar-email?token=xxx" }
 *                         resend: { type: string, example: "POST /reenviar-verificacao" }
 *                         status: { type: string, example: "GET /status-verificacao/:userId" }
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 */
router.get('/', (req, res) => {
  res.json({
    module: 'Usuários API',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    features: {
      UsuariosVerificacaoEmail: process.env.EMAIL_VERIFICATION_REQUIRED !== 'false',
      registration: true,
      authentication: true,
      profileManagement: true,
      passwordRecovery: true,
    },
    endpoints: {
      auth: {
        register: 'POST /registrar',
        login: 'POST /login',
        logout: 'POST /logout',
        refresh: 'POST /refresh',
      },
      profile: {
        get: 'GET /perfil',
        update: 'PUT /perfil', // ✅ Implementado
      },
      recovery: {
        request: 'POST /recuperar-senha',
        validate: 'GET /recuperar-senha/validar/:token',
        reset: 'POST /recuperar-senha/redefinir',
      },
      verification: {
        verify: 'GET /verificar-email?token=xxx',
        resend: 'POST /reenviar-verificacao',
        status: 'GET /status-verificacao/:userId',
      },
    },
    status: 'operational',
  });
});

/**
 * Registro de novo usuário com middleware de email CORRIGIDO
 * POST /registrar
 *
 * FLUXO ATUALIZADO:
 * 1. Rate limiting (3 tentativas por 10 minutos)
 * 2. Log de início do processo
 * 3. criarUsuario -> cria usuário e define res.locals.UsuariosCriado
 * 4. Middleware de debug -> verifica dados
 * 5. WelcomeEmailMiddleware -> envia email/verificação de forma assíncrona
 */
/**
 * @openapi
 * /api/v1/usuarios/registrar:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegisterRequest'
 *     responses:
 *       201:
 *         description: Usuário criado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserRegisterResponse'
 *             example:
 *               success: true
 *               message: "Pessoa física cadastrada com sucesso"
 *               usuario:
 *                 id: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab"
 *                 email: "joao@example.com"
 *                 nomeCompleto: "João da Silva"
 *                 tipoUsuario: "PESSOA_FISICA"
 *                 role: "ALUNO_CANDIDATO"
 *                 status: "ATIVO"
 *                 criadoEm: "2024-03-01T12:00:00.000Z"
 *                 codUsuario: "USR-00001"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               duration: "245ms"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Dados de entrada inválidos"
 *               errors:
 *                 - path: "cpf"
 *                   message: "CPF é obrigatório"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       409:
 *         description: Usuário já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Usuário já cadastrado"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       429:
 *         description: Muitas tentativas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Muitas tentativas. Tente novamente mais tarde"
 *               code: "RATE_LIMIT_EXCEEDED"
 *               retryAfter: 600
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/registrar" \
 *            -H "Content-Type: application/json" \
 *            -d '{"nomeCompleto":"João da Silva","documento":"12345678900","telefone":"11999999999","email":"joao@example.com","senha":"senha123","confirmarSenha":"senha123","aceitarTermos":true,"authId":"uuid","tipoUsuario":"PESSOA_FISICA"}'
 */
router.post(
  '/registrar',
  createAuthRateLimit(3, 10), // 3 tentativas por 10 minutos
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'registrar' })
      .info('📝 Iniciando processo de registro');
    next();
  },
  asyncHandler(criarUsuario), // Controller principal que cria usuário
  async (req, res, next) => {
    // Middleware de debug para verificar dados
    const correlationId = req.headers['x-correlation-id'];
    const log = usuarioRoutesLogger.child({ correlationId, route: 'registrar' });
    log.info('🔍 Verificando dados para middleware de email');

    if (res.locals?.UsuariosCriado?.usuario) {
      const user = res.locals.UsuariosCriado.usuario;
      log.info(
        {
          id: user.id,
          email: user.email,
          nome: user.nomeCompleto,
          tipo: user.tipoUsuario,
        },
        '✅ Dados prontos para email',
      );
    } else {
      log.warn('⚠️ Dados não encontrados em res.locals.UsuariosCriado');
      log.warn({ resLocals: res.locals }, '⚠️ Detalhes do res.locals');
    }

    next();
  },
  WelcomeEmailMiddleware.create(), // Middleware de email assíncrono
);

/**
 * Login de usuário
 * POST /login
 */
/**
 * @openapi
 * /api/v1/usuarios/login:
 *   post:
 *     summary: Login de usuário (Otimizado com Cache e Rate Limiting)
 *     description: |-
 *       Autentica o usuário, gera par de tokens JWT e define um cookie HTTP-only com o refresh token.
 *       Marque `rememberMe` para manter a sessão ativa por mais tempo no mesmo dispositivo/navegador.
 *
 *       **⚡ Otimizações de Performance:**
 *       - ✅ **Timeout**: 3s por tentativa, máximo 6-9s total (fail-fast)
 *       - ✅ **Cache Redis**: Rate limiting e bloqueio automático (fallback in-memory)
 *       - ✅ **Rate Limit**: 5 tentativas por 15 minutos
 *       - ✅ **Bloqueio Automático**: Após 5 tentativas falhadas = 1 hora bloqueado
 *       - ✅ **Índices Otimizados**: CPF/CNPJ/Email com status para busca rápida
 *
 *       **📊 Performance Esperada:**
 *       - Login bem-sucedido: 50-100ms (p50)
 *       - Com banco lento: 6-9s fail-fast (vs 30s+ antes)
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserLoginResponse'
 *             example:
 *               success: true
 *               message: "Login realizado com sucesso"
 *               usuario:
 *                 id: "f9e88a12-0b88-4d43-9b1f-1234567890ab"
 *                 email: "joao@example.com"
 *                 nomeCompleto: "João da Silva"
 *                 role: "ALUNO_CANDIDATO"
 *                 tipoUsuario: "PESSOA_FISICA"
 *                 authId: "uuid-auth"
 *                 emailVerificado: true
 *                 ultimoLogin: "2024-03-12T10:15:00.000Z"
 *                 socialLinks: {}
 *                 enderecos: []
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               tokenType: "Bearer"
 *               expiresIn: "1h"
 *               rememberMe: true
 *               refreshTokenExpiresIn: "90d"
 *               refreshTokenExpiresAt: "2024-06-10T12:00:00.000Z"
 *               session:
 *                 id: "f9e88a12-0b88-4d43-9b1f-1234567890ab"
 *                 rememberMe: true
 *                 createdAt: "2024-03-12T10:15:00.000Z"
 *                 expiresAt: "2024-06-10T12:00:00.000Z"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               timestamp: "2024-03-12T10:15:01.234Z"
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Cookie HTTP-only com o refresh token (`AUTH_REFRESH_COOKIE_NAME`).
 *       400:
 *         description: Dados ausentes ou inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Dados de login inválidos"
 *               errors:
 *                 - path: "documento"
 *                   message: "Documento é obrigatório"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Credenciais inválidas"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       403:
 *         description: Conta bloqueada ou email não verificado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               emailNaoVerificado:
 *                 summary: Email não verificado
 *                 value:
 *                   success: false
 *                   message: "Email não verificado. Verifique sua caixa de entrada ou solicite um novo email de verificação."
 *                   code: "EMAIL_NOT_VERIFIED"
 *                   data:
 *                     email: "joao@example.com"
 *                     canResendVerification: true
 *                     accountCreated: "2024-03-10T18:32:00.000Z"
 *                     accountAgeDays: 2
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               contaInativa:
 *                 summary: Conta não está ativa
 *                 value:
 *                   success: false
 *                   message: "Conta suspenso. Entre em contato com o suporte."
 *                   code: "ACCOUNT_INACTIVE"
 *                   status: "SUSPENSO"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       429:
 *         description: Muitas tentativas de login ou bloqueio temporário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               rateLimit:
 *                 summary: Rate limit excedido
 *                 value:
 *                   success: false
 *                   message: "Muitas tentativas. Tente novamente mais tarde"
 *                   code: "RATE_LIMIT_EXCEEDED"
 *                   retryAfter: 900
 *               blocked:
 *                 summary: Bloqueio temporário (5 tentativas falhadas)
 *                 value:
 *                   success: false
 *                   message: "Muitas tentativas de login. Tente novamente mais tarde."
 *                   code: "LOGIN_BLOCKED"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       503:
 *         description: Serviço temporariamente indisponível (banco de dados não disponível)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Serviço temporariamente indisponível. Por favor, tente novamente mais tarde."
 *               code: "SERVICE_UNAVAILABLE"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/login" \
 *            -H "Content-Type: application/json" \
 *            -d '{"documento":"12345678900","senha":"senha123","rememberMe":true}' \
 *            -c cookies.txt
 */
router.post(
  '/login',
  createAuthRateLimit(5, 15), // 5 tentativas por 15 minutos
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'login' })
      .info(
        { documento: req.body.documento || 'documento não fornecido' },
        '🔐 Tentativa de login',
      );
    next();
  },
  asyncHandler(loginUsuario),
);

/**
 * Refresh token
 * POST /refresh
 */
/**
 * @openapi
 * /api/v1/usuarios/refresh:
 *   post:
 *     summary: Atualizar token JWT
 *     description: |-
 *       Gera um novo par de tokens a partir do refresh token enviado no corpo, cookie HTTP-only ou header `x-refresh-token`.
 *       O cookie de refresh token é renovado conforme a preferência de `rememberMe` definida durante o login.
 *     tags: [Usuários]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 *             example:
 *               success: true
 *               message: "Token renovado com sucesso"
 *               usuario:
 *                 id: "f9e88a12-0b88-4d43-9b1f-1234567890ab"
 *                 email: "joao@example.com"
 *                 nomeCompleto: "João da Silva"
 *                 role: "ALUNO_CANDIDATO"
 *                 tipoUsuario: "PESSOA_FISICA"
 *                 emailVerificado: true
 *                 ultimoLogin: "2024-03-12T10:18:00.000Z"
 *                 socialLinks: {}
 *                 enderecos: []
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               rememberMe: true
 *               refreshTokenExpiresAt: "2024-06-10T12:00:00.000Z"
 *               session:
 *                 id: "f9e88a12-0b88-4d43-9b1f-1234567890ab"
 *                 rememberMe: true
 *                 createdAt: "2024-03-12T10:15:00.000Z"
 *                 expiresAt: "2024-06-10T12:00:00.000Z"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               timestamp: "2024-03-12T10:18:01.234Z"
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Cookie HTTP-only atualizado com o refresh token (`AUTH_REFRESH_COOKIE_NAME`).
 *       400:
 *         description: Refresh token ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Refresh token é obrigatório"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       401:
 *         description: Refresh token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalido:
 *                 summary: Token não reconhecido
 *                 value:
 *                   success: false
 *                   message: "Refresh token inválido"
 *                   code: "INVALID_REFRESH_TOKEN"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               expirado:
 *                 summary: Token expirado
 *                 value:
 *                   success: false
 *                   message: "Refresh token expirado"
 *                   code: "REFRESH_TOKEN_EXPIRED"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       403:
 *         description: Conta bloqueada ou email não verificado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               contaInativa:
 *                 summary: Conta não está ativa
 *                 value:
 *                   success: false
 *                   message: "Conta suspenso"
 *                   code: "ACCOUNT_INACTIVE"
 *                   status: "SUSPENSO"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               emailNaoVerificado:
 *                 summary: Email não verificado
 *                 value:
 *                   success: false
 *                   message: "Email não verificado. Verifique sua caixa de entrada."
 *                   code: "EMAIL_NOT_VERIFIED"
 *                   correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       429:
 *         description: Muitas tentativas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Muitas tentativas. Tente novamente mais tarde"
 *               code: "RATE_LIMIT_EXCEEDED"
 *               retryAfter: 900
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/refresh" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{"refreshToken":"<TOKEN>"}' \\
 *            -b cookies.txt -c cookies.txt
 */
router.post(
  '/refresh',
  createAuthRateLimit(10, 15), // 10 tentativas por 15 minutos
  asyncHandler(refreshToken),
);

// ===========================
// ROTAS PROTEGIDAS
// ===========================

/**
 * Logout de usuário
 * POST /logout
 */
/**
 * @openapi
 * /api/v1/usuarios/logout:
 *   post:
 *     summary: Logout do usuário
 *     description: Revoga sessões ativas do usuário autenticado, remove o refresh token do banco e limpa o cookie HTTP-only de sessão.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout efetuado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogoutResponse'
 *             example:
 *               success: true
 *               message: "Logout realizado com sucesso"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               timestamp: "2024-03-12T10:20:01.234Z"
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *             description: Cookie HTTP-only de refresh token removido (`AUTH_REFRESH_COOKIE_NAME`).
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Usuário não autenticado"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X POST "http://localhost:3000/api/v1/usuarios/logout" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.post(
  '/logout',
  supabaseAuthMiddleware(),
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'logout' })
      .info({ userId: req.user?.id ?? 'ID não disponível' }, '🚪 Logout do usuário');
    next();
  },
  asyncHandler(logoutUsuario),
);

/**
 * Perfil do usuário autenticado
 * GET /perfil
 */
/**
 * @openapi
 * /api/v1/usuarios/perfil:
 *   get:
 *     summary: Obter perfil do usuário autenticado
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil retornado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *             example:
 *               success: true
 *               message: "Perfil obtido com sucesso"
 *               usuario:
 *                 id: "b9e1d9b0-7c9f-4d1a-8f2a-1234567890ab"
 *                 email: "joao@example.com"
 *                 nomeCompleto: "João da Silva"
 *                 role: "ALUNO_CANDIDATO"
 *                 tipoUsuario: "PESSOA_FISICA"
 *                 authId: "uuid-auth"
 *                 emailVerificado: true
 *                 emailVerificadoEm: "2024-01-01T12:00:00Z"
 *                 ultimoLogin: "2024-03-12T09:40:00.000Z"
 *                 socialLinks: {}
 *                 enderecos: []
 *               stats:
 *                 accountAge: 365
 *                 hasCompletedProfile: true
 *                 hasAddress: false
 *                 totalOrders: 0
 *                 totalSubscriptions: 0
 *                 UsuariosVerificacaoEmailStatus:
 *                   verified: true
 *                   verifiedAt: "2024-01-01T12:00:00Z"
 *                   tokenExpiration: null
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *               timestamp: "2024-03-12T10:30:01.234Z"
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Usuário não autenticado"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Usuário não encontrado"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Erro interno do servidor"
 *               code: "INTERNAL_ERROR"
 *               correlationId: "d4e8c2a7-ff52-4f42-b6de-1234567890ab"
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X GET "http://localhost:3000/api/v1/usuarios/perfil" \\
 *            -H "Authorization: Bearer <TOKEN>"
 */
router.get(
  '/perfil',
  supabaseAuthMiddleware(),
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'perfil' })
      .info({ userId: req.user?.id ?? 'ID não disponível' }, '👤 Solicitação de perfil');
    next();
  },
  asyncHandler(obterPerfil),
);

/**
 * Atualizar perfil do usuário autenticado
 * PUT /perfil
 */
/**
 * @openapi
 * /api/v1/usuarios/perfil:
 *   put:
 *     summary: Atualizar perfil do usuário autenticado
 *     description: |
 *       Atualiza informações do perfil do próprio usuário autenticado.
 *
 *       **REGRAS:**
 *       - Email só pode ser alterado se já estiver verificado
 *       - Se email for alterado, será necessário verificar o novo email
 *       - CPF/CNPJ não podem ser alterados
 *       - Role e Status não podem ser alterados pelo próprio usuário
 *
 *       **CAMPOS EDITÁVEIS:**
 *       - nomeCompleto
 *       - telefone
 *       - dataNasc
 *       - genero
 *       - descricao
 *       - avatarUrl
 *       - endereco (objeto completo)
 *       - redesSociais (objeto completo)
 *       - email (apenas se emailVerificado === true)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nomeCompleto:
 *                 type: string
 *                 example: "João da Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao.novo@example.com"
 *                 description: "Só pode ser alterado se email atual estiver verificado"
 *               telefone:
 *                 type: string
 *                 nullable: true
 *                 example: "11999999999"
 *               dataNasc:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: "1990-01-15"
 *               genero:
 *                 type: string
 *                 enum: [MASCULINO, FEMININO, OUTRO, NAO_INFORMAR]
 *                 nullable: true
 *                 example: "MASCULINO"
 *               descricao:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "Desenvolvedor Full Stack"
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 example: "https://example.com/avatar.jpg"
 *               endereco:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   logradouro:
 *                     type: string
 *                     nullable: true
 *                   numero:
 *                     type: string
 *                     nullable: true
 *                   bairro:
 *                     type: string
 *                     nullable: true
 *                   cidade:
 *                     type: string
 *                     nullable: true
 *                   estado:
 *                     type: string
 *                     nullable: true
 *                   cep:
 *                     type: string
 *                     nullable: true
 *               redesSociais:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   linkedin:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   instagram:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   facebook:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   youtube:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   twitter:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *                   tiktok:
 *                     type: string
 *                     format: uri
 *                     nullable: true
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfil atualizado com sucesso"
 *                 usuario:
 *                   $ref: '#/components/schemas/UserProfileResponse'
 *                 stats:
 *                   type: object
 *                 correlationId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Não autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Email não verificado - não pode alterar email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email só pode ser alterado após verificação. Verifique seu email atual primeiro."
 *                 code:
 *                   type: string
 *                   example: "EMAIL_NOT_VERIFIED"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email já está em uso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Este e-mail já está em uso por outro usuário"
 *                 code:
 *                   type: string
 *                   example: "EMAIL_ALREADY_EXISTS"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *     x-codeSamples:
 *       - lang: cURL
 *         label: Exemplo
 *         source: |
 *           curl -X PUT "http://localhost:3000/api/v1/usuarios/perfil" \\
 *            -H "Authorization: Bearer <TOKEN>" \\
 *            -H "Content-Type: application/json" \\
 *            -d '{
 *              "nomeCompleto": "João da Silva",
 *              "telefone": "11999999999",
 *              "dataNasc": "1990-01-15",
 *              "genero": "MASCULINO",
 *              "descricao": "Desenvolvedor Full Stack",
 *              "avatarUrl": "https://example.com/avatar.jpg",
 *              "endereco": {
 *                "logradouro": "Rua Exemplo",
 *                "numero": "123",
 *                "bairro": "Centro",
 *                "cidade": "São Paulo",
 *                "estado": "SP",
 *                "cep": "01234567"
 *              },
 *              "redesSociais": {
 *                "linkedin": "https://linkedin.com/in/joao",
 *                "instagram": "https://instagram.com/joao"
 *              }
 *            }'
 */
router.put(
  '/perfil',
  supabaseAuthMiddleware(),
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'perfil' })
      .info({ userId: req.user?.id ?? 'ID não disponível' }, '✏️ Atualização de perfil');
    next();
  },
  asyncHandler(atualizarPerfil),
);

// ===========================
// ROTAS DE RECUPERAÇÃO DE SENHA
// ===========================

/**
 * Rotas de recuperação de senha
 */
router.use(
  '/recuperar-senha',
  async (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'];
    usuarioRoutesLogger
      .child({ correlationId, route: 'recuperar-senha' })
      .info('🔑 Solicitação de recuperação de senha');
    next();
  },
  (req, res, next) => {
    if (req.method === 'POST' && (req.path === '/' || req.path === '')) {
      return passwordRecoveryRequestRateLimit(req, res, next);
    }

    return next();
  },
  passwordRecoveryRoutes,
);

export default router;

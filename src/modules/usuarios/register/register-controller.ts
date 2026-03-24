import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@/config/prisma';
import { invalidateCacheByPrefix } from '../../../utils/cache';
import { invalidateUserCache } from '../utils/cache';
import { TiposDeUsuarios, Roles } from '../enums';
import { logger } from '../../../utils/logger';
import { formatZodErrors, registerSchema, type RegisterInput } from '../validators/auth.schema';
import { mapSocialLinks } from '../utils/social-links';
import {
  buildUserDataForDatabase,
  checkForDuplicates,
  createUserWithTransaction,
  extractAdminSocialLinks,
  processUserTypeSpecificData,
} from './user-creation-helpers';
import { buildUserProfileSnapshot, recordUserAuditEvent } from '../utils/user-history';
import { UsuariosVerificacaoEmailSelect } from '../utils/email-verification';

/**
 * Controller para criação de novos usuários
 * Implementa padrões de microserviços com tratamento robusto de erros
 *
 * Características:
 * - Validação rigorosa de dados
 * - Transações de banco seguras
 * - Logs estruturados
 * - Preparação de dados para middlewares
 * - Rollback automático em caso de erro
 *
 * @author Sistema Advance+
 * @version 4.0.2 - Correção de tipagem TypeScript
 */

const createRegisterLogger = (req: Request, action: string) =>
  logger.child({
    controller: 'RegisterController',
    action,
    correlationId: req.id,
  });

const createCorrelationLogger = (correlationId: string, action: string) =>
  logger.child({
    controller: 'RegisterController',
    action,
    correlationId,
  });

/**
 * Controller para criação de novos usuários
 * Implementa validação robusta e transações seguras
 *
 * @param req - Request object com dados do usuário
 * @param res - Response object
 */
export const criarUsuario = async (req: Request, res: Response, next: NextFunction) => {
  const log = createRegisterLogger(req, 'criarUsuario');
  const correlationId = req.id;
  const startTime = Date.now();

  log.info('🚀 Iniciando criação de usuário');

  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = formatZodErrors(parseResult.error);
      log.warn({ errors }, '⚠️ Dados inválidos para criação de usuário');
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors,
        correlationId,
      });
    }

    const dadosUsuario: RegisterInput = parseResult.data;

    // Extrai dados validados
    const { nomeCompleto, telefone, email, senha, aceitarTermos, authId, tipoUsuario, role } =
      dadosUsuario;

    // Normaliza role: se inválida ou não fornecida, define padrão
    const normalizedRole =
      role && Object.values(Roles).includes(role)
        ? role
        : tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
          ? Roles.EMPRESA
          : Roles.ALUNO_CANDIDATO;

    // Processa dados específicos por tipo de usuário
    const processedData = await processUserTypeSpecificData(dadosUsuario, {
      logger: createCorrelationLogger(correlationId, 'processUserTypeSpecificData'),
    });
    if (!processedData.success) {
      log.warn({ error: processedData.error }, '⚠️ Erro no processamento específico');
      return res.status(400).json({
        success: false,
        message: processedData.error,
        correlationId,
      });
    }

    // Verifica duplicatas com verificação otimizada
    const duplicateCheck = await checkForDuplicates(
      {
        email,
        authId,
        cpf: processedData.cpfLimpo,
        cnpj: processedData.cnpjLimpo,
      },
      {
        logger: createCorrelationLogger(correlationId, 'checkForDuplicates'),
      },
    );

    if (duplicateCheck.found) {
      log.warn({ reason: duplicateCheck.reason }, '⚠️ Usuário duplicado detectado');
      return res.status(409).json({
        success: false,
        message: duplicateCheck.reason,
        correlationId,
      });
    }

    // Gera hash da senha com salt seguro
    log.info('🔐 Gerando hash da senha');
    const senhaHash = await bcrypt.hash(senha, 12);

    const socialLinksInput = extractAdminSocialLinks(
      dadosUsuario as unknown as Record<string, unknown>,
    );

    // Prepara dados para inserção no banco
    const userData = buildUserDataForDatabase({
      nomeCompleto,
      email,
      senha: senhaHash,
      telefone,
      tipoUsuario,
      role: normalizedRole,
      aceitarTermos,
      authId,
      cpfLimpo: processedData.cpfLimpo,
      cnpjLimpo: processedData.cnpjLimpo,
      dataNascimento: processedData.dataNascimento,
      generoValidado: processedData.generoValidado,
      socialLinks: socialLinksInput,
    });

    // Cria usuário dentro de transação
    log.info('💾 Iniciando transação de banco');
    const usuario = await createUserWithTransaction(userData, {
      logger: createCorrelationLogger(correlationId, 'createUserWithTransaction'),
    });

    const usuarioHistorico = await prisma.usuarios.findUnique({
      where: { id: usuario.id },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cpf: true,
        cnpj: true,
        role: true,
        status: true,
        tipoUsuario: true,
        criadoEm: true,
        atualizadoEm: true,
        UsuariosInformation: {
          select: {
            telefone: true,
            genero: true,
            dataNasc: true,
            descricao: true,
            avatarUrl: true,
            inscricao: true,
          },
        },
        UsuariosRedesSociais: {
          select: {
            linkedin: true,
            instagram: true,
            facebook: true,
            youtube: true,
            twitter: true,
            tiktok: true,
          },
        },
        UsuariosEnderecos: {
          orderBy: { criadoEm: 'asc' },
          select: {
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
    });

    if (usuarioHistorico) {
      await recordUserAuditEvent({
        client: prisma,
        actorId: usuario.id,
        actorRole: usuario.role,
        targetUserId: usuario.id,
        action: 'USUARIO_CRIADO',
        descricao: 'Conta criada via cadastro público.',
        dadosNovos: buildUserProfileSnapshot({
          ...usuarioHistorico,
          emailVerificado: usuarioHistorico.UsuariosVerificacaoEmail?.emailVerificado ?? false,
          emailVerificadoEm: usuarioHistorico.UsuariosVerificacaoEmail?.emailVerificadoEm ?? null,
        }),
        meta: {
          origem: 'CADASTRO_PUBLICO',
        },
      });
    }

    await invalidateUserCache(usuario);
    try {
      await invalidateCacheByPrefix('dashboard:');
    } catch (cacheError) {
      const err = cacheError instanceof Error ? cacheError : new Error(String(cacheError));
      log.warn({ err }, '⚠️ Falha ao invalidar cache do dashboard');
    }

    const duration = Date.now() - startTime;
    log.info({ duration }, '✅ Usuário criado com sucesso');

    // ===================================================================
    // CRÍTICO: Prepara dados para middleware de email de boas-vindas
    // ===================================================================
    log.info('📧 Preparando dados para middleware de email');

    res.locals.UsuariosCriado = {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        // Dados adicionais para personalização do email
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codUsuario: usuario.codUsuario,
        socialLinks: mapSocialLinks(usuario.redesSociais),
      },
      // Metadados para debugging
      correlationId,
      createdAt: new Date().toISOString(),
      source: 'register-controller',
      emailShouldBeSent: true, // Flag explícita para o middleware
    };

    log.info(
      {
        email: usuario.email,
        nome: usuario.nomeCompleto,
        id: usuario.id,
      },
      '📧 Dados do usuário salvos em res.locals',
    );

    // Resposta de sucesso
    const userTypeLabel =
      tipoUsuario === TiposDeUsuarios.PESSOA_FISICA ? 'Pessoa física' : 'Empresa';

    res.status(201).json({
      success: true,
      message: `${userTypeLabel} cadastrada com sucesso`,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codUsuario: usuario.codUsuario,
      },
      correlationId,
      duration: `${duration}ms`,
    });

    // IMPORTANTE: Não retorna aqui, deixa o middleware processar
    log.info('🔄 Resposta enviada, aguardando middleware');

    // Continua para o próximo middleware (ex: envio de email)
    next();
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const err = error instanceof Error ? error : new Error(String(error));

    log.error({ err, duration }, '❌ Erro crítico na criação de usuário');

    err.message = errorMessage;
    return next(err);
  }
};

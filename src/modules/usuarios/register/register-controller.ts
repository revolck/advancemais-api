import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../../../config/prisma';
import { invalidateCacheByPrefix } from '../../../utils/cache';
import { invalidateUserCache } from '../utils/cache';
import { Prisma } from '@prisma/client';
import { TiposDeUsuarios, Roles } from '../enums';
import {
  validarCPF,
  validarCNPJ,
  validarDataNascimento,
  validarGenero,
  limparDocumento,
} from '../utils/validation';
import { logger } from '../../../utils/logger';
import {
  formatZodErrors,
  registerSchema,
  type RegisterInput,
  type RegisterPessoaFisicaInput,
  type RegisterPessoaJuridicaInput,
} from '../validators/auth.schema';
import {
  buildSocialLinksCreateData,
  extractSocialLinksFromPayload,
  mapSocialLinks,
  sanitizeSocialLinks,
  usuarioRedesSociaisSelect,
  type UsuarioSocialLinksInput,
} from '../utils/social-links';
import { emailVerificationSelect, normalizeEmailVerification } from '../utils/email-verification';
import { mergeUsuarioInformacoes, usuarioInformacoesSelect } from '../utils/information';

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

type CriarPessoaFisicaData = RegisterPessoaFisicaInput;
type CriarPessoaJuridicaData = RegisterPessoaJuridicaInput;
type CriarUsuarioData = RegisterInput;

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


const generateCodePrefix = (): string => {
  // Letras sem caracteres ambíguos para melhor legibilidade
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    prefix += letters[Math.floor(Math.random() * letters.length)];
  }
  return prefix;
};

const generateUniqueUserCode = async (tx: Prisma.TransactionClient): Promise<string> => {
  const prefix = generateCodePrefix();
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${prefix}${random}`;
    const existing = await tx.usuarios.findUnique({ where: { codUsuario: candidate }, select: { id: true } });
    if (!existing) {
      return candidate;
    }
  }

  const fallback = `${prefix}${Date.now().toString().slice(-6)}`;
  return fallback;
};

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

    const dadosUsuario: CriarUsuarioData = parseResult.data;

    // Extrai dados validados
    const {
      nomeCompleto,
      telefone,
      email,
      senha,
      aceitarTermos,
      supabaseId,
      tipoUsuario,
      role,
    } = dadosUsuario;

    // Normaliza role: se inválida ou não fornecida, define padrão
    const normalizedRole =
      role && Object.values(Roles).includes(role)
        ? role
        : tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
          ? Roles.EMPRESA
          : Roles.ALUNO_CANDIDATO;

    // Processa dados específicos por tipo de usuário
    const processedData = await processUserTypeSpecificData(dadosUsuario, correlationId);
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
        supabaseId,
        cpf: processedData.cpfLimpo,
        cnpj: processedData.cnpjLimpo,
      },
      correlationId,
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

    const socialLinksInput = extractSocialLinksFromPayload(
      dadosUsuario as unknown as Record<string, unknown>,
      'redesSociais',
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
      supabaseId,
      cpfLimpo: processedData.cpfLimpo,
      cnpjLimpo: processedData.cnpjLimpo,
      dataNascimento: processedData.dataNascimento,
      generoValidado: processedData.generoValidado,
      socialLinks: socialLinksInput,
    });

    // Cria usuário dentro de transação
    log.info('💾 Iniciando transação de banco');
    const usuario = await createUserWithTransaction(userData, correlationId);
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

    res.locals.usuarioCriado = {
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
    const userTypeLabel = tipoUsuario === TiposDeUsuarios.PESSOA_FISICA ? 'Pessoa física' : 'Empresa';

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

// Validações agora centralizadas via Zod (registerSchema)

/**
 * Processa dados específicos por tipo de usuário
 */
async function processUserTypeSpecificData(
  dadosUsuario: CriarUsuarioData,
  correlationId: string,
): Promise<{
  success: boolean;
  error?: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
}> {
  const log = createCorrelationLogger(correlationId, 'processUserTypeSpecificData');
  try {
    const { tipoUsuario } = dadosUsuario;

    if (tipoUsuario === TiposDeUsuarios.PESSOA_FISICA) {
      const dadosPF = dadosUsuario as CriarPessoaFisicaData;

      // Validações específicas para Pessoa Física
      if (!dadosPF.cpf) {
        return {
          success: false,
          error: 'Para pessoa física é obrigatório: CPF',
        };
      }

      // Valida CPF
      const cpfLimpo = limparDocumento(dadosPF.cpf);
      if (!validarCPF(cpfLimpo)) {
        return {
          success: false,
          error: 'CPF deve ter 11 dígitos válidos',
        };
      }

      // Valida data de nascimento se fornecida
      let dataNascimento: Date | undefined;
      if (dadosPF.dataNasc) {
        const validacaoData = validarDataNascimento(dadosPF.dataNasc);
        if (!validacaoData.valida) {
          return {
            success: false,
            error: validacaoData.mensagem,
          };
        }
        dataNascimento = new Date(dadosPF.dataNasc);
      }

      // Valida gênero se fornecido
      let generoValidado: string | undefined;
      if (dadosPF.genero) {
        if (!validarGenero(dadosPF.genero)) {
          return {
            success: false,
            error: 'Gênero deve ser: MASCULINO, FEMININO, OUTRO ou NAO_INFORMAR',
          };
        }
        generoValidado = dadosPF.genero.toUpperCase();
      }

      log.info('✅ Dados de pessoa física validados');

      return {
        success: true,
        cpfLimpo,
        dataNascimento,
        generoValidado,
      };
    } else if (tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA) {
      const dadosPJ = dadosUsuario as CriarPessoaJuridicaData;

      // Validações específicas para Pessoa Jurídica
      if (!dadosPJ.cnpj) {
        return {
          success: false,
          error: 'Para pessoa jurídica é obrigatório: CNPJ',
        };
      }

      // Valida CNPJ
      const cnpjLimpo = limparDocumento(dadosPJ.cnpj);
      if (!validarCNPJ(cnpjLimpo)) {
        return {
          success: false,
          error: 'CNPJ deve ter 14 dígitos válidos',
        };
      }

      log.info('✅ Dados de pessoa jurídica validados');

      return {
        success: true,
        cnpjLimpo,
      };
    }

    return {
      success: false,
      error: 'Tipo de usuário não reconhecido',
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ err }, '❌ Erro no processamento específico');
    return {
      success: false,
      error: 'Erro interno no processamento dos dados',
    };
  }
}

/**
 * Verifica duplicatas de forma otimizada
 * CORREÇÃO: Tipagem explícita corrigida para resolver erro do Prisma OR conditions
 */
async function checkForDuplicates(
  data: {
    email: string;
    supabaseId: string;
    cpf?: string;
    cnpj?: string;
  },
  correlationId: string,
): Promise<{ found: boolean; reason?: string }> {
  const log = createCorrelationLogger(correlationId, 'checkForDuplicates');
  try {
    log.info('🔍 Verificando duplicatas');

    // CORREÇÃO: Tipagem explícita corrigida para Array
    type WhereCondition =
      | { email: string }
      | { supabaseId: string }
      | { cpf: string }
      | { cnpj: string };

    const orConditions: WhereCondition[] = [{ email: data.email }, { supabaseId: data.supabaseId }];

    // Adiciona condições específicas se fornecidas
    if (data.cpf) {
      orConditions.push({ cpf: data.cpf });
    }

    if (data.cnpj) {
      orConditions.push({ cnpj: data.cnpj });
    }

    // Busca com tipagem correta
    const usuarioExistente = await prisma.usuarios.findFirst({
      where: { OR: orConditions },
      select: {
        id: true,
        email: true,
        cpf: true,
        cnpj: true,
        supabaseId: true,
        emailVerification: {
          select: emailVerificationSelect,
        },
      },
    });

    if (usuarioExistente) {
      const verification = normalizeEmailVerification(usuarioExistente.emailVerification);

      if (
        !verification.emailVerificado &&
        verification.emailVerificationTokenExp &&
        verification.emailVerificationTokenExp < new Date()
      ) {
        await prisma.usuarios.delete({ where: { id: usuarioExistente.id } });
        log.info({ email: usuarioExistente.email }, '🧹 Usuário com verificação expirada removido');
        return { found: false };
      }

      let reason = 'Já existe usuário cadastrado com ';

      // Verifica qual campo causou a duplicata
      if (usuarioExistente.email === data.email) {
        reason += 'este email';
      } else if (data.cpf && usuarioExistente.cpf === data.cpf) {
        reason += 'este CPF';
      } else if (data.cnpj && usuarioExistente.cnpj === data.cnpj) {
        reason += 'este CNPJ';
      } else if (usuarioExistente.supabaseId === data.supabaseId) {
        reason += 'este ID do Supabase';
      } else {
        reason += 'estes dados';
      }

      return { found: true, reason };
    }

    log.info('✅ Nenhuma duplicata encontrada');
    return { found: false };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ err }, '❌ Erro na verificação de duplicatas');
    // Em caso de erro na verificação, assume que não há duplicatas
    // para não bloquear o registro desnecessariamente
    return { found: false };
  }
}

/**
 * Constrói dados para inserção no banco
 */
function buildUserDataForDatabase(params: {
  nomeCompleto: string;
  email: string;
  senha: string;
  telefone: string;
  tipoUsuario: TiposDeUsuarios;
  role: Roles;
  aceitarTermos: boolean;
  supabaseId: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
  avatarUrl?: string | null;
  descricao?: string | null;
  socialLinks?: UsuarioSocialLinksInput;
}) {
  const usuario = {
    nomeCompleto: params.nomeCompleto.trim(),
    email: params.email.toLowerCase().trim(),
    senha: params.senha,
    tipoUsuario: params.tipoUsuario,
    role: params.role,
    supabaseId: params.supabaseId,
    ...(params.cpfLimpo && { cpf: params.cpfLimpo }),
    ...(params.cnpjLimpo && { cnpj: params.cnpjLimpo }),
  } satisfies Prisma.UsuariosCreateWithoutRedesSociaisInput;

  const informacoes: Prisma.UsuariosInformationCreateWithoutUsuarioInput = {
    telefone: params.telefone.trim(),
    aceitarTermos: params.aceitarTermos,
  };

  if (params.dataNascimento) {
    informacoes.dataNasc = params.dataNascimento;
  }

  if (params.generoValidado) {
    informacoes.genero = params.generoValidado;
  }

  const avatarUrl = typeof params.avatarUrl === 'string' ? params.avatarUrl.trim() : null;
  if (avatarUrl) {
    informacoes.avatarUrl = avatarUrl;
  }

  const descricao = typeof params.descricao === 'string' ? params.descricao.trim() : null;
  if (descricao) {
    informacoes.descricao = descricao;
  }

  const sanitizedSocialLinks = sanitizeSocialLinks(params.socialLinks);
  const socialLinks = buildSocialLinksCreateData(sanitizedSocialLinks);

  return { usuario, informacoes, socialLinks };
}

/**
 * Cria usuário dentro de transação segura
 */
async function createUserWithTransaction(
  userData: ReturnType<typeof buildUserDataForDatabase>,
  correlationId: string,
) {
  const log = createCorrelationLogger(correlationId, 'createUserWithTransaction');
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      log.info('💾 Inserindo usuário no banco');

      const userSelect = {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        cnpj: true,
        tipoUsuario: true,
        role: true,
        status: true,
        supabaseId: true,
        criadoEm: true,
        ...usuarioRedesSociaisSelect,
        codUsuario: true,
        informacoes: {
          select: usuarioInformacoesSelect,
        },
      } as const;

      const codUsuario = await generateUniqueUserCode(tx);

      const usuario = await tx.usuarios.create({
        data: {
          ...userData.usuario,
          codUsuario,
          emailVerification: {
            create: {},
          },
          informacoes: {
            create: userData.informacoes,
          },
          ...(userData.socialLinks
            ? {
                redesSociais: {
                  create: userData.socialLinks,
                },
              }
            : {}),
        },
        select: userSelect,
      });

      if (userData.usuario.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA) {
        log.info({ userId: usuario.id }, '🏢 Usuário registrado como pessoa jurídica');
      }

      log.info({ userId: usuario.id }, '✅ Usuário inserido com sucesso');

      return mergeUsuarioInformacoes(usuario);
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error({ err }, '❌ Erro na transação de banco');

    // Tratamento específico para erros de constraint do Prisma
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      throw new Error('Dados duplicados: email, CPF, CNPJ ou ID do Supabase já existem');
    }

    throw error;
  }
}

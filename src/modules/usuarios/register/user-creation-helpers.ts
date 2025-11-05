import {
  Prisma,
  type Roles as PrismaRoles,
  type TiposDeUsuarios as PrismaTiposDeUsuarios,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import type { AppLogger } from '@/utils/logger';

import { Roles, TiposDeUsuarios } from '../enums';
import {
  buildSocialLinksCreateData,
  extractSocialLinksFromPayload,
  sanitizeSocialLinks,
  usuarioRedesSociaisSelect,
  type UsuarioSocialLinksInput,
} from '../utils/social-links';
import { UsuariosVerificacaoEmailSelect, normalizeEmailVerification } from '../utils/email-verification';
import { mergeUsuarioInformacoes, usuarioInformacoesSelect } from '../utils/information';
import {
  type AdminCreateUserInput,
  type RegisterInput,
  type RegisterPessoaFisicaInput,
  type RegisterPessoaJuridicaInput,
} from '../validators/auth.schema';
import {
  limparDocumento,
  validarCNPJ,
  validarCPF,
  validarDataNascimento,
  validarGenero,
} from '../utils/validation';

const createScopedLogger = (logger?: AppLogger, scope?: string) =>
  logger ? logger.child({ scope }) : undefined;

const logInfo = (
  logger: AppLogger | undefined,
  message: string,
  params?: Record<string, unknown>,
) => {
  if (!logger) return;
  if (params) {
    logger.info({ ...params }, message);
  } else {
    logger.info(message);
  }
};

const logWarn = (
  logger: AppLogger | undefined,
  message: string,
  params?: Record<string, unknown>,
) => {
  if (!logger) return;
  if (params) {
    logger.warn({ ...params }, message);
  } else {
    logger.warn(message);
  }
};

const logError = (
  logger: AppLogger | undefined,
  message: string,
  params?: Record<string, unknown>,
) => {
  if (!logger) return;
  if (params) {
    logger.error({ ...params }, message);
  } else {
    logger.error(message);
  }
};

export interface ProcessUserTypeSpecificDataResult {
  success: boolean;
  error?: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
}

type AdminPessoaFisicaInput = Extract<
  AdminCreateUserInput,
  { tipoUsuario: TiposDeUsuarios.PESSOA_FISICA }
>;
type AdminPessoaJuridicaInput = Extract<
  AdminCreateUserInput,
  { tipoUsuario: TiposDeUsuarios.PESSOA_JURIDICA }
>;

type CriarPessoaFisicaData = RegisterPessoaFisicaInput | AdminPessoaFisicaInput;
type CriarPessoaJuridicaData = RegisterPessoaJuridicaInput | AdminPessoaJuridicaInput;
type CriarUsuarioData = RegisterInput | AdminCreateUserInput;

const generateCodePrefix = (): string => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    prefix += letters[Math.floor(Math.random() * letters.length)];
  }
  return prefix;
};

const generateUniqueUserCode = async (
  tx: Prisma.TransactionClient,
  logger?: AppLogger,
): Promise<string> => {
  const scopedLogger = createScopedLogger(logger, 'generateUniqueUserCode');
  for (let attempt = 0; attempt < 10; attempt++) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${generateCodePrefix()}${random}`;
    const existing = await tx.usuarios.findUnique({
      where: { codUsuario: candidate },
      select: { id: true },
    });
    if (!existing) {
      logInfo(scopedLogger, 'Generated unique user code', { candidate, attempt });
      return candidate;
    }
  }

  const fallback = `${generateCodePrefix()}${Date.now().toString().slice(-6)}`;
  logWarn(scopedLogger, 'Falling back to timestamp based user code', { fallback });
  return fallback;
};

export const processUserTypeSpecificData = async (
  dadosUsuario: CriarUsuarioData,
  options?: { logger?: AppLogger },
): Promise<ProcessUserTypeSpecificDataResult> => {
  const scopedLogger = createScopedLogger(options?.logger, 'processUserTypeSpecificData');
  try {
    const tipoUsuario = dadosUsuario.tipoUsuario as unknown as TiposDeUsuarios;

    if (tipoUsuario === TiposDeUsuarios.PESSOA_FISICA) {
      const dadosPF = dadosUsuario as CriarPessoaFisicaData;

      if (!dadosPF.cpf) {
        return { success: false, error: 'Para pessoa física é obrigatório: CPF' };
      }

      const cpfLimpo = limparDocumento(dadosPF.cpf);
      if (!validarCPF(cpfLimpo)) {
        return { success: false, error: 'CPF deve ter 11 dígitos válidos' };
      }

      let dataNascimento: Date | undefined;
      if (dadosPF.dataNasc) {
        const validacaoData = validarDataNascimento(dadosPF.dataNasc);
        if (!validacaoData.valida) {
          return { success: false, error: validacaoData.mensagem };
        }
        dataNascimento = new Date(dadosPF.dataNasc);
      }

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

      logInfo(scopedLogger, 'Pessoa física validada com sucesso');

      return {
        success: true,
        cpfLimpo,
        dataNascimento,
        generoValidado,
      };
    }

    if (tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA) {
      const dadosPJ = dadosUsuario as CriarPessoaJuridicaData;

      if (!dadosPJ.cnpj) {
        return { success: false, error: 'Para pessoa jurídica é obrigatório: CNPJ' };
      }

      const cnpjLimpo = limparDocumento(dadosPJ.cnpj);
      if (!validarCNPJ(cnpjLimpo)) {
        return { success: false, error: 'CNPJ deve ter 14 dígitos válidos' };
      }

      logInfo(scopedLogger, 'Pessoa jurídica validada com sucesso');

      return {
        success: true,
        cnpjLimpo,
      };
    }

    return { success: false, error: 'Tipo de usuário não reconhecido' };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(scopedLogger, 'Erro no processamento específico', { err });
    return { success: false, error: 'Erro interno no processamento dos dados' };
  }
};

export const checkForDuplicates = async (
  data: { email: string; supabaseId?: string; cpf?: string; cnpj?: string },
  options?: { logger?: AppLogger },
): Promise<{ found: boolean; reason?: string }> => {
  const scopedLogger = createScopedLogger(options?.logger, 'checkForDuplicates');
  try {
    logInfo(scopedLogger, 'Iniciando verificação de duplicatas');

    type WhereCondition =
      | { email: string }
      | { supabaseId: string }
      | { cpf: string }
      | { cnpj: string };

    const orConditions: WhereCondition[] = [{ email: data.email }];
    if (data.supabaseId) {
      orConditions.push({ supabaseId: data.supabaseId });
    }
    if (data.cpf) {
      orConditions.push({ cpf: data.cpf });
    }
    if (data.cnpj) {
      orConditions.push({ cnpj: data.cnpj });
    }

    const usuarioExistente = await prisma.usuarios.findFirst({
      where: { OR: orConditions },
      select: {
        id: true,
        email: true,
        cpf: true,
        cnpj: true,
        supabaseId: true,
        UsuariosVerificacaoEmail: {
          select: UsuariosVerificacaoEmailSelect,
        },
      },
    });

    if (usuarioExistente) {
      const verification = normalizeEmailVerification(usuarioExistente.UsuariosVerificacaoEmail);

      if (
        !verification.emailVerificado &&
        verification.emailVerificationTokenExp &&
        verification.emailVerificationTokenExp < new Date()
      ) {
        await prisma.usuarios.delete({ where: { id: usuarioExistente.id } });
        logInfo(scopedLogger, 'Usuário com verificação expirada removido', {
          email: usuarioExistente.email,
        });
        return { found: false };
      }

      let reason = 'Já existe usuário cadastrado com ';

      if (usuarioExistente.email === data.email) {
        reason += 'este email';
      } else if (data.cpf && usuarioExistente.cpf === data.cpf) {
        reason += 'este CPF';
      } else if (data.cnpj && usuarioExistente.cnpj === data.cnpj) {
        reason += 'este CNPJ';
      } else if (data.supabaseId && usuarioExistente.supabaseId === data.supabaseId) {
        reason += 'este ID do Supabase';
      } else {
        reason += 'estes dados';
      }

      return { found: true, reason };
    }

    logInfo(scopedLogger, 'Nenhuma duplicata encontrada');
    return { found: false };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(scopedLogger, 'Erro na verificação de duplicatas', { err });
    return { found: false };
  }
};

export interface BuildUserDataForDatabaseParams {
  nomeCompleto: string;
  email: string;
  senha: string;
  telefone: string;
  tipoUsuario: TiposDeUsuarios | PrismaTiposDeUsuarios;
  role: Roles | PrismaRoles;
  aceitarTermos: boolean;
  supabaseId: string;
  cpfLimpo?: string;
  cnpjLimpo?: string;
  dataNascimento?: Date;
  generoValidado?: string;
  avatarUrl?: string | null;
  descricao?: string | null;
  socialLinks?: UsuarioSocialLinksInput;
  status?: Prisma.UsuariosCreateInput['status'];
}

export const buildUserDataForDatabase = (params: BuildUserDataForDatabaseParams) => {
  const usuario: Omit<Prisma.UsuariosCreateInput, 'codUsuario'> = {
    nomeCompleto: params.nomeCompleto.trim(),
    email: params.email.toLowerCase().trim(),
    senha: params.senha,
    tipoUsuario: params.tipoUsuario as PrismaTiposDeUsuarios,
    role: params.role as PrismaRoles,
    supabaseId: params.supabaseId,
    ...(params.status ? { status: params.status } : {}),
    ...(params.cpfLimpo ? { cpf: params.cpfLimpo } : {}),
    ...(params.cnpjLimpo ? { cnpj: params.cnpjLimpo } : {}),
  };

  const informacoes: Prisma.UsuariosInformationCreateWithoutUsuariosInput = {
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
};

export type BuildUserDataForDatabaseResult = ReturnType<typeof buildUserDataForDatabase>;

export const extractAdminSocialLinks = (
  payload: Record<string, unknown>,
): UsuarioSocialLinksInput | undefined => {
  return extractSocialLinksFromPayload(payload, 'redesSociais');
};

export const createUserWithTransaction = async (
  userData: BuildUserDataForDatabaseResult,
  options?: { logger?: AppLogger; correlationId?: string; markEmailVerified?: boolean },
) => {
  const scopedLogger = createScopedLogger(options?.logger, 'createUserWithTransaction');
  try {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      logInfo(scopedLogger, 'Inserindo usuário no banco');

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
        UsuariosInformation: {
          select: usuarioInformacoesSelect,
        },
      } as const;

      const codUsuario = await generateUniqueUserCode(tx, scopedLogger);

      const UsuariosVerificacaoEmailData = options?.markEmailVerified
        ? {
            emailVerificado: true,
            emailVerificadoEm: new Date(),
            emailVerificationToken: null,
            emailVerificationTokenExp: null,
            emailVerificationAttempts: 0,
            ultimaTentativaVerificacao: new Date(),
          }
        : {};

      const usuario = await tx.usuarios.create({
        data: {
          ...userData.usuario,
          codUsuario,
          UsuariosVerificacaoEmail: {
            create: UsuariosVerificacaoEmailData,
          },
          UsuariosInformation: {
            create: userData.informacoes,
          },
          ...(userData.socialLinks
            ? {
                UsuariosRedesSociais: {
                  create: {
                    instagram: userData.socialLinks.instagram ?? null,
                    linkedin: userData.socialLinks.linkedin ?? null,
                    facebook: userData.socialLinks.facebook ?? null,
                    youtube: userData.socialLinks.youtube ?? null,
                    twitter: userData.socialLinks.twitter ?? null,
                    tiktok: userData.socialLinks.tiktok ?? null,
                    updatedAt: new Date(),
                  } as Prisma.UsuariosRedesSociaisCreateWithoutUsuariosInput,
                },
              }
            : {}),
        } as Prisma.UsuariosCreateInput,
        select: userSelect,
      });

      if (String(userData.usuario.tipoUsuario) === TiposDeUsuarios.PESSOA_JURIDICA) {
        logInfo(scopedLogger, 'Usuário registrado como pessoa jurídica', { userId: usuario.id });
      }

      logInfo(scopedLogger, 'Usuário inserido com sucesso', { userId: usuario.id });

      return mergeUsuarioInformacoes(usuario);
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError(scopedLogger, 'Erro na transação de banco', { err });

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      throw new Error('Dados duplicados: email, CPF, CNPJ ou ID do Supabase já existem');
    }

    throw err;
  }
};

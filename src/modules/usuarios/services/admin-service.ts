/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Prisma, Roles, Status, TiposDeUsuarios } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { prisma } from '@/config/prisma';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { logger } from '@/utils/logger';
import { invalidateCacheByPrefix } from '@/utils/cache';
import { attachEnderecoResumo } from '../utils/address';
import { mergeUsuarioInformacoes, usuarioInformacoesSelect } from '../utils/information';
import { mapSocialLinks, usuarioRedesSociaisSelect } from '../utils/social-links';
import {
  buildUserDataForDatabase,
  checkForDuplicates,
  createUserWithTransaction,
  extractAdminSocialLinks,
  processUserTypeSpecificData,
} from '../register/user-creation-helpers';
import type { AdminCreateUserInput } from '../validators/auth.schema';
export class AdminService {
  private readonly log = logger.child({ module: 'AdminService' });

  constructor() {}

  private createServiceError(message: string, statusCode: number, code?: string, details?: unknown) {
    const error = new Error(message);
    (error as any).statusCode = statusCode;
    if (code) {
      (error as any).code = code;
    }
    if (details) {
      (error as any).details = details;
    }
    return error;
  }

  private getStatusFilter(status?: string) {
    if (!status) return undefined;

    const normalized = status.trim().toUpperCase();
    if (normalized in Status) {
      return Status[normalized as keyof typeof Status];
    }

    return undefined;
  }

  private getRoleFilter(role?: string) {
    if (!role) return undefined;

    const normalized = role.trim().toUpperCase();
    if (normalized in Roles) {
      return Roles[normalized as keyof typeof Roles];
    }

    return undefined;
  }

  private getTipoUsuarioFilter(tipoUsuario?: string) {
    if (!tipoUsuario) return undefined;

    const normalized = tipoUsuario.trim().toUpperCase();
    if (normalized in TiposDeUsuarios) {
      return TiposDeUsuarios[normalized as keyof typeof TiposDeUsuarios];
    }

    return undefined;
  }

  /**
   * Lista usuários com filtros e paginação
   */
  async listarUsuarios(query: unknown) {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).default(50),
      status: z.string().optional(),
      role: z.string().optional(),
      tipoUsuario: z.string().optional(),
    });

    const { page, limit, status, role, tipoUsuario } = querySchema.parse(query);
    const pageSize = Math.min(Number(limit) || 50, 100);
    const skip = (page - 1) * pageSize;

    // Construir filtros dinamicamente
    const where: Prisma.UsuariosWhereInput = {};
    const statusFilter = this.getStatusFilter(status);
    const tipoUsuarioFilter = this.getTipoUsuarioFilter(tipoUsuario);

    const roleFilter = this.getRoleFilter(role);

    if (statusFilter) where.status = statusFilter;
    if (roleFilter) where.role = roleFilter;
    if (tipoUsuarioFilter) where.tipoUsuario = tipoUsuarioFilter;

    const [usuarios, total] = await Promise.all([
      prisma.usuarios.findMany({
        where,
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          role: true,
          status: true,
          tipoUsuario: true,
          criadoEm: true,
          ultimoLogin: true,
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.usuarios.count({ where }),
    ]);

    return {
      message: 'Lista de usuários',
      usuarios,
      pagination: {
        page,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Lista candidatos (role ALUNO_CANDIDATO) com filtros e paginação
   */
  async listarCandidatos(
    query: unknown,
    options?: { defaultLimit?: number; maxLimit?: number; forceLimit?: number },
  ) {
    const { defaultLimit = 50, maxLimit = 100, forceLimit } = options ?? {};

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(maxLimit)
        .default(Math.min(defaultLimit, maxLimit)),
      status: z.string().optional(),
      tipoUsuario: z.string().optional(),
      search: z.string().optional(),
    });

    const { page, limit, status, tipoUsuario, search } = querySchema.parse(query);
    const pageSize = forceLimit
      ? Math.max(1, Math.min(forceLimit, maxLimit))
      : limit;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UsuariosWhereInput = {
      role: Roles.ALUNO_CANDIDATO,
    };

    const statusFilter = this.getStatusFilter(status);
    if (statusFilter) {
      where.status = statusFilter;
    }

    const tipoUsuarioFilter = this.getTipoUsuarioFilter(tipoUsuario);
    if (tipoUsuarioFilter) {
      where.tipoUsuario = tipoUsuarioFilter;
    }

    const searchTerm = search?.trim();
    if (searchTerm && searchTerm.length < 3) {
      throw Object.assign(new Error('Busca deve conter pelo menos 3 caracteres'), {
        statusCode: 400,
        code: 'SEARCH_TERM_TOO_SHORT',
      });
    }

    if (searchTerm) {
      where.OR = [
        { nomeCompleto: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { cpf: { contains: searchTerm, mode: 'insensitive' } },
        { codUsuario: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [candidatos, total] = await prisma.$transaction([
      prisma.usuarios.findMany({
        where,
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          role: true,
          status: true,
          tipoUsuario: true,
          criadoEm: true,
          ultimoLogin: true,
          informacoes: { select: usuarioInformacoesSelect },
          enderecos: {
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
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.usuarios.count({ where }),
    ]);

    const candidatosComEndereco = candidatos.map(
      (candidato) => attachEnderecoResumo(mergeUsuarioInformacoes(candidato))!,
    );

    return {
      message: 'Lista de candidatos',
      candidatos: candidatosComEndereco,
      pagination: {
        page,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Busca usuário específico com detalhes
   */
  async buscarUsuario(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new Error('ID do usuário é obrigatório');
    }

    const usuario = await prisma.usuarios.findUnique({
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
        ...usuarioRedesSociaisSelect,
        codUsuario: true,
        informacoes: {
          select: usuarioInformacoesSelect,
        },
        enderecos: {
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
      },
    });

    if (!usuario) {
      return null;
    }

    const usuarioComInformacoes = mergeUsuarioInformacoes(usuario);
    const usuarioNormalizado = attachEnderecoResumo(usuarioComInformacoes);

    if (!usuarioNormalizado) {
      return null;
    }

    return {
      ...usuarioNormalizado,
      redesSociais: mapSocialLinks(usuario.redesSociais),
      informacoes: usuarioComInformacoes.informacoes,
    };
  }

  /**
   * Busca candidato específico com detalhes
   */
  async buscarCandidato(userId: string) {
    if (!userId || userId.trim() === '') {
      throw new Error('ID do candidato é obrigatório');
    }

    const candidato = await prisma.usuarios.findFirst({
      where: {
        id: userId,
        role: Roles.ALUNO_CANDIDATO,
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        ...usuarioRedesSociaisSelect,
        codUsuario: true,
        informacoes: {
          select: usuarioInformacoesSelect,
        },
        enderecos: {
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
      },
    });

    if (!candidato) {
      return null;
    }

    const candidatoComInformacoes = mergeUsuarioInformacoes(candidato);
    const candidatoNormalizado = attachEnderecoResumo(candidatoComInformacoes);

    if (!candidatoNormalizado) {
      return null;
    }

    return {
      ...candidatoNormalizado,
      redesSociais: mapSocialLinks(candidato.redesSociais),
      informacoes: candidatoComInformacoes.informacoes,
    };
  }

  /**
   * Atualiza status do usuário - TIPAGEM CORRETA
   */
  async atualizarStatus(userId: string, status: string, motivo?: string) {
    // Validações
    if (!userId || userId.trim() === '') {
      throw new Error('ID do usuário é obrigatório');
    }

    // Validação usando enum do Prisma
    const statusEnum = status.trim();

    // Buscar dados antes da atualização
    const usuarioAntes = await prisma.usuarios.findUnique({
      where: { id: userId },
      select: { status: true, email: true, nomeCompleto: true },
    });

    if (!usuarioAntes) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar status - CORREÇÃO: usando enum
    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { status: statusEnum as any },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        status: true,
        atualizadoEm: true,
        supabaseId: true,
      },
    });

    await invalidateUserCache(usuario);

    // Cancelamento de assinatura removido após retirada do provedor de pagamentos

    // Log da alteração
    this.log.info(
      {
        userId,
        statusAnterior: usuarioAntes.status,
        statusAtual: statusEnum,
        motivo,
      },
      'Status do usuário alterado',
    );

    return {
      message: 'Status do usuário atualizado com sucesso',
      usuario,
      statusAnterior: usuarioAntes.status,
    };
  }

  /**
   * Atualiza role do usuário - TIPAGEM CORRETA
   */
  async atualizarRole(userId: string, role: string, motivo?: string, adminId?: string) {
    // Validações
    if (!userId || !role) {
      throw new Error('ID do usuário e role são obrigatórios');
    }

    const roleEnum = role.trim();

    // Prevenir auto-demoção de ADMIN
    if (adminId === userId && roleEnum !== Roles.ADMIN) {
      throw new Error('Você não pode alterar sua própria role para uma função não-administrativa');
    }

    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { role: roleEnum as Roles },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        atualizadoEm: true,
        supabaseId: true,
      },
    });

    await invalidateUserCache(usuario);

    this.log.info(
      {
        userId,
        novaRole: roleEnum,
        motivo,
      },
      'Role do usuário alterada',
    );

    return {
      message: 'Role do usuário atualizada com sucesso',
      usuario,
    };
  }

  async criarUsuario(
    dados: AdminCreateUserInput,
    options?: { correlationId?: string; adminId?: string },
  ) {
    const log = this.log.child({
      action: 'criarUsuarioAdmin',
      correlationId: options?.correlationId,
      adminId: options?.adminId,
    });

    log.info('Iniciando criação administrativa de usuário');

    if (dados.senha !== dados.confirmarSenha) {
      throw this.createServiceError('Senhas não conferem', 400, 'PASSWORD_MISMATCH');
    }

    const aceitarTermos = dados.aceitarTermos ?? true;
    const supabaseId = dados.supabaseId?.trim() || randomUUID();
    const normalizedRole =
      dados.role && Object.values(Roles).includes(dados.role)
        ? dados.role
        : dados.tipoUsuario === TiposDeUsuarios.PESSOA_JURIDICA
          ? Roles.EMPRESA
          : Roles.ALUNO_CANDIDATO;

    const helperLogger = log.child({ scope: 'createUserHelpers' });

    const processedData = await processUserTypeSpecificData(dados, { logger: helperLogger });
    if (!processedData.success) {
      log.warn({ error: processedData.error }, 'Validação específica falhou');
      throw this.createServiceError(
        processedData.error ?? 'Dados inválidos para criação de usuário',
        400,
        'VALIDATION_ERROR',
      );
    }

    const duplicateCheck = await checkForDuplicates(
      {
        email: dados.email,
        supabaseId,
        cpf: processedData.cpfLimpo,
        cnpj: processedData.cnpjLimpo,
      },
      { logger: helperLogger },
    );

    if (duplicateCheck.found) {
      log.warn({ reason: duplicateCheck.reason }, 'Usuário duplicado identificado');
      throw this.createServiceError(
        duplicateCheck.reason ?? 'Usuário já cadastrado',
        409,
        'USER_ALREADY_EXISTS',
      );
    }

    const senhaHash = await bcrypt.hash(dados.senha, 12);

    const socialLinksInput = extractAdminSocialLinks(dados as unknown as Record<string, unknown>);

    const userData = buildUserDataForDatabase({
      nomeCompleto: dados.nomeCompleto,
      email: dados.email,
      senha: senhaHash,
      telefone: dados.telefone,
      tipoUsuario: dados.tipoUsuario,
      role: normalizedRole,
      aceitarTermos,
      supabaseId,
      cpfLimpo: processedData.cpfLimpo,
      cnpjLimpo: processedData.cnpjLimpo,
      dataNascimento: processedData.dataNascimento,
      generoValidado: processedData.generoValidado,
      socialLinks: socialLinksInput,
      status: dados.status ?? Status.ATIVO,
    });

    const usuario = await createUserWithTransaction(userData, {
      logger: helperLogger,
      markEmailVerified: true,
    });

    await invalidateUserCache(usuario);

    try {
      await invalidateCacheByPrefix('dashboard:');
    } catch (error) {
      log.warn({ err: error }, 'Falha ao limpar cache de dashboard');
    }

    log.info({ userId: usuario.id }, 'Usuário criado com sucesso via admin');

    return {
      success: true,
      message: 'Usuário criado com sucesso',
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nomeCompleto: usuario.nomeCompleto,
        tipoUsuario: usuario.tipoUsuario,
        role: usuario.role,
        status: usuario.status,
        criadoEm: usuario.criadoEm,
        codUsuario: usuario.codUsuario,
        emailVerificado: true,
        emailVerificadoEm: new Date(),
        socialLinks: mapSocialLinks(usuario.redesSociais),
      },
      meta: {
        correlationId: options?.correlationId,
        createdBy: options?.adminId,
        emailVerificationBypassed: true,
      },
    };
  }
}

/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { Prisma, Role, Status, TiposDeUsuarios } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/config/prisma';
import { invalidateUserCache } from '@/modules/usuarios/utils/cache';
import { logger } from '@/utils/logger';
import { attachEnderecoResumo } from '../utils/address';
export class AdminService {
  private readonly log = logger.child({ module: 'AdminService' });

  constructor() {}

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
    if (normalized in Role) {
      return Role[normalized as keyof typeof Role];
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
  async listarCandidatos(query: unknown) {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).default(50),
      status: z.string().optional(),
      tipoUsuario: z.string().optional(),
      search: z.string().optional(),
    });

    const { page, limit, status, tipoUsuario, search } = querySchema.parse(query);
    const pageSize = Math.min(Number(limit) || 50, 100);
    const skip = (page - 1) * pageSize;

    const where: Prisma.UsuariosWhereInput = {
      role: Role.ALUNO_CANDIDATO,
    };

    const statusFilter = this.getStatusFilter(status);
    if (statusFilter) {
      where.status = statusFilter;
    }

    const tipoUsuarioFilter = this.getTipoUsuarioFilter(tipoUsuario);
    if (tipoUsuarioFilter) {
      where.tipoUsuario = tipoUsuarioFilter;
    }

    if (search && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { nomeCompleto: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { cpf: { contains: term, mode: 'insensitive' } },
        { codUsuario: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [candidatos, total] = await Promise.all([
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

    const candidatosComEndereco = candidatos.map((candidato) => attachEnderecoResumo(candidato)!);

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
        telefone: true,
        dataNasc: true,
        genero: true,
        matricula: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
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

    return attachEnderecoResumo(usuario);
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
        role: Role.ALUNO_CANDIDATO,
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        cpf: true,
        telefone: true,
        dataNasc: true,
        genero: true,
        matricula: true,
        role: true,
        status: true,
        tipoUsuario: true,
        supabaseId: true,
        ultimoLogin: true,
        criadoEm: true,
        atualizadoEm: true,
        avatarUrl: true,
        descricao: true,
        instagram: true,
        linkedin: true,
        codUsuario: true,
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

    return attachEnderecoResumo(candidato);
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
    if (adminId === userId && roleEnum !== 'ADMIN') {
      throw new Error('Você não pode alterar sua própria role para uma função não-administrativa');
    }

    const usuario = await prisma.usuarios.update({
      where: { id: userId },
      data: { role: roleEnum as any },
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
}

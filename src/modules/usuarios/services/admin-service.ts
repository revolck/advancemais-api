/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { prisma } from "../../../config/prisma";
import { invalidateUserCache } from "../utils/cache";
export class AdminService {
  constructor() {}

  /**
   * Lista usuários com filtros e paginação
   */
  async listarUsuarios(query: any) {
    const { page = 1, limit = 50, status, role, tipoUsuario } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Construir filtros dinamicamente
    const where: any = {};
    if (status) where.status = status as string;
    if (role) where.role = role as string;
    if (tipoUsuario) where.tipoUsuario = tipoUsuario;

    const [usuarios, total] = await Promise.all([
      prisma.usuario.findMany({
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
        orderBy: { criadoEm: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.usuario.count({ where }),
    ]);

    return {
      message: "Lista de usuários",
      usuarios,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Busca usuário específico com detalhes
   */
  async buscarUsuario(userId: string) {
    if (!userId || userId.trim() === "") {
      throw new Error("ID do usuário é obrigatório");
    }

    return await prisma.usuario.findUnique({
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
        empresa: {
          select: { id: true, nome: true },
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
      },
    });
  }

  /**
   * Atualiza status do usuário - TIPAGEM CORRETA
   */
  async atualizarStatus(userId: string, status: string, motivo?: string) {
    // Validações
    if (!userId || userId.trim() === "") {
      throw new Error("ID do usuário é obrigatório");
    }

    // Validação usando enum do Prisma
    const statusEnum = status.trim();

    // Buscar dados antes da atualização
    const usuarioAntes = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { status: true, email: true, nomeCompleto: true },
    });

    if (!usuarioAntes) {
      throw new Error("Usuário não encontrado");
    }

    // Atualizar status - CORREÇÃO: usando enum
    const usuario = await prisma.usuario.update({
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
    console.log(
      `Status do usuário ${userId} alterado de ${
        usuarioAntes.status
      } para ${statusEnum}${motivo ? ` (Motivo: ${motivo})` : ""}`
    );

    return {
      message: "Status do usuário atualizado com sucesso",
      usuario,
      statusAnterior: usuarioAntes.status,
    };
  }

  /**
   * Atualiza role do usuário - TIPAGEM CORRETA
   */
  async atualizarRole(
    userId: string,
    role: string,
    motivo?: string,
    adminId?: string
  ) {
    // Validações
    if (!userId || !role) {
      throw new Error("ID do usuário e role são obrigatórios");
    }

    const roleEnum = role.trim();

    // Prevenir auto-demoção de ADMIN
    if (adminId === userId && roleEnum !== "ADMIN") {
      throw new Error(
        "Você não pode alterar sua própria role para uma função não-administrativa"
      );
    }

    const usuario = await prisma.usuario.update({
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

    console.log(
      `Role do usuário ${userId} alterada para ${roleEnum}${
        motivo ? ` (Motivo: ${motivo})` : ""
      }`
    );

    return {
      message: "Role do usuário atualizada com sucesso",
      usuario,
    };
  }

}

/**
 * Service administrativo - Lógica de negócio
 * Responsabilidade única: operações administrativas no banco
 *
 * @author Sistema AdvanceMais
 * @version 3.0.0
 */
import { prisma } from "../../../config/prisma";
import { Prisma } from "@prisma/client";
import { SubscriptionService } from "../../mercadopago/services/subscription-service";

export class AdminService {
  private subscriptionService: SubscriptionService;

  constructor() {
    this.subscriptionService = new SubscriptionService();
  }

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
          emailBoasVindasEnviado: true,
          _count: {
            select: {
              mercadoPagoOrders: true,
              mercadoPagoSubscriptions: true,
            },
          },
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
        emailBoasVindasEnviado: true,
        dataEmailBoasVindas: true,
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
        mercadoPagoOrders: {
          select: {
            id: true,
            mercadoPagoOrderId: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            criadoEm: true,
          },
          orderBy: { criadoEm: "desc" },
          take: 10,
        },
        mercadoPagoSubscriptions: {
          select: {
            id: true,
            mercadoPagoSubscriptionId: true,
            status: true,
            reason: true,
            transactionAmount: true,
            criadoEm: true,
          },
          orderBy: { criadoEm: "desc" },
          take: 5,
        },
      },
    });
  }

  /**
   * Histórico de pagamentos do usuário
   */
  async historicoPagamentos(userId: string, query: any) {
    const { page = 1, limit = 20 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!userId) {
      throw new Error("ID do usuário é obrigatório");
    }

    const [orders, subscriptions, refunds, totalOrders] = await Promise.all([
      // Orders
      prisma.mercadoPagoOrder.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        skip,
        take: Number(limit),
        select: {
          id: true,
          mercadoPagoOrderId: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          refundedAmount: true,
          externalReference: true,
          processingMode: true,
          criadoEm: true,
          dateCreated: true,
          dateClosed: true,
        },
      }),
      // Subscriptions
      prisma.mercadoPagoSubscription.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          mercadoPagoSubscriptionId: true,
          status: true,
          reason: true,
          transactionAmount: true,
          frequency: true,
          frequencyType: true,
          nextPaymentDate: true,
          criadoEm: true,
          dateCreated: true,
        },
      }),
      // Refunds
      prisma.mercadoPagoRefund.findMany({
        where: { usuarioId: userId },
        orderBy: { criadoEm: "desc" },
        take: 10,
        select: {
          id: true,
          mercadoPagoRefundId: true,
          amount: true,
          status: true,
          reason: true,
          criadoEm: true,
        },
      }),
      // Total count
      prisma.mercadoPagoOrder.count({ where: { usuarioId: userId } }),
    ]);

    return {
      message: "Histórico de pagamentos do usuário",
      data: {
        orders,
        subscriptions,
        refunds,
        summary: {
          totalOrders: orders.length,
          totalSubscriptions: subscriptions.length,
          totalRefunds: refunds.length,
          totalPaid: orders.reduce(
            (sum: number, order: { paidAmount: number }) =>
              sum + order.paidAmount,
            0
          ),
          totalRefunded: refunds.reduce(
            (sum: number, refund: { amount: number }) => sum + refund.amount,
            0
          ),
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalOrders,
          pages: Math.ceil(totalOrders / Number(limit)),
        },
      },
    };
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
      },
    });

    // Cancelar assinatura se suspenso/banido
    if (
      (statusEnum === "SUSPENSO" || statusEnum === "BANIDO") &&
      usuarioAntes.status === "ATIVO"
    ) {
      await this.cancelarAssinaturaSeAtiva(userId);
    }

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
      },
    });

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

  /**
   * Cancela assinatura ativa (método privado)
   */
  private async cancelarAssinaturaSeAtiva(userId: string) {
    try {
      const assinaturaAtiva = await prisma.mercadoPagoSubscription.findFirst({
        where: {
          usuarioId: userId,
          status: "authorized",
        },
      });

      if (assinaturaAtiva) {
        await this.subscriptionService.cancelSubscription(
          assinaturaAtiva.mercadoPagoSubscriptionId,
          userId
        );

        console.log(
          `Assinatura ${assinaturaAtiva.mercadoPagoSubscriptionId} cancelada devido à suspensão/banimento do usuário ${userId}`
        );
      }
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      // Não falha o processo principal
    }
  }
}

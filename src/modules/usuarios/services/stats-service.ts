/**
 * Service de estatísticas - Lógica de negócio para métricas
 * Responsabilidade única: cálculo de estatísticas do sistema
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { prisma } from "../../../config/prisma";

export class StatsService {
  /**
   * Estatísticas gerais do dashboard
   */
  async getDashboardStats() {
    const [
      totalUsuarios,
      usuariosAtivos,
      usuariosHoje,
      totalOrders,
      ordersAprovadas,
      totalAssinaturas,
      assinaturasAtivas,
      receitaOrders,
      receitaAssinaturas,
    ] = await Promise.all([
      // Usuários
      prisma.usuario.count(),
      prisma.usuario.count({ where: { status: "ATIVO" } }),
      prisma.usuario.count({
        where: {
          criadoEm: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),

      // Orders
      prisma.mercadoPagoOrder.count(),
      prisma.mercadoPagoOrder.count({ where: { status: "closed" } }),

      // Assinaturas
      prisma.mercadoPagoSubscription.count(),
      prisma.mercadoPagoSubscription.count({ where: { status: "authorized" } }),

      // Receita
      prisma.mercadoPagoOrder.aggregate({
        where: { status: "closed" },
        _sum: { paidAmount: true },
      }),
      prisma.mercadoPagoSubscription.aggregate({
        where: { status: "authorized" },
        _sum: { transactionAmount: true },
      }),
    ]);

    return {
      usuarios: {
        total: totalUsuarios,
        ativos: usuariosAtivos,
        hoje: usuariosHoje,
        taxaAtivacao:
          totalUsuarios > 0
            ? ((usuariosAtivos / totalUsuarios) * 100).toFixed(1)
            : 0,
      },
      pagamentos: {
        totalOrders,
        ordersAprovadas,
        totalAssinaturas,
        assinaturasAtivas,
        taxaConversao:
          totalOrders > 0
            ? ((ordersAprovadas / totalOrders) * 100).toFixed(1)
            : 0,
      },
      receita: {
        orders: receitaOrders._sum.paidAmount || 0,
        assinaturas: receitaAssinaturas._sum.transactionAmount || 0,
        total:
          (receitaOrders._sum.paidAmount || 0) +
          (receitaAssinaturas._sum.transactionAmount || 0),
      },
    };
  }

  /**
   * Estatísticas específicas de usuários
   */
  async getUserStats(periodo: string) {
    const diasAtras = this.getPeriodoDays(periodo);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);

    const [usuariosPorPeriodo, usuariosPorStatus, usuariosPorTipo] =
      await Promise.all([
        // Usuários por período
        prisma.usuario.groupBy({
          by: ["criadoEm"],
          where: { criadoEm: { gte: dataInicio } },
          _count: { id: true },
        }),

        // Por status
        prisma.usuario.groupBy({
          by: ["status"],
          _count: { id: true },
        }),

        // Por tipo
        prisma.usuario.groupBy({
          by: ["tipoUsuario"],
          _count: { id: true },
        }),
      ]);

    return {
      periodo: {
        diasConsiderados: diasAtras,
        usuariosNoPeriodo: usuariosPorPeriodo.reduce(
          (sum: number, item: { _count: { id: number } }) =>
            sum + item._count.id,
          0
        ),
        mediaPorDia:
          usuariosPorPeriodo.length > 0
            ? (
                usuariosPorPeriodo.reduce(
                  (sum: number, item: { _count: { id: number } }) =>
                    sum + item._count.id,
                  0
                ) / diasAtras
              ).toFixed(1)
            : 0,
      },
      distribuicao: {
        porStatus: usuariosPorStatus,
        porTipo: usuariosPorTipo,
      },
    };
  }

  /**
   * Estatísticas de pagamentos
   */
  async getPaymentStats(periodo: string) {
    const diasAtras = this.getPeriodoDays(periodo);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);

    const [ordersPorPeriodo, ordersPorStatus, assinaturasPorStatus] =
      await Promise.all([
        // Orders no período
        prisma.mercadoPagoOrder.groupBy({
          by: ["status"],
          where: { criadoEm: { gte: dataInicio } },
          _count: { id: true },
          _sum: { paidAmount: true },
        }),

        // Todas as orders por status
        prisma.mercadoPagoOrder.groupBy({
          by: ["status"],
          _count: { id: true },
          _sum: { totalAmount: true, paidAmount: true },
        }),

        // Assinaturas por status
        prisma.mercadoPagoSubscription.groupBy({
          by: ["status"],
          _count: { id: true },
          _sum: { transactionAmount: true },
        }),
      ]);

    const receitaPeriodo = ordersPorPeriodo.reduce(
      (sum: number, item: { _sum: { paidAmount: number | null } }) =>
        sum + (item._sum.paidAmount || 0),
      0
    );

    return {
      periodo: {
        diasConsiderados: diasAtras,
        ordersPeriodo: ordersPorPeriodo.reduce(
          (sum: number, item: { _count: { id: number } }) =>
            sum + item._count.id,
          0
        ),
        receitaPeriodo,
        ticketMedio:
          ordersPorPeriodo.length > 0
            ? (
                receitaPeriodo /
                ordersPorPeriodo.reduce(
                  (sum: number, item: { _count: { id: number } }) =>
                    sum + item._count.id,
                  0
                )
              ).toFixed(2)
            : 0,
      },
      distribuicao: {
        ordersPorStatus,
        assinaturasPorStatus,
      },
    };
  }

  /**
   * Converte período em dias
   */
  private getPeriodoDays(periodo: string): number {
    const periodos: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };

    return periodos[periodo] || 30;
  }
}

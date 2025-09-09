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
    ] = await Promise.all([
      prisma.usuario.count(),
      prisma.usuario.count({ where: { status: "ATIVO" } }),
      prisma.usuario.count({
        where: {
          criadoEm: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
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
        totalOrders: 0,
        ordersAprovadas: 0,
        totalAssinaturas: 0,
        assinaturasAtivas: 0,
        taxaConversao: 0,
      },
      receita: {
        orders: 0,
        assinaturas: 0,
        total: 0,
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

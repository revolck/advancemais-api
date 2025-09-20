/**
 * Service de estatísticas - Lógica de negócio para métricas
 * Responsabilidade única: cálculo de estatísticas do sistema
 *
 * @author Sistema Advance+
 * @version 3.0.0
 */
import { prisma } from '../../../config/prisma';
import redis from '../../../config/redis';
import { getCache, setCache, DEFAULT_TTL } from '../../../utils/cache';

type CountGroup = {
  _count: {
    id: number;
  };
};

type DistributionGroup<Key extends string> = CountGroup & {
  [K in Key]: string | null;
};

type UserStatsResponse = {
  periodo: {
    diasConsiderados: number;
    usuariosNoPeriodo: number;
    mediaPorDia: string | number;
  };
  distribuicao: {
    porStatus: DistributionGroup<'status'>[];
    porTipo: DistributionGroup<'tipoUsuario'>[];
  };
};

const USER_STATS_CACHE_TTL = Number(process.env.USER_STATS_CACHE_TTL ?? DEFAULT_TTL);

export class StatsService {
  /**
   * Estatísticas gerais do dashboard
   */
  async getDashboardStats() {
    const cacheKey = 'dashboard:stats';

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [totalUsuarios, usuariosAtivos, usuariosHoje] = await Promise.all([
      prisma.usuarios.count(),
      prisma.usuarios.count({ where: { status: 'ATIVO' } }),
      prisma.usuarios.count({
        where: {
          criadoEm: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const stats = {
      usuarios: {
        total: totalUsuarios,
        ativos: usuariosAtivos,
        hoje: usuariosHoje,
        taxaAtivacao: totalUsuarios > 0 ? ((usuariosAtivos / totalUsuarios) * 100).toFixed(1) : 0,
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

    await redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);

    return stats;
  }

  /**
   * Estatísticas específicas de usuários
   */
  async getUserStats(periodo: string) {
    const cacheKey = `stats:user:${periodo}`;
    const cached = await getCache<UserStatsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const diasAtras = this.getPeriodoDays(periodo);
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);

    const [usuariosPorPeriodo, usuariosPorStatus, usuariosPorTipo] = (await Promise.all([
      // Usuários por período
      prisma.usuarios.groupBy({
        by: ['criadoEm'],
        where: { criadoEm: { gte: dataInicio } },
        _count: { id: true },
      }),

      // Por status
      prisma.usuarios.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Por tipo
      prisma.usuarios.groupBy({
        by: ['tipoUsuario'],
        _count: { id: true },
      }),
    ])) as [
      (CountGroup & { criadoEm: Date })[],
      DistributionGroup<'status'>[],
      DistributionGroup<'tipoUsuario'>[],
    ];

    const usuariosNoPeriodo = usuariosPorPeriodo.reduce(
      (sum: number, item: { _count: { id: number } }) => sum + item._count.id,
      0,
    );
    const mediaPorDia =
      usuariosPorPeriodo.length > 0 ? (usuariosNoPeriodo / diasAtras).toFixed(1) : 0;

    const stats: UserStatsResponse = {
      periodo: {
        diasConsiderados: diasAtras,
        usuariosNoPeriodo,
        mediaPorDia,
      },
      distribuicao: {
        porStatus: usuariosPorStatus,
        porTipo: usuariosPorTipo,
      },
    };

    await setCache(cacheKey, stats, USER_STATS_CACHE_TTL);

    return stats;
  }

  /**
   * Converte período em dias
   */
  private getPeriodoDays(periodo: string): number {
    const periodos: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };

    return periodos[periodo] || 30;
  }
}

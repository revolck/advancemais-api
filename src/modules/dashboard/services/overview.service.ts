import {
  CursoStatus,
  CursosStatusPadrao,
  Prisma,
  Roles as PrismaRoles,
  Status,
  StatusDeVagas,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { syncExpiredPublishedVagas } from '@/modules/empresas/vagas/services/status-sync.service';
import { Roles } from '@/modules/usuarios/enums/Roles';
import { recrutadorVagasService } from '@/modules/usuarios/services/recrutador-vagas.service';

type DashboardOverviewScope = {
  viewerRole?: string;
  viewerId?: string;
};

const USER_ROLE_ORDER: PrismaRoles[] = [
  PrismaRoles.ADMIN,
  PrismaRoles.MODERADOR,
  PrismaRoles.FINANCEIRO,
  PrismaRoles.PEDAGOGICO,
  PrismaRoles.SETOR_DE_VAGAS,
  PrismaRoles.RECRUTADOR,
  PrismaRoles.EMPRESA,
  PrismaRoles.INSTRUTOR,
  PrismaRoles.ALUNO_CANDIDATO,
];

const USER_ROLE_LABELS: Record<PrismaRoles, string> = {
  [PrismaRoles.ADMIN]: 'Administradores',
  [PrismaRoles.MODERADOR]: 'Moderadores',
  [PrismaRoles.FINANCEIRO]: 'Financeiro',
  [PrismaRoles.PEDAGOGICO]: 'Setor Pedagógico',
  [PrismaRoles.SETOR_DE_VAGAS]: 'Setor de Vagas',
  [PrismaRoles.RECRUTADOR]: 'Recrutadores',
  [PrismaRoles.EMPRESA]: 'Empresas',
  [PrismaRoles.INSTRUTOR]: 'Instrutores',
  [PrismaRoles.ALUNO_CANDIDATO]: 'Alunos',
};

const CLOSED_VAGA_STATUSES: StatusDeVagas[] = [
  StatusDeVagas.ENCERRADA,
  StatusDeVagas.EXPIRADO,
  StatusDeVagas.DESPUBLICADA,
];

const buildUsuarioScopeWhere = (viewerRole?: string): Prisma.UsuariosWhereInput => {
  if (viewerRole === Roles.SETOR_DE_VAGAS) {
    return {
      OR: [
        { role: PrismaRoles.EMPRESA },
        {
          role: PrismaRoles.ALUNO_CANDIDATO,
          UsuariosCurriculos: { some: {} },
        },
      ],
    };
  }

  if (viewerRole === Roles.PEDAGOGICO) {
    return {
      role: {
        in: [PrismaRoles.ALUNO_CANDIDATO, PrismaRoles.INSTRUTOR],
      },
    };
  }

  return {};
};

const groupByToMap = <
  T extends {
    _count: { _all: number };
  },
>(
  rows: T[],
  keySelector: (row: T) => string,
) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    acc[keySelector(row)] = row._count._all;
    return acc;
  }, {});

export const dashboardOverviewService = {
  async getOverview(scope: DashboardOverviewScope) {
    const scopedVagaIds =
      scope.viewerRole === Roles.RECRUTADOR && scope.viewerId
        ? await recrutadorVagasService.listVagaIds(scope.viewerId)
        : null;

    const vagasScopeWhere: Prisma.EmpresasVagasWhereInput =
      scopedVagaIds && scopedVagaIds.length === 0
        ? { id: { in: [] } }
        : scopedVagaIds
          ? { id: { in: scopedVagaIds } }
          : {};

    await syncExpiredPublishedVagas({
      vagaIds: scopedVagaIds ?? undefined,
    });

    const usuariosWhere = buildUsuarioScopeWhere(scope.viewerRole);

    const [
      totalUsuarios,
      usuariosPorRoleRaw,
      totalCursos,
      cursosPublicados,
      turmasAtivas,
      totalEmpresas,
      empresasAtivas,
      totalInstrutores,
      instrutoresAtivos,
      totalAlunos,
      alunosConcluidos,
      totalVagasPublicadas,
      totalVagasEmAnalise,
      totalVagasEncerradas,
      usuariosStatusRaw,
      totalCursosEncerrados,
      empresasBloqueadas,
    ] = await Promise.all([
      prisma.usuarios.count({ where: usuariosWhere }),
      prisma.usuarios.groupBy({
        by: ['role'],
        where: usuariosWhere,
        _count: { _all: true },
      }),
      prisma.cursos.count(),
      prisma.cursos.count({ where: { statusPadrao: CursoStatus.PUBLICADO } }),
      prisma.cursosTurmas.count({ where: { status: CursoStatus.EM_ANDAMENTO } }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.EMPRESA,
        },
      }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.EMPRESA,
          status: Status.ATIVO,
        },
      }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.INSTRUTOR,
        },
      }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.INSTRUTOR,
          status: Status.ATIVO,
        },
      }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.ALUNO_CANDIDATO,
        },
      }),
      prisma.cursosTurmasInscricoes.count({
        where: { status: 'CONCLUIDO' },
      }),
      prisma.empresasVagas.count({
        where: {
          ...vagasScopeWhere,
          status: StatusDeVagas.PUBLICADO,
        },
      }),
      prisma.empresasVagas.count({
        where: {
          ...vagasScopeWhere,
          status: StatusDeVagas.EM_ANALISE,
        },
      }),
      prisma.empresasVagas.count({
        where: {
          ...vagasScopeWhere,
          status: { in: CLOSED_VAGA_STATUSES },
        },
      }),
      prisma.usuarios.groupBy({
        by: ['status'],
        where: usuariosWhere,
        _count: { _all: true },
      }),
      prisma.cursos.count({
        where: { statusPadrao: CursosStatusPadrao.RASCUNHO },
      }),
      prisma.usuarios.count({
        where: {
          ...usuariosWhere,
          role: PrismaRoles.EMPRESA,
          status: Status.BLOQUEADO,
        },
      }),
    ]);

    const usuariosPorRoleMap = groupByToMap(usuariosPorRoleRaw, (row) => row.role);
    const usuariosStatusMap = groupByToMap(usuariosStatusRaw, (row) => row.status);
    const usuariosStatusTotal =
      (usuariosStatusMap[Status.ATIVO] ?? 0) +
      (usuariosStatusMap[Status.BLOQUEADO] ?? 0) +
      (usuariosStatusMap[Status.INATIVO] ?? 0) +
      (usuariosStatusMap[Status.PENDENTE] ?? 0) +
      (usuariosStatusMap[Status.SUSPENSO] ?? 0);

    const usuariosPorTipoItems = USER_ROLE_ORDER.map((role) => {
      const count = usuariosPorRoleMap[role] ?? 0;
      const percentual = totalUsuarios > 0 ? Number(((count / totalUsuarios) * 100).toFixed(1)) : 0;

      return {
        role,
        label: USER_ROLE_LABELS[role],
        total: count,
        percentual,
      };
    }).filter((item) => item.total > 0);

    return {
      metricasGerais: {
        totalUsuarios,
        totalCursos,
        totalEmpresas,
        totalVagas: totalVagasPublicadas,
      },
      cards: {
        cursos: {
          total: totalCursos,
          publicados: cursosPublicados,
          turmasAtivas,
        },
        alunos: {
          total: totalAlunos,
          concluidos: alunosConcluidos,
        },
        instrutores: {
          total: totalInstrutores,
          ativos: instrutoresAtivos,
        },
        empresas: {
          total: totalEmpresas,
          ativas: empresasAtivas,
        },
        vagas: {
          publicadas: totalVagasPublicadas,
          emAnalise: totalVagasEmAnalise,
          encerradas: totalVagasEncerradas,
        },
      },
      usuariosPorTipo: {
        total: totalUsuarios,
        items: usuariosPorTipoItems,
      },
      statusPorCategoria: {
        usuarios: {
          ativo: usuariosStatusMap[Status.ATIVO] ?? 0,
          bloqueado: usuariosStatusMap[Status.BLOQUEADO] ?? 0,
          inativo: usuariosStatusMap[Status.INATIVO] ?? 0,
          pendente: usuariosStatusMap[Status.PENDENTE] ?? 0,
          suspenso: usuariosStatusMap[Status.SUSPENSO] ?? 0,
          total: usuariosStatusTotal,
        },
        cursos: {
          publicado: cursosPublicados,
          encerrado: totalCursosEncerrados,
        },
        empresas: {
          ativo: empresasAtivas,
          bloqueado: empresasBloqueadas,
        },
        vagas: {
          publicado: totalVagasPublicadas,
          encerrado: totalVagasEncerradas,
        },
      },
      atualizadoEm: new Date().toISOString(),
    };
  },
};

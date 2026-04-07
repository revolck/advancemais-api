import { CursosAulaStatus, CursosAvaliacaoTipo, Status, type Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';

type InstrutorOverviewData = {
  metricasGerais: {
    totalAlunos: number;
    totalProvas: number;
    totalNotasPendentes: number;
    totalNotasLancadas: number;
    totalCursos: number;
    totalTurmas: number;
    totalAulas: number;
    totalEventosAgenda: number;
  };
  cards: {
    alunos: {
      total: number;
      ativos: number;
    };
    provas: {
      total: number;
      pendentesCorrecao: number;
    };
    notas: {
      pendentes: number;
      lancadas: number;
    };
    cursos: {
      total: number;
    };
    aulas: {
      total: number;
      hoje: number;
    };
    agenda: {
      eventos: number;
      proximos7Dias: number;
    };
  };
  statusPorCategoria: {
    alunos: {
      ativos: number;
      inativos: number;
      total: number;
    };
    provas: {
      abertas: number;
      encerradas: number;
      total: number;
    };
    notas: {
      pendentes: number;
      concluidas: number;
      total: number;
    };
    aulas: {
      agendadas: number;
      realizadas: number;
      total: number;
    };
  };
  atualizadoEm: string;
};

type InstrutorScope = {
  turmaIds: string[];
  explicitCursoIds: string[];
  directAulaIds: string[];
  directProvaIds: string[];
};

const OPEN_STATUSES = new Set<CursosAulaStatus>([
  CursosAulaStatus.PUBLICADA,
  CursosAulaStatus.EM_ANDAMENTO,
]);
const CLOSED_STATUSES = new Set<CursosAulaStatus>([
  CursosAulaStatus.CONCLUIDA,
  CursosAulaStatus.CANCELADA,
]);

const extractIds = <T>(items: T[], selector: (item: T) => string | null | undefined) =>
  Array.from(new Set(items.map(selector).filter((value): value is string => Boolean(value))));

const countStatuses = (statuses: CursosAulaStatus[], expected: Set<CursosAulaStatus>) =>
  statuses.filter((status) => expected.has(status)).length;

const buildTodayRange = (now: Date) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const createEmptyOverview = (): InstrutorOverviewData => ({
  metricasGerais: {
    totalAlunos: 0,
    totalProvas: 0,
    totalNotasPendentes: 0,
    totalNotasLancadas: 0,
    totalCursos: 0,
    totalTurmas: 0,
    totalAulas: 0,
    totalEventosAgenda: 0,
  },
  cards: {
    alunos: {
      total: 0,
      ativos: 0,
    },
    provas: {
      total: 0,
      pendentesCorrecao: 0,
    },
    notas: {
      pendentes: 0,
      lancadas: 0,
    },
    cursos: {
      total: 0,
    },
    aulas: {
      total: 0,
      hoje: 0,
    },
    agenda: {
      eventos: 0,
      proximos7Dias: 0,
    },
  },
  statusPorCategoria: {
    alunos: {
      ativos: 0,
      inativos: 0,
      total: 0,
    },
    provas: {
      abertas: 0,
      encerradas: 0,
      total: 0,
    },
    notas: {
      pendentes: 0,
      concluidas: 0,
      total: 0,
    },
    aulas: {
      agendadas: 0,
      realizadas: 0,
      total: 0,
    },
  },
  atualizadoEm: new Date().toISOString(),
});

const buildAulasScopeCondition = (scope: InstrutorScope): Prisma.CursosTurmasAulasWhereInput[] => {
  const conditions: Prisma.CursosTurmasAulasWhereInput[] = [];

  if (scope.directAulaIds.length > 0) {
    conditions.push({ id: { in: scope.directAulaIds } });
  }

  if (scope.turmaIds.length > 0) {
    conditions.push({ turmaId: { in: scope.turmaIds } });
  }

  if (scope.explicitCursoIds.length > 0) {
    conditions.push({
      cursoId: { in: scope.explicitCursoIds },
      turmaId: null,
    });
  }

  return conditions;
};

const buildProvasScopeCondition = (
  scope: InstrutorScope,
): Prisma.CursosTurmasProvasWhereInput[] => {
  const conditions: Prisma.CursosTurmasProvasWhereInput[] = [];

  if (scope.directProvaIds.length > 0) {
    conditions.push({ id: { in: scope.directProvaIds } });
  }

  if (scope.turmaIds.length > 0) {
    conditions.push({ turmaId: { in: scope.turmaIds } });
  }

  if (scope.explicitCursoIds.length > 0) {
    conditions.push({
      cursoId: { in: scope.explicitCursoIds },
      turmaId: null,
    });
  }

  return conditions;
};

const buildScope = async (instrutorId: string): Promise<InstrutorScope> => {
  const [turmasPrincipais, turmasVinculadas, aulasDiretas, provasDiretas] = await Promise.all([
    prisma.cursosTurmas.findMany({
      where: {
        instrutorId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    }),
    prisma.cursosTurmasInstrutores.findMany({
      where: {
        instrutorId,
        CursosTurmas: {
          deletedAt: null,
        },
      },
      select: {
        turmaId: true,
      },
    }),
    prisma.cursosTurmasAulas.findMany({
      where: {
        instrutorId,
        deletedAt: null,
      },
      select: {
        id: true,
        turmaId: true,
        cursoId: true,
      },
    }),
    prisma.cursosTurmasProvas.findMany({
      where: {
        instrutorId,
        ativo: true,
      },
      select: {
        id: true,
        turmaId: true,
        cursoId: true,
      },
    }),
  ]);

  const turmaScopeIds = new Set<string>();
  const explicitCursoScopeIds = new Set<string>();

  turmasPrincipais.forEach((item) => turmaScopeIds.add(item.id));
  turmasVinculadas.forEach((item) => turmaScopeIds.add(item.turmaId));

  aulasDiretas.forEach((item) => {
    if (item.turmaId) {
      turmaScopeIds.add(item.turmaId);
      return;
    }

    if (item.cursoId) {
      explicitCursoScopeIds.add(item.cursoId);
    }
  });

  provasDiretas.forEach((item) => {
    if (item.turmaId) {
      turmaScopeIds.add(item.turmaId);
      return;
    }

    if (item.cursoId) {
      explicitCursoScopeIds.add(item.cursoId);
    }
  });

  if (explicitCursoScopeIds.size > 0) {
    const turmasFromCursoScope = await prisma.cursosTurmas.findMany({
      where: {
        cursoId: { in: [...explicitCursoScopeIds] },
        deletedAt: null,
      },
      select: { id: true },
    });

    turmasFromCursoScope.forEach((item) => turmaScopeIds.add(item.id));
  }

  return {
    turmaIds: [...turmaScopeIds],
    explicitCursoIds: [...explicitCursoScopeIds],
    directAulaIds: extractIds(aulasDiretas, (item) => item.id),
    directProvaIds: extractIds(provasDiretas, (item) => item.id),
  };
};

export const instrutorOverviewService = {
  async getOverview(instrutorId: string): Promise<InstrutorOverviewData> {
    const scope = await buildScope(instrutorId);
    const hasScope =
      scope.turmaIds.length > 0 ||
      scope.explicitCursoIds.length > 0 ||
      scope.directAulaIds.length > 0 ||
      scope.directProvaIds.length > 0;

    if (!hasScope) {
      return createEmptyOverview();
    }

    const aulasScopeOr = buildAulasScopeCondition(scope);
    const provasScopeOr = buildProvasScopeCondition(scope);

    const [turmasEscopo, aulasEscopo, provasEscopo] = await Promise.all([
      scope.turmaIds.length > 0
        ? prisma.cursosTurmas.findMany({
            where: {
              id: { in: scope.turmaIds },
              deletedAt: null,
            },
            select: {
              id: true,
              cursoId: true,
            },
          })
        : Promise.resolve([]),
      aulasScopeOr.length > 0
        ? prisma.cursosTurmasAulas.findMany({
            where: {
              OR: aulasScopeOr,
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              dataInicio: true,
              cursoId: true,
            },
          })
        : Promise.resolve([]),
      provasScopeOr.length > 0
        ? prisma.cursosTurmasProvas.findMany({
            where: {
              OR: provasScopeOr,
              ativo: true,
            },
            select: {
              id: true,
              tipo: true,
              status: true,
              cursoId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const turmaIds = extractIds(turmasEscopo, (item) => item.id);
    const courseIds = new Set<string>(scope.explicitCursoIds);

    turmasEscopo.forEach((item) => courseIds.add(item.cursoId));
    aulasEscopo.forEach((item) => {
      if (item.cursoId) {
        courseIds.add(item.cursoId);
      }
    });
    provasEscopo.forEach((item) => {
      if (item.cursoId) {
        courseIds.add(item.cursoId);
      }
    });

    const provasAvaliativas = provasEscopo.filter(
      (item) => item.tipo === CursosAvaliacaoTipo.PROVA,
    );
    const provaIds = extractIds(provasAvaliativas, (item) => item.id);

    const [inscricoesDistinct, notas, enviosPendentesCorrecao] = await Promise.all([
      turmaIds.length > 0
        ? prisma.cursosTurmasInscricoes.findMany({
            where: {
              turmaId: { in: turmaIds },
            },
            distinct: ['alunoId'],
            select: {
              alunoId: true,
            },
          })
        : Promise.resolve([]),
      turmaIds.length > 0
        ? prisma.cursosNotas.findMany({
            where: {
              turmaId: { in: turmaIds },
            },
            select: {
              nota: true,
            },
          })
        : Promise.resolve([]),
      provaIds.length > 0
        ? prisma.cursosTurmasProvasEnvios.count({
            where: {
              provaId: { in: provaIds },
              nota: null,
            },
          })
        : Promise.resolve(0),
    ]);

    const alunoIds = extractIds(inscricoesDistinct, (item) => item.alunoId);
    const totalAlunos = alunoIds.length;
    const totalAlunosAtivos =
      totalAlunos > 0
        ? await prisma.usuarios.count({
            where: {
              id: { in: alunoIds },
              status: Status.ATIVO,
            },
          })
        : 0;
    const totalAlunosAtivosLimitado = Math.min(totalAlunosAtivos, totalAlunos);
    const totalAlunosInativos = Math.max(0, totalAlunos - totalAlunosAtivosLimitado);

    const notasPendentes = notas.filter((item) => item.nota == null).length;
    const notasLancadas = notas.length - notasPendentes;

    const provasStatus = provasAvaliativas.map((item) => item.status);
    const provasAbertas = countStatuses(provasStatus, OPEN_STATUSES);
    const provasEncerradas = countStatuses(provasStatus, CLOSED_STATUSES);
    const totalProvas = provasAbertas + provasEncerradas;

    const aulasStatus = aulasEscopo.map((item) => item.status);
    const aulasAgendadas = countStatuses(aulasStatus, OPEN_STATUSES);
    const aulasRealizadas = countStatuses(aulasStatus, CLOSED_STATUSES);
    const totalAulas = aulasAgendadas + aulasRealizadas;

    const now = new Date();
    const { start, end } = buildTodayRange(now);
    const aulasHoje = aulasEscopo.filter(
      (item) => item.dataInicio && item.dataInicio >= start && item.dataInicio <= end,
    ).length;

    const agendaScopeOr: Prisma.CursosTurmasAgendaWhereInput[] = [];
    if (turmaIds.length > 0) {
      agendaScopeOr.push({ turmaId: { in: turmaIds } });
    }

    const aulaIds = extractIds(aulasEscopo, (item) => item.id);
    if (aulaIds.length > 0) {
      agendaScopeOr.push({ aulaId: { in: aulaIds } });
    }
    if (provaIds.length > 0) {
      agendaScopeOr.push({ provaId: { in: provaIds } });
    }

    const [totalEventosAgenda, totalEventosAgendaProximos7Dias] =
      agendaScopeOr.length > 0
        ? await Promise.all([
            prisma.cursosTurmasAgenda.count({
              where: {
                OR: agendaScopeOr,
              },
            }),
            prisma.cursosTurmasAgenda.count({
              where: {
                OR: agendaScopeOr,
                inicio: {
                  gte: now,
                  lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                },
              },
            }),
          ])
        : [0, 0];

    return {
      metricasGerais: {
        totalAlunos,
        totalProvas,
        totalNotasPendentes: notasPendentes,
        totalNotasLancadas: notasLancadas,
        totalCursos: courseIds.size,
        totalTurmas: turmaIds.length,
        totalAulas,
        totalEventosAgenda,
      },
      cards: {
        alunos: {
          total: totalAlunos,
          ativos: totalAlunosAtivosLimitado,
        },
        provas: {
          total: totalProvas,
          pendentesCorrecao: enviosPendentesCorrecao,
        },
        notas: {
          pendentes: notasPendentes,
          lancadas: notasLancadas,
        },
        cursos: {
          total: courseIds.size,
        },
        aulas: {
          total: totalAulas,
          hoje: aulasHoje,
        },
        agenda: {
          eventos: totalEventosAgenda,
          proximos7Dias: totalEventosAgendaProximos7Dias,
        },
      },
      statusPorCategoria: {
        alunos: {
          ativos: totalAlunosAtivosLimitado,
          inativos: totalAlunosInativos,
          total: totalAlunos,
        },
        provas: {
          abertas: provasAbertas,
          encerradas: provasEncerradas,
          total: totalProvas,
        },
        notas: {
          pendentes: notasPendentes,
          concluidas: notasLancadas,
          total: notasPendentes + notasLancadas,
        },
        aulas: {
          agendadas: aulasAgendadas,
          realizadas: aulasRealizadas,
          total: totalAulas,
        },
      },
      atualizadoEm: new Date().toISOString(),
    };
  },
};

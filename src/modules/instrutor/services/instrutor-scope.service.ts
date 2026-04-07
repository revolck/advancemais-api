import { CursosAvaliacaoTipo, type Prisma } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

const instrutorScopeLogger = logger.child({ module: 'InstrutorScopeService' });

export type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

export type TipoOrigemInstrutorScope = 'AULA' | 'PROVA' | 'ATIVIDADE';

export type InstrutorScope = {
  instrutorId: string;
  accessibleCursoIds: Set<string>;
  explicitCursoIds: Set<string>;
  accessibleTurmaIds: Set<string>;
  fullTurmaIds: Set<string>;
  directAulaIds: Set<string>;
  directAvaliacaoIds: Set<string>;
  directProvaIds: Set<string>;
  directAtividadeIds: Set<string>;
  blockedAulaIds: Set<string>;
  blockedAvaliacaoIds: Set<string>;
  blockedProvaIds: Set<string>;
  blockedAtividadeIds: Set<string>;
};

export const createEmptyInstrutorScope = (instrutorId: string): InstrutorScope => ({
  instrutorId,
  accessibleCursoIds: new Set<string>(),
  explicitCursoIds: new Set<string>(),
  accessibleTurmaIds: new Set<string>(),
  fullTurmaIds: new Set<string>(),
  directAulaIds: new Set<string>(),
  directAvaliacaoIds: new Set<string>(),
  directProvaIds: new Set<string>(),
  directAtividadeIds: new Set<string>(),
  blockedAulaIds: new Set<string>(),
  blockedAvaliacaoIds: new Set<string>(),
  blockedProvaIds: new Set<string>(),
  blockedAtividadeIds: new Set<string>(),
});

export const hasInstrutorScope = (scope: InstrutorScope) =>
  scope.accessibleCursoIds.size > 0 ||
  scope.explicitCursoIds.size > 0 ||
  scope.accessibleTurmaIds.size > 0 ||
  scope.fullTurmaIds.size > 0 ||
  scope.directAulaIds.size > 0 ||
  scope.directAvaliacaoIds.size > 0;

export const canAccessCursoInScope = (scope: InstrutorScope, cursoId: string) =>
  scope.accessibleCursoIds.has(cursoId) || scope.explicitCursoIds.has(cursoId);

export const canAccessTurmaInScope = (scope: InstrutorScope, turmaId: string) =>
  scope.accessibleTurmaIds.has(turmaId) || scope.fullTurmaIds.has(turmaId);

export const hasFullTurmaScope = (scope: InstrutorScope, turmaId: string) =>
  scope.fullTurmaIds.has(turmaId);

export const canAccessOrigemInScope = (
  scope: InstrutorScope,
  params: {
    turmaId: string;
    tipoOrigem: TipoOrigemInstrutorScope;
    origemId: string;
  },
) => {
  if (params.tipoOrigem === 'AULA') {
    if (scope.directAulaIds.has(params.origemId)) {
      return true;
    }

    if (scope.blockedAulaIds.has(params.origemId)) {
      return false;
    }

    return hasFullTurmaScope(scope, params.turmaId);
  }

  if (params.tipoOrigem === 'PROVA') {
    if (scope.directProvaIds.has(params.origemId)) {
      return true;
    }

    if (scope.blockedProvaIds.has(params.origemId)) {
      return false;
    }

    return hasFullTurmaScope(scope, params.turmaId);
  }

  if (scope.directAtividadeIds.has(params.origemId)) {
    return true;
  }

  if (scope.blockedAtividadeIds.has(params.origemId)) {
    return false;
  }

  return hasFullTurmaScope(scope, params.turmaId);
};

export const buildInstrutorScope = async (
  client: PrismaClientOrTx,
  instrutorId: string,
): Promise<InstrutorScope> => {
  try {
    const scope = createEmptyInstrutorScope(instrutorId);

    const [turmasPrincipais, turmasVinculadas, aulasDiretas, avaliacoesDiretas] =
      await Promise.all([
        client.cursosTurmas.findMany({
          where: {
            instrutorId,
            deletedAt: null,
          },
          select: {
            id: true,
            cursoId: true,
          },
        }),
        client.cursosTurmasInstrutores.findMany({
          where: {
            instrutorId,
            CursosTurmas: {
              deletedAt: null,
            },
          },
          select: {
            turmaId: true,
            CursosTurmas: {
              select: {
                cursoId: true,
              },
            },
          },
        }),
        client.cursosTurmasAulas.findMany({
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
        client.cursosTurmasProvas.findMany({
          where: {
            instrutorId,
            ativo: true,
          },
          select: {
            id: true,
            turmaId: true,
            cursoId: true,
            tipo: true,
          },
        }),
      ]);

    for (const turma of turmasPrincipais) {
      scope.fullTurmaIds.add(turma.id);
      scope.accessibleTurmaIds.add(turma.id);
      scope.accessibleCursoIds.add(turma.cursoId);
    }

    for (const vinculo of turmasVinculadas) {
      scope.fullTurmaIds.add(vinculo.turmaId);
      scope.accessibleTurmaIds.add(vinculo.turmaId);
      if (vinculo.CursosTurmas?.cursoId) {
        scope.accessibleCursoIds.add(vinculo.CursosTurmas.cursoId);
      }
    }

    for (const aula of aulasDiretas) {
      scope.directAulaIds.add(aula.id);

      if (aula.turmaId) {
        scope.accessibleTurmaIds.add(aula.turmaId);
        continue;
      }

      if (aula.cursoId) {
        scope.explicitCursoIds.add(aula.cursoId);
        scope.accessibleCursoIds.add(aula.cursoId);
      }
    }

    for (const avaliacao of avaliacoesDiretas) {
      scope.directAvaliacaoIds.add(avaliacao.id);
      if (avaliacao.tipo === CursosAvaliacaoTipo.PROVA) {
        scope.directProvaIds.add(avaliacao.id);
      } else {
        scope.directAtividadeIds.add(avaliacao.id);
      }

      if (avaliacao.turmaId) {
        scope.accessibleTurmaIds.add(avaliacao.turmaId);
        continue;
      }

      if (avaliacao.cursoId) {
        scope.explicitCursoIds.add(avaliacao.cursoId);
        scope.accessibleCursoIds.add(avaliacao.cursoId);
      }
    }

    if (scope.explicitCursoIds.size > 0) {
      const turmasPorCurso = await client.cursosTurmas.findMany({
        where: {
          cursoId: { in: [...scope.explicitCursoIds] },
          deletedAt: null,
        },
        select: {
          id: true,
          cursoId: true,
        },
      });

      for (const turma of turmasPorCurso) {
        scope.fullTurmaIds.add(turma.id);
        scope.accessibleTurmaIds.add(turma.id);
        scope.accessibleCursoIds.add(turma.cursoId);
      }
    }

    const turmaIds = Array.from(
      new Set([...scope.fullTurmaIds, ...scope.accessibleTurmaIds].filter(Boolean)),
    );

    if (turmaIds.length > 0) {
      const turmasAtivas = await client.cursosTurmas.findMany({
        where: {
          id: { in: turmaIds },
          deletedAt: null,
        },
        select: {
          id: true,
          cursoId: true,
        },
      });

      const turmaAtivaIds = new Set(turmasAtivas.map((turma) => turma.id));
      scope.fullTurmaIds = new Set([...scope.fullTurmaIds].filter((turmaId) => turmaAtivaIds.has(turmaId)));
      scope.accessibleTurmaIds = new Set(
        [...scope.accessibleTurmaIds].filter((turmaId) => turmaAtivaIds.has(turmaId)),
      );

      for (const turma of turmasAtivas) {
        scope.accessibleCursoIds.add(turma.cursoId);
      }
    }

    if (scope.fullTurmaIds.size > 0) {
      const turmaIdsComEscopoTotal = [...scope.fullTurmaIds];

      const [aulasProtegidas, avaliacoesProtegidas] = await Promise.all([
        client.cursosTurmasAulas.findMany({
          where: {
            turmaId: { in: turmaIdsComEscopoTotal },
            deletedAt: null,
          },
          select: {
            id: true,
            instrutorId: true,
          },
        }),
        client.cursosTurmasProvas.findMany({
          where: {
            turmaId: { in: turmaIdsComEscopoTotal },
          },
          select: {
            id: true,
            instrutorId: true,
            tipo: true,
          },
        }),
      ]);

      for (const aula of aulasProtegidas) {
        if (!aula.instrutorId || aula.instrutorId === instrutorId) continue;
        scope.blockedAulaIds.add(aula.id);
      }

      for (const avaliacao of avaliacoesProtegidas) {
        if (!avaliacao.instrutorId || avaliacao.instrutorId === instrutorId) continue;

        scope.blockedAvaliacaoIds.add(avaliacao.id);

        if (avaliacao.tipo === CursosAvaliacaoTipo.PROVA) {
          scope.blockedProvaIds.add(avaliacao.id);
          continue;
        }

        scope.blockedAtividadeIds.add(avaliacao.id);
      }
    }

    return scope;
  } catch (error) {
    instrutorScopeLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        instrutorId,
      },
      'Falha ao montar escopo do instrutor',
    );

    const scopeError = new Error('Falha ao montar o escopo do instrutor');
    (scopeError as any).code = 'INSTRUTOR_SCOPE_ERROR';
    throw scopeError;
  }
};

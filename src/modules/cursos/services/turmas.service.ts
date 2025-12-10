import {
  CursoStatus,
  CursosMetodos,
  CursosTurnos,
  Prisma,
  Roles,
  StatusInscricao,
  Status,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueInscricaoCode, generateUniqueTurmaCode } from '../utils/code-generator';
import { aulaWithMateriaisInclude } from './aulas.mapper';
import { moduloDetailedInclude } from './modulos.mapper';
import { provaDefaultInclude } from './provas.mapper';
import { cursosTurmasMapper, mapTurmaSummaryWithInscricoes } from './cursos.service';

const turmasLogger = logger.child({ module: 'CursosTurmasService' });

/**
 * Conta inscrições ativas por turma usando agregação SQL eficiente
 * Inscrição ativa = status não é CANCELADO/TRANCADO E aluno está ATIVO e não deletado
 */
async function countInscricoesAtivasPorTurma(turmaIds: string[]): Promise<Record<string, number>> {
  if (turmaIds.length === 0) {
    return {};
  }

  // Usar agregação SQL para melhor performance
  // Construir a query com IN ao invés de ANY para evitar problemas de tipo
  const placeholders = turmaIds.map((_, i) => `$${i + 1}`).join(', ');
  const result = await prisma.$queryRawUnsafe<Array<{ turmaId: string; count: bigint }>>(
    `SELECT 
      ti."turmaId"::text as "turmaId",
      COUNT(*)::int as count
    FROM "CursosTurmasInscricoes" ti
    INNER JOIN "Usuarios" u ON ti."alunoId" = u.id
    WHERE 
      ti."turmaId"::text IN (${placeholders})
      AND ti.status NOT IN ('CANCELADO', 'TRANCADO')
      AND u.status = 'ATIVO'
    GROUP BY ti."turmaId"`,
    ...turmaIds,
  );

  // Converter para Record<string, number>
  const countMap: Record<string, number> = {};
  for (const row of result) {
    countMap[row.turmaId] = Number(row.count);
  }

  // Garantir que todas as turmas tenham entrada (mesmo que 0)
  for (const turmaId of turmaIds) {
    if (!(turmaId in countMap)) {
      countMap[turmaId] = 0;
    }
  }

  return countMap;
}

const turmaSummarySelect = {
  id: true,
  codigo: true,
  nome: true,
  turno: true,
  metodo: true,
  status: true,
  vagasTotais: true,
  vagasDisponiveis: true,
  dataInicio: true,
  dataFim: true,
  dataInscricaoInicio: true,
  dataInscricaoFim: true,
  instrutorId: true,
  cursoId: true,
  Cursos: {
    select: {
      id: true,
      nome: true,
      codigo: true,
    },
  },
} as const;

const regrasAvaliacaoSelect = {
  mediaMinima: true,
  politicaRecuperacaoAtiva: true,
  modelosRecuperacao: true,
  ordemAplicacaoRecuperacao: true,
  notaMaximaRecuperacao: true,
  pesoProvaFinal: true,
  observacoes: true,
} as const;

const turmaDetailedInclude = Prisma.validator<Prisma.CursosTurmasDefaultArgs>()({
  include: {
    CursosTurmasInscricoes: {
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            UsuariosInformation: {
              select: { inscricao: true, telefone: true },
            },
            UsuariosEnderecos: {
              select: {
                logradouro: true,
                numero: true,
                bairro: true,
                cidade: true,
                estado: true,
                cep: true,
              },
              take: 1,
            },
          },
        },
      },
    },
    CursosTurmasAulas: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: aulaWithMateriaisInclude.include,
    },
    CursosTurmasModulos: {
      include: moduloDetailedInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasProvas: {
      include: provaDefaultInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    CursosTurmasRegrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

const ensureCursoExists = async (cursoId: string) => {
  const curso = await prisma.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
  if (!curso) {
    const error = new Error('Curso não encontrado');
    (error as any).code = 'CURSO_NOT_FOUND';
    throw error;
  }
};

const ensureTurmaBelongsToCurso = async (cursoId: string, turmaId: string) => {
  const turma = await prisma.cursosTurmas.findUnique({
    where: { id: turmaId },
    select: { id: true, cursoId: true },
  });

  if (!turma || turma.cursoId !== cursoId) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const fetchTurmaDetailed = async (client: PrismaClientOrTx, turmaId: string) => {
  const turma = await client.cursosTurmas.findUnique({
    where: { id: turmaId },
    ...turmaDetailedInclude,
  });

  if (!turma) {
    const error = new Error('Turma não encontrada');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }

  return cursosTurmasMapper.detailed(turma);
};

type TurmaListParams = {
  cursoId: string; // UUID String
  page: number;
  pageSize: number;
  status?: CursoStatus;
  turno?: CursosTurnos;
  metodo?: CursosMetodos;
  instrutorId?: string;
};

export const turmasService = {
  async list(params: TurmaListParams) {
    const { cursoId, page, pageSize, status, turno, metodo, instrutorId } = params;

    await ensureCursoExists(cursoId);

    const where: Prisma.CursosTurmasWhereInput = {
      cursoId,
    };

    if (status) {
      where.status = status;
    }

    if (turno) {
      where.turno = turno;
    }

    if (metodo) {
      where.metodo = metodo;
    }

    if (instrutorId) {
      where.instrutorId = instrutorId;
    }

    // Contar total de turmas com os filtros aplicados
    const total = await prisma.cursosTurmas.count({ where });

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const turmas = await prisma.cursosTurmas.findMany({
      where,
      select: turmaSummarySelect,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: pageSize,
    });

    // ✅ Otimização: Contar inscrições ativas em batch para todas as turmas
    const turmaIds = turmas.map((t) => t.id);
    const inscricoesCountMap = await countInscricoesAtivasPorTurma(turmaIds);

    const hasNext = totalPages > 0 && safePage < totalPages;
    const hasPrevious = safePage > 1;

    // Mapear turmas com contagem de inscrições e nome do curso
    const data = turmas.map((turma) => {
      const inscricoesCount = inscricoesCountMap[turma.id] || 0;
      const turmaMapped = mapTurmaSummaryWithInscricoes(turma, inscricoesCount);
      return {
        ...turmaMapped,
        curso: turma.Cursos
          ? {
              id: turma.Cursos.id,
              nome: turma.Cursos.nome,
              codigo: turma.Cursos.codigo,
            }
          : null,
      };
    });

    return {
      data,
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalItems: total,
        totalPages: totalPages || 1,
        hasNext,
        hasPrevious,
        isPageAdjusted: safePage !== page,
      },
      filters: {
        applied: {
          cursoId,
          status: status ?? null,
          turno: turno ?? null,
          metodo: metodo ?? null,
          instrutorId: instrutorId ?? null,
        },
      },
      meta: {
        empty: turmas.length === 0,
      },
    };
  },

  async get(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(cursoId, turmaId);

    try {
      const turma = await fetchTurmaDetailed(prisma, turmaId);

      // ✅ Otimização: Adicionar contagem de inscrições ativas com fallback seguro
      let inscricoesCount = 0;
      try {
        const inscricoesCountMap = await countInscricoesAtivasPorTurma([turmaId]);
        inscricoesCount = inscricoesCountMap[turmaId] || 0;
      } catch (error) {
        turmasLogger.warn(
          { error: error instanceof Error ? error.message : String(error), turmaId },
          '⚠️ Erro ao calcular contagem de inscrições, usando 0 como fallback',
        );
      }

      return {
        ...turma,
        inscricoesCount: inscricoesCount ?? 0,
        vagasOcupadas: inscricoesCount ?? 0,
        vagasDisponiveisCalculadas: (turma.vagasTotais ?? 0) - (inscricoesCount ?? 0),
      };
    } catch (error: any) {
      turmasLogger.error(
        { error: error?.message, stack: error?.stack, cursoId, turmaId },
        '🔥 Erro ao buscar detalhes da turma',
      );
      throw error;
    }
  },

  async listInscricoes(cursoId: string, turmaId: string) {
    await ensureTurmaBelongsToCurso(cursoId, turmaId);

    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: { turmaId },
      include: {
        Usuarios: {
          select: {
            id: true,
            codUsuario: true,
            nomeCompleto: true,
            email: true,
            UsuariosInformation: {
              select: { inscricao: true, telefone: true },
            },
            UsuariosEnderecos: {
              select: {
                logradouro: true,
                numero: true,
                bairro: true,
                cidade: true,
                estado: true,
                cep: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    // Log para debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      turmasLogger.debug(
        {
          cursoId,
          turmaId,
          totalInscricoes: inscricoes.length,
          comUsuario: inscricoes.filter((i) => i.Usuarios).length,
        },
        '📋 Listando inscrições da turma',
      );
    }

    const mapped = inscricoes
      .filter((inscricao) => inscricao.Usuarios) // Filtrar apenas inscrições com aluno válido
      .map((inscricao) => {
        const aluno = inscricao.Usuarios!; // Já verificamos que não é null acima
        const endereco = aluno?.UsuariosEnderecos?.[0];

        return {
          id: inscricao.id,
          alunoId: inscricao.alunoId,
          turmaId: inscricao.turmaId,
          status: inscricao.status,
          criadoEm: inscricao.criadoEm?.toISOString() ?? null,
          aluno: {
            id: aluno.id,
            nome: aluno.nomeCompleto,
            email: aluno.email,
            codigo: aluno.codUsuario,
            inscricao: aluno.UsuariosInformation?.inscricao ?? aluno.codUsuario ?? null,
            telefone: aluno.UsuariosInformation?.telefone ?? null,
            endereco: endereco
              ? {
                  logradouro: endereco.logradouro ?? null,
                  numero: endereco.numero ?? null,
                  bairro: endereco.bairro ?? null,
                  cidade: endereco.cidade ?? null,
                  estado: endereco.estado ?? null,
                  cep: endereco.cep ?? null,
                }
              : null,
          },
        };
      });

    return mapped;
  },

  async create(
    cursoId: string,
    data: {
      nome: string;
      turno?: CursosTurnos;
      metodo?: CursosMetodos;
      dataInicio?: Date | null;
      dataFim?: Date | null;
      dataInscricaoInicio?: Date | null;
      dataInscricaoFim?: Date | null;
      vagasTotais: number;
      vagasDisponiveis?: number;
      status?: CursoStatus;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const curso = await tx.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
      if (!curso) {
        const error = new Error('Curso não encontrado');
        (error as any).code = 'CURSO_NOT_FOUND';
        throw error;
      }

      const vagasDisponiveis =
        data.vagasDisponiveis !== undefined
          ? Math.min(data.vagasDisponiveis, data.vagasTotais)
          : data.vagasTotais;

      const codigo = await generateUniqueTurmaCode(tx, turmasLogger);

      const created = await tx.cursosTurmas.create({
        data: {
          cursoId,
          nome: data.nome,
          codigo,
          turno: data.turno ?? CursosTurnos.INTEGRAL,
          metodo: data.metodo ?? CursosMetodos.ONLINE,
          dataInicio: data.dataInicio ?? null,
          dataFim: data.dataFim ?? null,
          dataInscricaoInicio: data.dataInscricaoInicio ?? null,
          dataInscricaoFim: data.dataInscricaoFim ?? null,
          vagasTotais: data.vagasTotais,
          vagasDisponiveis,
          status: data.status ?? CursoStatus.PUBLICADO,
        },
      });

      return fetchTurmaDetailed(tx, created.id);
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    data: Partial<{
      nome: string;
      turno?: CursosTurnos;
      metodo?: CursosMetodos;
      dataInicio?: Date | null;
      dataFim?: Date | null;
      dataInscricaoInicio?: Date | null;
      dataInscricaoFim?: Date | null;
      vagasTotais: number;
      vagasDisponiveis?: number;
      status?: CursoStatus;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          cursoId: true,
          vagasTotais: true,
          vagasDisponiveis: true,
          CursosTurmasInscricoes: { select: { id: true } },
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const inscricoesAtivas = turma.CursosTurmasInscricoes.length;
      const vagasTotais = data.vagasTotais ?? turma.vagasTotais;

      if (vagasTotais < inscricoesAtivas) {
        const error = new Error('Vagas totais não podem ser menores que inscrições ativas');
        (error as any).code = 'INVALID_VAGAS_TOTAIS';
        throw error;
      }

      const minimoDisponiveis = vagasTotais - inscricoesAtivas;
      let vagasDisponiveis =
        data.vagasDisponiveis !== undefined
          ? Math.min(data.vagasDisponiveis, vagasTotais)
          : data.vagasTotais !== undefined
            ? minimoDisponiveis
            : turma.vagasDisponiveis;

      if (vagasDisponiveis < minimoDisponiveis) {
        vagasDisponiveis = minimoDisponiveis;
      }

      await tx.cursosTurmas.update({
        where: { id: turmaId },
        data: {
          nome: data.nome,
          turno: data.turno,
          metodo: data.metodo,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          dataInscricaoInicio: data.dataInscricaoInicio,
          dataInscricaoFim: data.dataInscricaoFim,
          vagasTotais,
          vagasDisponiveis,
          status: data.status,
        },
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },

  async enroll(
    cursoId: string,
    turmaId: string,
    alunoId: string,
    actor?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          cursoId: true,
          vagasDisponiveis: true,
          vagasTotais: true,
          dataInscricaoFim: true,
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const agora = new Date();
      if (turma.dataInscricaoFim && turma.dataInscricaoFim < agora) {
        const canOverrideDeadline = actor?.role === Roles.ADMIN || actor?.role === Roles.MODERADOR;

        if (canOverrideDeadline) {
          turmasLogger.info(
            {
              turmaId,
              cursoId,
              actorId: actor?.id ?? null,
              actorRole: actor?.role ?? null,
            },
            'Inscrição criada após o encerramento do período por usuário privilegiado',
          );
        }

        if (!canOverrideDeadline) {
          const error = new Error('Período de inscrição encerrado para esta turma');
          (error as any).code = 'INSCRICOES_ENCERRADAS';
          throw error;
        }
      }

      // Verificar vagas disponíveis - ADMIN/MODERADOR podem ignorar
      if (turma.vagasDisponiveis <= 0) {
        const canOverrideVagas = actor?.role === Roles.ADMIN || actor?.role === Roles.MODERADOR;

        if (canOverrideVagas) {
          turmasLogger.info(
            {
              turmaId,
              cursoId,
              actorId: actor?.id ?? null,
              actorRole: actor?.role ?? null,
              vagasDisponiveis: turma.vagasDisponiveis,
            },
            'Inscrição criada apesar da turma estar cheia por usuário privilegiado',
          );
        } else {
          const error = new Error('Não há vagas disponíveis nesta turma');
          (error as any).code = 'SEM_VAGAS';
          throw error;
        }
      }

      const aluno = await tx.usuarios.findUnique({
        where: { id: alunoId },
        select: {
          id: true,
          role: true,
          UsuariosInformation: { select: { inscricao: true } },
        },
      });

      if (!aluno) {
        const error = new Error('Aluno não encontrado');
        (error as any).code = 'ALUNO_NOT_FOUND';
        throw error;
      }

      if (aluno.role !== Roles.ALUNO_CANDIDATO) {
        const error = new Error('Usuário informado não possui perfil de aluno candidato');
        (error as any).code = 'ALUNO_INVALID_ROLE';
        throw error;
      }

      const inscricaoExistente = await tx.cursosTurmasInscricoes.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (inscricaoExistente) {
        const error = new Error('Aluno já está inscrito nesta turma');
        (error as any).code = 'ALUNO_JA_INSCRITO';
        throw error;
      }

      const informacoes = await tx.usuariosInformation.findUnique({
        where: { usuarioId: alunoId },
        select: { inscricao: true },
      });

      if (!informacoes) {
        const error = new Error('Informações do usuário não encontradas para geração de inscrição');
        (error as any).code = 'ALUNO_INFORMATION_NOT_FOUND';
        throw error;
      }

      let inscricaoCodigo = informacoes.inscricao;
      if (!inscricaoCodigo) {
        inscricaoCodigo = await generateUniqueInscricaoCode(tx, turmasLogger);
        await tx.usuariosInformation.update({
          where: { usuarioId: alunoId },
          data: { inscricao: inscricaoCodigo },
        });
      }

      await tx.cursosTurmasInscricoes.create({
        data: {
          turmaId,
          alunoId,
        },
      });

      // Atualizar vagas disponíveis
      // Se turma estava cheia e ADMIN/MODERADOR inscreveu, vagasDisponiveis ficará negativo (indica overflow)
      await tx.cursosTurmas.update({
        where: { id: turmaId },
        data: {
          vagasDisponiveis: turma.vagasDisponiveis - 1,
        },
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },

  async updateInscricaoStatus(
    cursoId: string,
    turmaId: string,
    inscricaoId: string,
    status: StatusInscricao,
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(cursoId, turmaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: {
          id: inscricaoId,
          turmaId,
        },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              UsuariosInformation: {
                select: { inscricao: true, telefone: true },
              },
              UsuariosEnderecos: {
                select: {
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!inscricao) {
        const error = new Error('Inscrição não encontrada para a turma informada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const inscricaoAtualizada = await tx.cursosTurmasInscricoes.update({
        where: { id: inscricaoId },
        data: {
          status,
        },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              UsuariosInformation: {
                select: { inscricao: true, telefone: true },
              },
              UsuariosEnderecos: {
                select: {
                  logradouro: true,
                  numero: true,
                  bairro: true,
                  cidade: true,
                  estado: true,
                  cep: true,
                },
                take: 1,
              },
            },
          },
        },
      });

      turmasLogger.info(
        { cursoId, turmaId, inscricaoId, statusAntigo: inscricao.status, statusNovo: status },
        '✅ Status da inscrição atualizado',
      );

      const aluno = inscricaoAtualizada.Usuarios;
      const endereco = aluno?.UsuariosEnderecos?.[0];

      return {
        id: inscricaoAtualizada.id,
        alunoId: inscricaoAtualizada.alunoId,
        turmaId: inscricaoAtualizada.turmaId,
        status: inscricaoAtualizada.status,
        criadoEm: inscricaoAtualizada.criadoEm?.toISOString() ?? null,
        aluno: {
          id: aluno.id,
          nome: aluno.nomeCompleto,
          email: aluno.email,
          inscricao: aluno.UsuariosInformation?.inscricao ?? null,
          telefone: aluno.UsuariosInformation?.telefone ?? null,
          endereco: endereco
            ? {
                logradouro: endereco.logradouro ?? null,
                numero: endereco.numero ?? null,
                bairro: endereco.bairro ?? null,
                cidade: endereco.cidade ?? null,
                estado: endereco.estado ?? null,
                cep: endereco.cep ?? null,
              }
            : null,
        },
      };
    });
  },

  async unenroll(cursoId: string, turmaId: string, alunoId: string) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: { id: true, cursoId: true, vagasDisponiveis: true, vagasTotais: true },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const inscricao = await tx.cursosTurmasInscricoes.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (!inscricao) {
        const error = new Error('Aluno não está inscrito nesta turma');
        (error as any).code = 'ALUNO_NAO_INSCRITO';
        throw error;
      }

      await tx.cursosTurmasInscricoes.delete({
        where: { turmaId_alunoId: { turmaId, alunoId } },
      });

      const novasVagasDisponiveis = Math.min(turma.vagasDisponiveis + 1, turma.vagasTotais);

      await tx.cursosTurmas.update({
        where: { id: turmaId },
        data: {
          vagasDisponiveis: novasVagasDisponiveis,
        },
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },
};

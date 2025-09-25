import { CursoStatus, CursosMetodos, CursosTurnos, Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueInscricaoCode, generateUniqueTurmaCode } from '../utils/code-generator';
import { aulaWithMateriaisInclude } from './aulas.mapper';
import { moduloDetailedInclude } from './modulos.mapper';
import { provaDefaultInclude } from './provas.mapper';
import { cursosTurmasMapper } from './cursos.service';

const turmasLogger = logger.child({ module: 'CursosTurmasService' });

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
    inscricoes: {
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            informacoes: {
              select: { inscricao: true, telefone: true },
            },
            enderecos: {
              select: {
                logradouro: true,
                numero: true,
                bairro: true,
                cidade: true,
                estado: true,
                cep: true,
              },
              orderBy: { atualizadoEm: 'desc' },
              take: 1,
            },
          },
        },
      },
    },
    aulas: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: aulaWithMateriaisInclude.include,
    },
    modulos: {
      ...moduloDetailedInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    provas: {
      ...provaDefaultInclude.include,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    },
    regrasAvaliacao: { select: regrasAvaliacaoSelect },
  },
});

const ensureCursoExists = async (cursoId: number) => {
  const curso = await prisma.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
  if (!curso) {
    const error = new Error('Curso não encontrado');
    (error as any).code = 'CURSO_NOT_FOUND';
    throw error;
  }
};

const ensureTurmaBelongsToCurso = async (cursoId: number, turmaId: string) => {
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

export const turmasService = {
  async list(cursoId: number) {
    await ensureCursoExists(cursoId);

    const turmas = await prisma.cursosTurmas.findMany({
      where: { cursoId },
      select: turmaSummarySelect,
      orderBy: { criadoEm: 'desc' },
    });

    return turmas.map(cursosTurmasMapper.summary);
  },

  async get(cursoId: number, turmaId: string) {
    await ensureTurmaBelongsToCurso(cursoId, turmaId);

    return fetchTurmaDetailed(prisma, turmaId);
  },

  async create(
    cursoId: number,
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
    cursoId: number,
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
          inscricoes: { select: { id: true } },
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const inscricoesAtivas = turma.inscricoes.length;
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
    cursoId: number,
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

      if (turma.vagasDisponiveis <= 0) {
        const error = new Error('Não há vagas disponíveis nesta turma');
        (error as any).code = 'SEM_VAGAS';
        throw error;
      }

      const aluno = await tx.usuarios.findUnique({
        where: { id: alunoId },
        select: {
          id: true,
          role: true,
          informacoes: { select: { inscricao: true } },
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

      await tx.cursosTurmas.update({
        where: { id: turmaId },
        data: {
          vagasDisponiveis: turma.vagasDisponiveis - 1,
        },
      });

      return fetchTurmaDetailed(tx, turmaId);
    });
  },

  async unenroll(cursoId: number, turmaId: string, alunoId: string) {
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

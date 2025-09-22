import { CursoStatus, Prisma, Roles } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import {
  generateUniqueEnrollmentCode,
  generateUniqueTurmaCode,
} from '../utils/code-generator';
import { cursosTurmasMapper } from './cursos.service';

const turmasLogger = logger.child({ module: 'CursosTurmasService' });

const turmaSummarySelect = {
  id: true,
  codigo: true,
  nome: true,
  status: true,
  vagasTotais: true,
  vagasDisponiveis: true,
  dataInicio: true,
  dataFim: true,
  dataInscricaoInicio: true,
  dataInscricaoFim: true,
} as const;

const turmaDetailedInclude = {
  include: {
    curso: {
      select: {
        id: true,
        codigo: true,
        nome: true,
      },
    },
    matriculas: {
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            informacoes: {
              select: { matricula: true },
            },
          },
        },
      },
    },
  },
} as const;

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
        data.vagasDisponiveis !== undefined ? Math.min(data.vagasDisponiveis, data.vagasTotais) : data.vagasTotais;

      const codigo = await generateUniqueTurmaCode(tx, turmasLogger);

      const created = await tx.cursosTurmas.create({
        data: {
          cursoId,
          nome: data.nome,
          codigo,
          dataInicio: data.dataInicio ?? null,
          dataFim: data.dataFim ?? null,
          dataInscricaoInicio: data.dataInscricaoInicio ?? null,
          dataInscricaoFim: data.dataInscricaoFim ?? null,
          vagasTotais: data.vagasTotais,
          vagasDisponiveis,
          status: data.status ?? CursoStatus.RASCUNHO,
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
          matriculas: { select: { id: true } },
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      const matriculasAtivas = turma.matriculas.length;
      const vagasTotais = data.vagasTotais ?? turma.vagasTotais;

      if (vagasTotais < matriculasAtivas) {
        const error = new Error('Vagas totais não podem ser menores que matrículas ativas');
        (error as any).code = 'INVALID_VAGAS_TOTAIS';
        throw error;
      }

      const minimoDisponiveis = vagasTotais - matriculasAtivas;
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

  async enroll(cursoId: number, turmaId: string, alunoId: string) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          cursoId: true,
          vagasDisponiveis: true,
          vagasTotais: true,
        },
      });

      if (!turma || turma.cursoId !== cursoId) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
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
          informacoes: { select: { matricula: true } },
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

      const matriculaExistente = await tx.cursosTurmasMatriculas.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (matriculaExistente) {
        const error = new Error('Aluno já está matriculado nesta turma');
        (error as any).code = 'ALUNO_JA_MATRICULADO';
        throw error;
      }

      const informacoes = await tx.usuariosInformation.findUnique({
        where: { usuarioId: alunoId },
        select: { matricula: true },
      });

      if (!informacoes) {
        const error = new Error('Informações do usuário não encontradas para geração de matrícula');
        (error as any).code = 'ALUNO_INFORMATION_NOT_FOUND';
        throw error;
      }

      let matriculaCodigo = informacoes.matricula;
      if (!matriculaCodigo) {
        matriculaCodigo = await generateUniqueEnrollmentCode(tx, turmasLogger);
        await tx.usuariosInformation.update({
          where: { usuarioId: alunoId },
          data: { matricula: matriculaCodigo },
        });
      }

      await tx.cursosTurmasMatriculas.create({
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

      const matricula = await tx.cursosTurmasMatriculas.findUnique({
        where: { turmaId_alunoId: { turmaId, alunoId } },
        select: { id: true },
      });

      if (!matricula) {
        const error = new Error('Aluno não está matriculado nesta turma');
        (error as any).code = 'ALUNO_NAO_MATRICULADO';
        throw error;
      }

      await tx.cursosTurmasMatriculas.delete({
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

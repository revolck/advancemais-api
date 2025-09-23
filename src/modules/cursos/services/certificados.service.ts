import {
  CursosCertificados,
  CursosCertificadosLogAcao,
  CursosCertificadosTipos,
  CursosEstagioStatus,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import { generateUniqueCertificateCode } from '../utils/code-generator';
import { certificadoWithRelations, mapCertificado } from './certificados.mapper';

const certificadosLogger = logger.child({ module: 'CursosCertificadosService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

type EmitirCertificadoData = {
  matriculaId: string;
  tipo: CursosCertificados;
  formato: CursosCertificadosTipos;
  cargaHoraria?: number | null;
  assinaturaUrl?: string | null;
  observacoes?: string | null;
};

type ListCertificadosFilters = {
  matriculaId?: string;
  tipo?: CursosCertificados;
  formato?: CursosCertificadosTipos;
};

const ensureTurmaBelongsToCurso = async (client: PrismaClientOrTx, cursoId: number, turmaId: string) => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureMatriculaBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  matriculaId: string,
) => {
  const matricula = await client.cursosTurmasMatriculas.findFirst({
    where: { id: matriculaId, turmaId },
    select: { id: true },
  });

  if (!matricula) {
    const error = new Error('Matrícula não encontrada para a turma informada');
    (error as any).code = 'MATRICULA_NOT_FOUND';
    throw error;
  }
};

export const certificadosService = {
  async emitir(
    cursoId: number,
    turmaId: string,
    data: EmitirCertificadoData,
    emitidoPorId?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);
      await ensureMatriculaBelongsToTurma(tx, turmaId, data.matriculaId);

      const matricula = await tx.cursosTurmasMatriculas.findFirst({
        where: { id: data.matriculaId },
        include: {
          aluno: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
            },
          },
          turma: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              curso: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  estagioObrigatorio: true,
                  cargaHoraria: true,
                },
              },
            },
          },
        },
      });

      if (!matricula) {
        const error = new Error('Matrícula não encontrada');
        (error as any).code = 'MATRICULA_NOT_FOUND';
        throw error;
      }

      if (matricula.turma.curso.estagioObrigatorio) {
        const estagioConcluido = await tx.cursosEstagios.findFirst({
          where: {
            matriculaId: data.matriculaId,
            status: CursosEstagioStatus.CONCLUIDO,
          },
          select: { id: true },
        });

        if (!estagioConcluido) {
          const error = new Error('Estágio obrigatório ainda não concluído');
          (error as any).code = 'ESTAGIO_NAO_CONCLUIDO';
          throw error;
        }
      }

      const cargaHoraria = data.cargaHoraria ?? matricula.turma.curso.cargaHoraria ?? 0;
      if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
        const error = new Error('Carga horária inválida para o certificado');
        (error as any).code = 'INVALID_CARGA_HORARIA';
        throw error;
      }

      const codigo = await generateUniqueCertificateCode(tx, certificadosLogger);

      const certificado = await tx.cursosCertificadosEmitidos.create({
        data: {
          matriculaId: data.matriculaId,
          codigo,
          tipo: data.tipo,
          formato: data.formato,
          cargaHoraria,
          assinaturaUrl: data.assinaturaUrl ?? null,
          alunoNome: matricula.aluno.nomeCompleto,
          alunoCpf: matricula.aluno.cpf,
          cursoNome: matricula.turma.curso.nome,
          turmaNome: matricula.turma.nome,
          emitidoPorId: emitidoPorId ?? null,
          observacoes: data.observacoes ?? null,
          logs: {
            create: {
              acao: CursosCertificadosLogAcao.EMISSAO,
              formato: data.formato,
              detalhes: emitidoPorId ? `Emitido por usuário ${emitidoPorId}` : null,
            },
          },
        },
        ...certificadoWithRelations,
      });

      certificadosLogger.info(
        { certificadoId: certificado.id, matriculaId: data.matriculaId, turmaId },
        'Certificado emitido com sucesso',
      );

      return mapCertificado(certificado);
    });
  },

  async listar(cursoId: number, turmaId: string, filtros: ListCertificadosFilters = {}) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: {
        matricula: {
          turmaId,
          turma: { cursoId },
        },
        ...(filtros.matriculaId ? { matriculaId: filtros.matriculaId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.formato ? { formato: filtros.formato } : {}),
      },
      orderBy: { emitidoEm: 'desc' },
      ...certificadoWithRelations,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async listarPorMatricula(
    matriculaId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const matricula = await prisma.cursosTurmasMatriculas.findUnique({
      where: { id: matriculaId },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            informacoes: {
              select: { matricula: true },
            },
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            curso: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                cargaHoraria: true,
              },
            },
          },
        },
      },
    });

    if (!matricula) {
      const error = new Error('Matrícula não encontrada');
      (error as any).code = 'MATRICULA_NOT_FOUND';
      throw error;
    }

    if (requesterId && matricula.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { matriculaId },
      orderBy: { emitidoEm: 'desc' },
      ...certificadoWithRelations,
    });

    return {
      matricula: {
        id: matricula.id,
        aluno: {
          id: matricula.aluno.id,
          nome: matricula.aluno.nomeCompleto,
          email: matricula.aluno.email,
          cpf: matricula.aluno.cpf,
          matricula: matricula.aluno.informacoes?.matricula ?? null,
        },
      },
      curso: {
        id: matricula.turma.curso.id,
        nome: matricula.turma.curso.nome,
        codigo: matricula.turma.curso.codigo,
        cargaHoraria: matricula.turma.curso.cargaHoraria,
      },
      turma: {
        id: matricula.turma.id,
        nome: matricula.turma.nome,
        codigo: matricula.turma.codigo,
      },
      certificados: certificados.map((item) => mapCertificado(item)),
    } as const;
  },

  async listarDoAluno(usuarioId: string) {
    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { matricula: { alunoId: usuarioId } },
      orderBy: { emitidoEm: 'desc' },
      ...certificadoWithRelations,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async verificarPorCodigo(codigo: string) {
    return prisma.$transaction(async (tx) => {
      const certificado = await tx.cursosCertificadosEmitidos.findUnique({
        where: { codigo },
        ...certificadoWithRelations,
      });

      if (!certificado) {
        return null;
      }

      await tx.cursosCertificadosLogs.create({
        data: {
          certificadoId: certificado.id,
          acao: CursosCertificadosLogAcao.VISUALIZACAO,
          formato: CursosCertificadosTipos.VERIFICAVEL,
          detalhes: 'Consulta por código do certificado',
        },
      });

      certificadosLogger.info({ codigo }, 'Certificado consultado por código');

      return mapCertificado(certificado, { maskCpf: true, includeLogs: false });
    });
  },
};

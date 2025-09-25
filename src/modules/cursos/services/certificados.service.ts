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
  inscricaoId: string;
  tipo: CursosCertificados;
  formato: CursosCertificadosTipos;
  cargaHoraria?: number | null;
  assinaturaUrl?: string | null;
  observacoes?: string | null;
};

type ListCertificadosFilters = {
  inscricaoId?: string;
  tipo?: CursosCertificados;
  formato?: CursosCertificadosTipos;
};

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: number,
  turmaId: string,
) => {
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

const ensureInscricaoBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  inscricaoId: string,
) => {
  const inscricao = await client.cursosTurmasInscricoes.findFirst({
    where: { id: inscricaoId, turmaId },
    select: { id: true },
  });

  if (!inscricao) {
    const error = new Error('Inscrição não encontrada para a turma informada');
    (error as any).code = 'INSCRICAO_NOT_FOUND';
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
      await ensureInscricaoBelongsToTurma(tx, turmaId, data.inscricaoId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: { id: data.inscricaoId },
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

      if (!inscricao) {
        const error = new Error('Inscrição não encontrada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      if (inscricao.turma.curso.estagioObrigatorio) {
        const estagioConcluido = await tx.cursosEstagios.findFirst({
          where: {
            inscricaoId: data.inscricaoId,
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

      const cargaHoraria = data.cargaHoraria ?? inscricao.turma.curso.cargaHoraria ?? 0;
      if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0) {
        const error = new Error('Carga horária inválida para o certificado');
        (error as any).code = 'INVALID_CARGA_HORARIA';
        throw error;
      }

      const codigo = await generateUniqueCertificateCode(tx, certificadosLogger);

      const certificado = await tx.cursosCertificadosEmitidos.create({
        data: {
          inscricaoId: data.inscricaoId,
          codigo,
          tipo: data.tipo,
          formato: data.formato,
          cargaHoraria,
          assinaturaUrl: data.assinaturaUrl ?? null,
          alunoNome: inscricao.aluno.nomeCompleto,
          alunoCpf: inscricao.aluno.cpf,
          cursoNome: inscricao.turma.curso.nome,
          turmaNome: inscricao.turma.nome,
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
        { certificadoId: certificado.id, inscricaoId: data.inscricaoId, turmaId },
        'Certificado emitido com sucesso',
      );

      return mapCertificado(certificado);
    });
  },

  async listar(cursoId: number, turmaId: string, filtros: ListCertificadosFilters = {}) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: {
        inscricao: {
          turmaId,
          turma: { cursoId },
        },
        ...(filtros.inscricaoId ? { inscricaoId: filtros.inscricaoId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.formato ? { formato: filtros.formato } : {}),
      },
      orderBy: { emitidoEm: 'desc' },
      ...certificadoWithRelations,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async listarPorInscricao(
    inscricaoId: string,
    requesterId?: string,
    { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
  ) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            informacoes: {
              select: { inscricao: true },
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

    if (!inscricao) {
      const error = new Error('Inscrição não encontrada');
      (error as any).code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    if (requesterId && inscricao.alunoId !== requesterId && !permitirAdmin) {
      const error = new Error('Acesso negado');
      (error as any).code = 'FORBIDDEN';
      throw error;
    }

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { inscricaoId },
      orderBy: { emitidoEm: 'desc' },
      ...certificadoWithRelations,
    });

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.aluno.id,
          nome: inscricao.aluno.nomeCompleto,
          email: inscricao.aluno.email,
          cpf: inscricao.aluno.cpf,
          inscricao: inscricao.aluno.informacoes?.inscricao ?? null,
        },
      },
      curso: {
        id: inscricao.turma.curso.id,
        nome: inscricao.turma.curso.nome,
        codigo: inscricao.turma.curso.codigo,
        cargaHoraria: inscricao.turma.curso.cargaHoraria,
      },
      turma: {
        id: inscricao.turma.id,
        nome: inscricao.turma.nome,
        codigo: inscricao.turma.codigo,
      },
      certificados: certificados.map((item) => mapCertificado(item)),
    } as const;
  },

  async listarDoAluno(usuarioId: string) {
    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { inscricao: { alunoId: usuarioId } },
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

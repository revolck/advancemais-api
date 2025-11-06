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
  cursoId: string,
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
    cursoId: string,
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
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
            },
          },
          CursosTurmas: {
            select: {
              id: true,
              nome: true,
              codigo: true,
              Cursos: {
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

      if (inscricao.CursosTurmas.Cursos.estagioObrigatorio) {
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

      const cargaHoraria = data.cargaHoraria ?? inscricao.CursosTurmas.Cursos.cargaHoraria ?? 0;
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
          alunoNome: inscricao.Usuarios.nomeCompleto,
          alunoCpf: inscricao.Usuarios.cpf,
          cursoNome: inscricao.CursosTurmas.Cursos.nome,
          turmaNome: inscricao.CursosTurmas.nome,
          emitidoPorId: emitidoPorId ?? null,
          observacoes: data.observacoes ?? null,
          CursosCertificadosLogs: {
            create: {
              acao: CursosCertificadosLogAcao.EMISSAO,
              formato: data.formato,
              detalhes: emitidoPorId ? `Emitido por usuário ${emitidoPorId}` : null,
            },
          },
        },
        include: certificadoWithRelations.include,
      });

      certificadosLogger.info(
        { certificadoId: certificado.id, inscricaoId: data.inscricaoId, turmaId },
        'Certificado emitido com sucesso',
      );

      const certificadoCompleto = await tx.cursosCertificadosEmitidos.findUniqueOrThrow({
        where: { id: certificado.id },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
            },
          },
          CursosTurmasInscricoes: {
            select: {
              id: true,
              Usuarios: {
                select: {
                  id: true,
                  nomeCompleto: true,
                  email: true,
                  cpf: true,
                  UsuariosInformation: {
                    select: {
                      inscricao: true,
                    },
                  },
                },
              },
              CursosTurmas: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  Cursos: {
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
          },
          CursosCertificadosLogs: {
            orderBy: { criadoEm: 'desc' },
          },
        },
      });
      return mapCertificado(certificadoCompleto);
    });
  },

  async listar(cursoId: string, turmaId: string, filtros: ListCertificadosFilters = {}) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: {
        CursosTurmasInscricoes: {
          turmaId,
          CursosTurmas: { cursoId },
        },
        ...(filtros.inscricaoId ? { inscricaoId: filtros.inscricaoId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.formato ? { formato: filtros.formato } : {}),
      },
      orderBy: { emitidoEm: 'desc' },
      include: certificadoWithRelations.include,
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
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            cpf: true,
            UsuariosInformation: {
              select: { inscricao: true },
            },
          },
        },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            Cursos: {
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
      include: certificadoWithRelations.include,
    });

    return {
      inscricao: {
        id: inscricao.id,
        aluno: {
          id: inscricao.Usuarios.id,
          nome: inscricao.Usuarios.nomeCompleto,
          email: inscricao.Usuarios.email,
          cpf: inscricao.Usuarios.cpf,
          inscricao: inscricao.Usuarios.UsuariosInformation?.inscricao ?? null,
        },
      },
      curso: {
        id: inscricao.CursosTurmas.Cursos.id,
        nome: inscricao.CursosTurmas.Cursos.nome,
        codigo: inscricao.CursosTurmas.Cursos.codigo,
        cargaHoraria: inscricao.CursosTurmas.Cursos.cargaHoraria,
      },
      turma: {
        id: inscricao.CursosTurmas.id,
        nome: inscricao.CursosTurmas.nome,
        codigo: inscricao.CursosTurmas.codigo,
      },
      certificados: certificados.map((item) => mapCertificado(item)),
    } as const;
  },

  async listarDoAluno(usuarioId: string) {
    const certificados = await prisma.cursosCertificadosEmitidos.findMany({
      where: { CursosTurmasInscricoes: { alunoId: usuarioId } },
      orderBy: { emitidoEm: 'desc' },
      include: certificadoWithRelations.include,
    });

    return certificados.map((item) => mapCertificado(item));
  },

  async verificarPorCodigo(codigo: string) {
    return prisma.$transaction(async (tx) => {
      const certificado = await tx.cursosCertificadosEmitidos.findUnique({
        where: { codigo },
        include: certificadoWithRelations.include,
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

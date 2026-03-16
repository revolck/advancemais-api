import {
  Prisma,
  CursosLocalProva,
  CursosNotasTipo,
  AuditoriaCategoria,
  CursosAulaStatus,
  CursoStatus,
  Roles,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { auditoriaService } from '@/modules/auditoria/services/auditoria.service';
import { notificacoesHelper } from '../aulas/services/notificacoes-helper.service';

import {
  mapProva,
  provaDefaultInclude,
  provaWithEnviosInclude,
  provaWithEnviosAndQuestoesInclude,
} from './provas.mapper';

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const provasLogger = logger.child({ module: 'CursosProvasService' });

const turmaJaFoiIniciada = (turma: {
  status?: CursoStatus | null;
  dataInicio?: Date | null;
  dataFim?: Date | null;
}) => {
  const agora = new Date();
  return (
    turma.status === CursoStatus.EM_ANDAMENTO ||
    turma.status === CursoStatus.CONCLUIDO ||
    Boolean(turma.dataInicio && turma.dataInicio <= agora) ||
    Boolean(turma.dataFim && turma.dataFim < agora)
  );
};

const buildInstrutorTurmaProvasWhere = (usuarioId: string): Prisma.CursosTurmasWhereInput => ({
  OR: [
    {
      CursosTurmasProvas: {
        some: {
          instrutorId: usuarioId,
        },
      },
    },
    {
      CursosTurmasAulas: {
        some: {
          instrutorId: usuarioId,
          deletedAt: null,
        },
      },
    },
  ],
});

const ensureInstrutorPodeAcessarTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  usuarioId: string,
) => {
  const turma = await client.cursosTurmas.findFirst({
    where: {
      id: turmaId,
      cursoId,
      ...buildInstrutorTurmaProvasWhere(usuarioId),
    },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Instrutor só pode acessar provas de turmas vinculadas a ele');
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
};

const ensureInstrutorPodeAcessarProva = async (
  client: PrismaClientOrTx,
  provaId: string,
  usuarioId: string,
) => {
  const prova = await client.cursosTurmasProvas.findUnique({
    where: { id: provaId },
    select: {
      id: true,
      instrutorId: true,
      CursosTurmas: {
        select: {
          instrutorId: true,
          CursosTurmasInstrutores: {
            where: { instrutorId: usuarioId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  const vinculado =
    prova.instrutorId === usuarioId ||
    (!prova.instrutorId &&
      (prova.CursosTurmas?.instrutorId === usuarioId ||
        (prova.CursosTurmas?.CursosTurmasInstrutores?.length ?? 0) > 0));

  if (!vinculado) {
    const error = new Error('Instrutor só pode acessar provas vinculadas a ele');
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
};

const ensureTurmaBelongsToCurso = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
): Promise<void> => {
  const turma = await client.cursosTurmas.findFirst({
    where: { id: turmaId, cursoId, deletedAt: null },
    select: { id: true },
  });

  if (!turma) {
    const error = new Error('Turma não encontrada para o curso informado');
    (error as any).code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureModuloBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  moduloId: string,
): Promise<void> => {
  const modulo = await client.cursosTurmasModulos.findFirst({
    where: { id: moduloId, turmaId },
    select: { id: true },
  });

  if (!modulo) {
    const error = new Error('Módulo não encontrado para a turma informada');
    (error as any).code = 'MODULO_NOT_FOUND';
    throw error;
  }
};

const ensureProvaBelongsToTurma = async (
  client: PrismaClientOrTx,
  cursoId: string,
  turmaId: string,
  provaId: string,
  options?: { forEdit?: boolean },
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId, CursosTurmas: { cursoId } },
    select: { id: true, status: true, turmaId: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  if (options?.forEdit && prova.turmaId && prova.status === CursosAulaStatus.PUBLICADA) {
    const error = new Error('Não é possível editar prova publicada vinculada a turma');
    (error as any).code = 'PROVA_PUBLICADA_LOCKED';
    throw error;
  }
};

const ensureProvaBelongsToTurmaIgnoringCurso = async (
  client: PrismaClientOrTx,
  turmaId: string,
  provaId: string,
): Promise<void> => {
  const prova = await client.cursosTurmasProvas.findFirst({
    where: { id: provaId, turmaId },
    select: { id: true },
  });

  if (!prova) {
    const error = new Error('Prova não encontrada para a turma informada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }
};

const fetchCriadorInfo = async (provaId: string) => {
  try {
    const auditoriaLog = await prisma.auditoriaLogs.findFirst({
      where: {
        entidadeId: provaId,
        entidadeTipo: 'PROVA',
        OR: [
          { acao: 'PROVA_CRIADA' },
          { acao: 'ATIVIDADE_CRIADA' },
          { acao: 'CRIACAO' },
          { tipo: 'PROVA_CRIACAO' },
          { tipo: 'ATIVIDADE_CRIACAO' },
        ],
      },
      orderBy: { criadoEm: 'asc' },
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            cpf: true,
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (auditoriaLog?.Usuarios) {
      return {
        nome: auditoriaLog.Usuarios.nomeCompleto,
        avatarUrl: auditoriaLog.Usuarios.UsuariosInformation?.avatarUrl ?? null,
        cpf: auditoriaLog.Usuarios.cpf ?? null,
      };
    }
  } catch (error) {
    provasLogger.warn({ err: error, provaId }, 'Erro ao buscar informações do criador');
  }

  return null;
};

const fetchTemplate = async (client: PrismaClientOrTx, provaId: string) => {
  const prova = await client.cursosTurmasProvas.findUnique({
    where: { id: provaId },
    ...provaWithEnviosAndQuestoesInclude,
  });

  if (!prova || prova.turmaId) {
    const error = new Error('Template de prova não encontrado');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  const criadoPor = client === prisma ? await fetchCriadorInfo(provaId) : null;

  return mapProva(prova, criadoPor);
};

const fetchProva = async (client: PrismaClientOrTx, provaId: string) => {
  const prova = await client.cursosTurmasProvas.findUnique({
    where: { id: provaId },
    ...provaWithEnviosAndQuestoesInclude,
  });

  if (!prova) {
    const error = new Error('Prova não encontrada');
    (error as any).code = 'PROVA_NOT_FOUND';
    throw error;
  }

  // Buscar informações do criador (apenas se não estiver em transação)
  const criadoPor = client === prisma ? await fetchCriadorInfo(provaId) : null;

  return mapProva(prova, criadoPor);
};

const toDecimal = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }
  return new Prisma.Decimal(value);
};

const toDecimalOptional = (value: number | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Prisma.Decimal(value);
};

export const provasService = {
  async list(
    cursoId: string,
    turmaId: string,
    filters?: {
      search?: string;
      turmaId?: string;
      status?: 'ATIVO' | 'INATIVO';
      tipo?: 'PROVA' | 'ATIVIDADE';
    },
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    await ensureTurmaBelongsToCurso(prisma, cursoId, turmaId);

    const turmaIdFiltro = filters?.turmaId || turmaId;

    if (usuarioLogado?.role === Roles.INSTRUTOR) {
      if (!usuarioLogado.id) {
        const error = new Error('Instrutor sem contexto de autenticação válido');
        (error as any).code = 'FORBIDDEN';
        throw error;
      }

      await ensureInstrutorPodeAcessarTurma(prisma, cursoId, turmaIdFiltro, usuarioLogado.id);
    }

    // Construir where clause com filtros
    const where: Prisma.CursosTurmasProvasWhereInput = {
      turmaId: turmaIdFiltro,
    };

    // Filtro de busca por título
    if (filters?.search) {
      where.titulo = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    // Filtro de status
    if (filters?.status) {
      where.ativo = filters.status === 'ATIVO';
    }

    // Filtro de tipo (PROVA ou ATIVIDADE)
    if (filters?.tipo) {
      where.tipo = filters.tipo as any;
    }

    if (usuarioLogado?.role === Roles.INSTRUTOR && usuarioLogado.id) {
      where.OR = [
        { instrutorId: usuarioLogado.id },
        {
          instrutorId: null,
          CursosTurmas: {
            OR: [
              { instrutorId: usuarioLogado.id },
              { CursosTurmasInstrutores: { some: { instrutorId: usuarioLogado.id } } },
            ],
          },
        },
      ];
    }

    const provas = await prisma.cursosTurmasProvas.findMany({
      where,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      ...provaWithEnviosInclude,
    });

    // Buscar informações dos criadores em lote
    const provaIds = provas.map((p) => p.id);
    const auditoriaLogs = await prisma.auditoriaLogs.findMany({
      where: {
        entidadeId: { in: provaIds },
        entidadeTipo: 'PROVA',
        OR: [
          { acao: 'PROVA_CRIADA' },
          { acao: 'ATIVIDADE_CRIADA' },
          { acao: 'CRIACAO' },
          { tipo: 'PROVA_CRIACAO' },
          { tipo: 'ATIVIDADE_CRIACAO' },
        ],
      },
      include: {
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            cpf: true,
            UsuariosInformation: {
              select: {
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { criadoEm: 'asc' },
    });

    // Criar mapa de criadores por provaId
    const criadoresMap = new Map<
      string,
      { nome: string | null; avatarUrl: string | null; cpf: string | null }
    >();

    auditoriaLogs.forEach((log) => {
      if (log.Usuarios && !criadoresMap.has(log.entidadeId ?? '')) {
        criadoresMap.set(log.entidadeId ?? '', {
          nome: log.Usuarios.nomeCompleto,
          avatarUrl: log.Usuarios.UsuariosInformation?.avatarUrl ?? null,
          cpf: log.Usuarios.cpf ?? null,
        });
      }
    });

    return provas.map((prova) => {
      const criadoPor = criadoresMap.get(prova.id) ?? null;
      return mapProva(prova, criadoPor);
    });
  },

  async get(
    cursoId: string,
    turmaId: string,
    provaId: string,
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    await ensureProvaBelongsToTurma(prisma, cursoId, turmaId, provaId);

    if (usuarioLogado?.role === Roles.INSTRUTOR) {
      if (!usuarioLogado.id) {
        const error = new Error('Instrutor sem contexto de autenticação válido');
        (error as any).code = 'FORBIDDEN';
        throw error;
      }

      await ensureInstrutorPodeAcessarProva(prisma, provaId, usuarioLogado.id);
    }

    return fetchProva(prisma, provaId);
  },

  async getByTurma(
    turmaId: string,
    provaId: string,
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    await ensureProvaBelongsToTurmaIgnoringCurso(prisma, turmaId, provaId);

    if (usuarioLogado?.role === Roles.INSTRUTOR) {
      if (!usuarioLogado.id) {
        const error = new Error('Instrutor sem contexto de autenticação válido');
        (error as any).code = 'FORBIDDEN';
        throw error;
      }

      await ensureInstrutorPodeAcessarProva(prisma, provaId, usuarioLogado.id);
    }

    return fetchProva(prisma, provaId);
  },

  async getCursoIdByTurma(turmaId: string) {
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: turmaId },
      select: { cursoId: true },
    });

    if (!turma) {
      const error = new Error('Turma não encontrada');
      (error as any).code = 'TURMA_NOT_FOUND';
      throw error;
    }

    return turma.cursoId;
  },

  async getTemplateForCurso(cursoId: string, provaId: string) {
    let template: Awaited<ReturnType<typeof fetchTemplate>>;
    try {
      template = await fetchTemplate(prisma, provaId);
    } catch (error: any) {
      if (error?.code === 'AVALIACAO_NOT_FOUND' || error?.code === 'PROVA_NOT_FOUND') {
        const notFoundError = new Error('Prova não encontrada para o curso informado');
        (notFoundError as any).code = 'PROVA_NOT_FOUND';
        throw notFoundError;
      }
      throw error;
    }

    if (template.cursoId && template.cursoId !== cursoId) {
      const error = new Error('Prova não encontrada para o curso informado');
      (error as any).code = 'PROVA_NOT_FOUND';
      throw error;
    }

    return template;
  },

  async create(
    cursoId: string,
    turmaId: string,
    data: {
      titulo: string;
      etiqueta: string;
      descricao?: string | null;
      peso: number;
      valePonto?: boolean;
      moduloId?: string | null;
      ativo?: boolean;
      ordem?: number | null;
      tipo?: 'PROVA' | 'ATIVIDADE';
    },
    criadoPor?: string,
    ip?: string,
    userAgent?: string,
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      const turma = await tx.cursosTurmas.findFirst({
        where: { id: turmaId, cursoId, deletedAt: null },
        select: {
          id: true,
          status: true,
          dataInicio: true,
          dataFim: true,
          instrutorId: true,
          CursosTurmasInstrutores: {
            where: usuarioLogado?.id ? { instrutorId: usuarioLogado.id } : undefined,
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!turma) {
        const error = new Error('Turma não encontrada para o curso informado');
        (error as any).code = 'TURMA_NOT_FOUND';
        throw error;
      }

      if (usuarioLogado?.role === Roles.INSTRUTOR) {
        if (!usuarioLogado.id) {
          const error = new Error('Instrutor sem contexto de autenticação válido');
          (error as any).code = 'FORBIDDEN';
          throw error;
        }

        const vinculado =
          turma.instrutorId === usuarioLogado.id ||
          (turma.CursosTurmasInstrutores?.length ?? 0) > 0;

        if (!vinculado) {
          const error = new Error('Você não está vinculado a esta turma');
          (error as any).code = 'FORBIDDEN';
          throw error;
        }

        if (turmaJaFoiIniciada(turma)) {
          const error: any = new Error(
            'Instrutor não pode criar prova ou atividade em turma já iniciada',
          );
          error.code = 'INSTRUTOR_NAO_PODE_CRIAR_CONTEUDO_EM_TURMA_INICIADA';
          throw error;
        }
      }

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      const ordem = data.ordem ?? (await tx.cursosTurmasProvas.count({ where: { turmaId } })) + 1;
      const tipo = data.tipo ?? 'PROVA';

      const prova = await tx.cursosTurmasProvas.create({
        data: {
          cursoId,
          turmaId,
          moduloId: data.moduloId ?? null,
          tipo: tipo as any,
          titulo: data.titulo,
          etiqueta: data.etiqueta,
          descricao: data.descricao ?? null,
          peso: new Prisma.Decimal(data.peso),
          valePonto: data.valePonto ?? true,
          ativo: data.ativo ?? true,
          ordem,
          localizacao: data.moduloId ? CursosLocalProva.MODULO : CursosLocalProva.TURMA,
        },
        ...provaDefaultInclude,
      });

      provasLogger.info({ turmaId, provaId: prova.id }, 'Prova criada com sucesso');

      // Registrar auditoria se houver usuário
      if (criadoPor) {
        try {
          await auditoriaService.registrarLog({
            categoria: AuditoriaCategoria.CURSO,
            tipo: tipo === 'ATIVIDADE' ? 'ATIVIDADE_CRIACAO' : 'PROVA_CRIACAO',
            acao: tipo === 'ATIVIDADE' ? 'ATIVIDADE_CRIADA' : 'PROVA_CRIADA',
            usuarioId: criadoPor,
            entidadeId: prova.id,
            entidadeTipo: 'PROVA',
            descricao: `${tipo === 'ATIVIDADE' ? 'Atividade' : 'Prova'} criada: ${data.titulo}`,
            dadosNovos: {
              titulo: data.titulo,
              etiqueta: data.etiqueta,
              tipo,
              peso: data.peso,
              valePonto: data.valePonto,
            },
            metadata: {
              cursoId,
              turmaId,
              provaId: prova.id,
              moduloId: data.moduloId,
            },
            ip,
            userAgent,
          });
        } catch (error) {
          provasLogger.warn(
            { err: error, provaId: prova.id },
            'Erro ao registrar auditoria de criação',
          );
        }
      }

      // Buscar informações do criador para retornar
      const criadoPorInfo = criadoPor ? await fetchCriadorInfo(prova.id) : null;

      if (usuarioLogado?.role === Roles.PEDAGOGICO && turmaJaFoiIniciada(turma)) {
        try {
          await notificacoesHelper.notificarAlunosDaTurma(turmaId, {
            tipo: 'SISTEMA',
            titulo:
              tipo === 'ATIVIDADE'
                ? `Nova atividade: ${data.titulo}`
                : `Nova prova: ${data.titulo}`,
            mensagem:
              tipo === 'ATIVIDADE'
                ? `Foi adicionada uma nova atividade na turma.`
                : `Foi adicionada uma nova prova na turma.`,
            prioridade: 'NORMAL',
            linkAcao: `/turmas/${turmaId}`,
            eventoId: prova.id,
          });
        } catch (error) {
          provasLogger.warn(
            { err: error, provaId: prova.id, turmaId },
            'Falha ao notificar alunos após criação pedagógica de prova/atividade',
          );
        }
      }

      return mapProva(prova, criadoPorInfo);
    });
  },

  async update(
    cursoId: string,
    turmaId: string,
    provaId: string,
    data: {
      titulo?: string;
      etiqueta?: string;
      descricao?: string | null;
      peso?: number;
      valePonto?: boolean;
      moduloId?: string | null;
      ativo?: boolean;
      ordem?: number | null;
    },
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId, { forEdit: true });

      if (usuarioLogado?.role === Roles.INSTRUTOR) {
        if (!usuarioLogado.id) {
          const error = new Error('Instrutor sem contexto de autenticação válido');
          (error as any).code = 'FORBIDDEN';
          throw error;
        }

        await ensureInstrutorPodeAcessarProva(tx, provaId, usuarioLogado.id);
      }

      if (data.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, data.moduloId);
      }

      await tx.cursosTurmasProvas.update({
        where: { id: provaId },
        data: {
          titulo: data.titulo ?? undefined,
          etiqueta: data.etiqueta ?? undefined,
          descricao: data.descricao ?? undefined,
          peso: data.peso !== undefined ? new Prisma.Decimal(data.peso) : undefined,
          valePonto: data.valePonto ?? undefined,
          moduloId: data.moduloId ?? (data.moduloId === null ? null : undefined),
          ativo: data.ativo ?? undefined,
          ordem: data.ordem ?? undefined,
          localizacao:
            data.moduloId !== undefined
              ? data.moduloId
                ? CursosLocalProva.MODULO
                : CursosLocalProva.TURMA
              : undefined,
        },
      });

      provasLogger.info({ turmaId, provaId }, 'Prova atualizada com sucesso');

      return fetchProva(tx, provaId);
    });
  },

  async remove(
    cursoId: string,
    turmaId: string,
    provaId: string,
    usuarioLogado?: { id?: string | null; role?: Roles | null },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      if (usuarioLogado?.role === Roles.INSTRUTOR) {
        if (!usuarioLogado.id) {
          const error = new Error('Instrutor sem contexto de autenticação válido');
          (error as any).code = 'FORBIDDEN';
          throw error;
        }

        await ensureInstrutorPodeAcessarProva(tx, provaId, usuarioLogado.id);
      }

      await tx.cursosTurmasProvas.delete({ where: { id: provaId } });

      provasLogger.info({ turmaId, provaId }, 'Prova removida com sucesso');

      return { success: true } as const;
    });
  },

  async registrarNota(
    cursoId: string,
    turmaId: string,
    provaId: string,
    data: {
      inscricaoId: string;
      nota: number;
      pesoTotal?: number | null;
      realizadoEm?: Date | null;
      observacoes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await ensureProvaBelongsToTurma(tx, cursoId, turmaId, provaId);

      const inscricao = await tx.cursosTurmasInscricoes.findFirst({
        where: { id: data.inscricaoId, turmaId },
        select: { id: true },
      });

      if (!inscricao) {
        const error = new Error('Inscrição não encontrada para a turma informada');
        (error as any).code = 'INSCRICAO_NOT_FOUND';
        throw error;
      }

      const prova = await tx.cursosTurmasProvas.findFirst({
        where: { id: provaId },
        select: { id: true, titulo: true, descricao: true, peso: true },
      });

      if (!prova) {
        const error = new Error('Prova não encontrada');
        (error as any).code = 'PROVA_NOT_FOUND';
        throw error;
      }

      const envio = await tx.cursosTurmasProvasEnvios.upsert({
        where: {
          provaId_inscricaoId: {
            provaId,
            inscricaoId: data.inscricaoId,
          },
        },
        update: {
          nota: toDecimal(data.nota),
          pesoTotal: toDecimal(data.pesoTotal ?? null) ?? undefined,
          realizadoEm: data.realizadoEm ?? undefined,
          observacoes: data.observacoes ?? undefined,
        },
        create: {
          provaId,
          inscricaoId: data.inscricaoId,
          nota: toDecimal(data.nota),
          pesoTotal: toDecimal(data.pesoTotal ?? null),
          realizadoEm: data.realizadoEm ?? null,
          observacoes: data.observacoes ?? null,
        },
      });

      const pesoValor = data.pesoTotal !== undefined ? data.pesoTotal : Number(prova.peso);
      const dataReferencia = data.realizadoEm ?? envio.realizadoEm ?? new Date();
      const observacoesValor =
        data.observacoes !== undefined ? (data.observacoes ?? null) : undefined;

      await tx.cursosNotas.upsert({
        where: {
          inscricaoId_provaId: {
            inscricaoId: data.inscricaoId,
            provaId,
          },
        },
        update: {
          nota: toDecimalOptional(data.nota),
          peso: toDecimalOptional(pesoValor),
          dataReferencia,
          observacoes: observacoesValor,
          titulo: prova.titulo,
          descricao: prova.descricao ?? null,
        },
        create: {
          turmaId,
          inscricaoId: data.inscricaoId,
          tipo: CursosNotasTipo.PROVA,
          provaId,
          titulo: prova.titulo,
          descricao: prova.descricao ?? null,
          nota: toDecimal(data.nota),
          peso: toDecimal(pesoValor),
          valorMaximo: null,
          dataReferencia,
          observacoes: observacoesValor ?? null,
        },
      });

      provasLogger.info(
        { turmaId, provaId, envioId: envio.id },
        'Nota de prova registrada/atualizada',
      );

      return fetchProva(tx, provaId);
    });
  },
};

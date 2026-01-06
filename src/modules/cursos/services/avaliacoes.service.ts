import {
  CursosAvaliacaoTipo,
  CursosAtividadeTipo,
  CursosLocalProva,
  CursosAulaStatus,
  Prisma,
  CursosTipoQuestao,
  CursosMetodos,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

import type {
  CreateAvaliacaoInput,
  ListAvaliacoesQuery,
  UpdateAvaliacaoInput,
  ClonarAvaliacaoInput,
} from '../validators/avaliacoes.schema';

const avaliacoesLogger = logger.child({ module: 'CursosAvaliacoesService' });

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

const avaliacaoWithQuestoesInclude = Prisma.validator<Prisma.CursosTurmasProvasDefaultArgs>()({
  include: {
    Cursos: { select: { id: true, codigo: true, nome: true } },
    CursosTurmas: {
      select: {
        id: true,
        codigo: true,
        nome: true,
        cursoId: true,
        metodo: true,
        Cursos: { select: { id: true, codigo: true, nome: true } },
      },
    },
    Usuarios: {
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        role: true,
      },
    },
    CursosTurmasProvasQuestoes: {
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      include: {
        CursosTurmasProvasQuestoesAlternativas: {
          orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
        },
      },
    },
  },
});

type AvaliacaoWithQuestoes = Prisma.CursosTurmasProvasGetPayload<
  typeof avaliacaoWithQuestoesInclude
>;

const normalizeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return null;
  return Number(value);
};

const mapAvaliacao = (avaliacao: AvaliacaoWithQuestoes) => {
  const cursoRelacionado = avaliacao.CursosTurmas?.Cursos ?? avaliacao.Cursos ?? null;

  return {
    id: avaliacao.id,
    cursoId: cursoRelacionado?.id ?? avaliacao.cursoId ?? avaliacao.CursosTurmas?.cursoId ?? null,
    turmaId: avaliacao.turmaId ?? null,
    moduloId: avaliacao.moduloId ?? null,
    instrutorId: avaliacao.instrutorId ?? null,
    tipo: avaliacao.tipo,
    tipoAtividade: avaliacao.tipoAtividade ?? null,
    recuperacaoFinal: avaliacao.recuperacaoFinal,
    titulo: avaliacao.titulo,
    etiqueta: avaliacao.etiqueta,
    descricao: avaliacao.descricao ?? null,
    peso: normalizeDecimal(avaliacao.peso) ?? 0,
    valePonto: avaliacao.valePonto ?? true,
    ativo: avaliacao.ativo,
    status: avaliacao.status,
    modalidade: avaliacao.modalidade,
    obrigatoria: avaliacao.obrigatoria,
    dataInicio: avaliacao.dataInicio?.toISOString() ?? null,
    dataFim: avaliacao.dataFim?.toISOString() ?? null,
    horaInicio: avaliacao.horaInicio ?? null,
    horaTermino: avaliacao.horaTermino ?? null,
    localizacao: avaliacao.localizacao,
    ordem: avaliacao.ordem,
    criadoEm: avaliacao.criadoEm.toISOString(),
    atualizadoEm: avaliacao.atualizadoEm.toISOString(),
    curso: cursoRelacionado
      ? {
          id: cursoRelacionado.id,
          codigo: cursoRelacionado.codigo,
          nome: cursoRelacionado.nome,
        }
      : null,
    turma: avaliacao.CursosTurmas
      ? {
          id: avaliacao.CursosTurmas.id,
          codigo: avaliacao.CursosTurmas.codigo,
          nome: avaliacao.CursosTurmas.nome,
          modalidade: avaliacao.CursosTurmas.metodo, // metodo da turma vira modalidade na API
        }
      : null,
    instrutor: avaliacao.Usuarios
      ? {
          id: avaliacao.Usuarios.id,
          nome: avaliacao.Usuarios.nomeCompleto,
          email: avaliacao.Usuarios.email,
          role: avaliacao.Usuarios.role,
        }
      : null,
    questoes: avaliacao.CursosTurmasProvasQuestoes.map((questao) => ({
      id: questao.id,
      provaId: questao.provaId,
      enunciado: questao.enunciado,
      tipo: questao.tipo,
      ordem: questao.ordem,
      peso: questao.peso ? normalizeDecimal(questao.peso) : null,
      obrigatoria: questao.obrigatoria,
      alternativas:
        questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA
          ? questao.CursosTurmasProvasQuestoesAlternativas.map((alt) => ({
              id: alt.id,
              questaoId: alt.questaoId,
              texto: alt.texto,
              ordem: alt.ordem,
              correta: alt.correta,
            }))
          : undefined,
    })),
  };
};

const ensureCursoExists = async (client: PrismaClientOrTx, cursoId: string) => {
  const curso = await client.cursos.findUnique({ where: { id: cursoId }, select: { id: true } });
  if (!curso) {
    const error: any = new Error('Curso não encontrado');
    error.code = 'CURSO_NOT_FOUND';
    throw error;
  }
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
    const error: any = new Error('Turma não encontrada para o curso informado');
    error.code = 'TURMA_NOT_FOUND';
    throw error;
  }
};

const ensureModuloBelongsToTurma = async (
  client: PrismaClientOrTx,
  turmaId: string,
  moduloId: string,
) => {
  const modulo = await client.cursosTurmasModulos.findFirst({
    where: { id: moduloId, turmaId },
    select: { id: true },
  });

  if (!modulo) {
    const error: any = new Error('Módulo não encontrado para a turma informada');
    error.code = 'MODULO_NOT_FOUND';
    throw error;
  }
};

const fetchTemplate = async (client: PrismaClientOrTx, avaliacaoId: string) => {
  const avaliacao = await client.cursosTurmasProvas.findUnique({
    where: { id: avaliacaoId },
    ...avaliacaoWithQuestoesInclude,
  });

  if (!avaliacao || avaliacao.turmaId) {
    const error: any = new Error('Avaliação não encontrada');
    error.code = 'AVALIACAO_NOT_FOUND';
    throw error;
  }

  return mapAvaliacao(avaliacao as AvaliacaoWithQuestoes);
};

const fetchAny = async (client: PrismaClientOrTx, avaliacaoId: string) => {
  const avaliacao = await client.cursosTurmasProvas.findUnique({
    where: { id: avaliacaoId },
    ...avaliacaoWithQuestoesInclude,
  });

  if (!avaliacao) {
    const error: any = new Error('Avaliação não encontrada');
    error.code = 'AVALIACAO_NOT_FOUND';
    throw error;
  }

  return mapAvaliacao(avaliacao as AvaliacaoWithQuestoes);
};

const createQuestoes = async (
  client: PrismaClientOrTx,
  provaId: string,
  questoes: CreateAvaliacaoInput['questoes'],
) => {
  if (!questoes?.length) return;

  for (let index = 0; index < questoes.length; index += 1) {
    const questao = questoes[index];
    const ordem = questao.ordem ?? index + 1;

    const createdQuestao = await client.cursosTurmasProvasQuestoes.create({
      data: {
        provaId,
        enunciado: questao.enunciado,
        tipo: questao.tipo,
        ordem,
        peso: questao.peso !== undefined ? new Prisma.Decimal(questao.peso) : null,
        obrigatoria: questao.obrigatoria ?? true,
      },
    });

    if (
      questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA &&
      questao.alternativas &&
      questao.alternativas.length
    ) {
      await client.cursosTurmasProvasQuestoesAlternativas.createMany({
        data: questao.alternativas.map((alt, altIndex) => ({
          questaoId: createdQuestao.id,
          texto: alt.texto,
          ordem: alt.ordem ?? altIndex + 1,
          correta: alt.correta ?? false,
        })),
      });
    }
  }
};

export const avaliacoesService = {
  async list(query: ListAvaliacoesQuery) {
    const { cursoId, turmaId, tipo, status, semTurma, search, page, pageSize, orderBy, order } =
      query;

    const where: Prisma.CursosTurmasProvasWhereInput = {};

    // Filtro por curso (OPCIONAL)
    if (cursoId) {
      if (semTurma === true) {
        where.turmaId = null;
        where.cursoId = cursoId;
      } else if (semTurma === false) {
        where.turmaId = { not: null };
        where.CursosTurmas = { cursoId };
      } else {
        where.OR = [{ turmaId: null, cursoId }, { CursosTurmas: { cursoId } }];
      }
    } else {
      // Sem cursoId: listagem global
      if (semTurma === true) {
        where.turmaId = null;
      } else if (semTurma === false) {
        where.turmaId = { not: null };
      }
      // Se semTurma não for especificado, retorna tudo
    }

    // Filtro por turma específica (OPCIONAL)
    if (turmaId) {
      where.turmaId = turmaId;
    }

    // Filtro por tipo (OPCIONAL)
    if (tipo) {
      where.tipo = tipo;
    }

    // Filtro por status (OPCIONAL)
    if (status) {
      where.ativo = status === 'ATIVO';
    }

    // Busca por título ou etiqueta (OPCIONAL)
    if (search) {
      const searchFilter: Prisma.CursosTurmasProvasWhereInput = {
        OR: [
          { titulo: { contains: search, mode: 'insensitive' } },
          { etiqueta: { contains: search, mode: 'insensitive' } },
        ],
      };

      where.AND =
        where.AND && Array.isArray(where.AND) ? [...where.AND, searchFilter] : [searchFilter];
    }

    const total = await prisma.cursosTurmasProvas.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const avaliacoes = await prisma.cursosTurmasProvas.findMany({
      where,
      ...avaliacaoWithQuestoesInclude,
      orderBy: { [orderBy]: order },
      skip,
      take: pageSize,
    });

    // Buscar informações dos criadores em lote
    const avaliacaoIds = avaliacoes.map((a) => a.id);
    const auditoriaLogs = await prisma.auditoriaLogs.findMany({
      where: {
        entidadeId: { in: avaliacaoIds },
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

    return {
      data: avaliacoes.map((a) => {
        const mapped = mapAvaliacao(a as AvaliacaoWithQuestoes);
        const criadoPor = criadoresMap.get(a.id) ?? null;

        return {
          ...mapped,
          // Campos de visão geral
          nome: mapped.titulo,
          cursoNome: mapped.curso?.nome ?? null,
          turmaNome: mapped.turma?.nome ?? null,
          status: a.ativo ? 'ATIVO' : 'INATIVO',
          data: a.criadoEm.toISOString(),
          pesoNota: normalizeDecimal(a.peso) ?? 0,
          criadoPor,
        };
      }),
      pagination: {
        page: safePage,
        requestedPage: page,
        pageSize,
        total,
        totalPages: totalPages || 1,
        hasNext: totalPages > 0 && safePage < totalPages,
        hasPrevious: safePage > 1,
        isPageAdjusted: safePage !== page,
      },
    };
  },

  async get(avaliacaoId: string) {
    return fetchTemplate(prisma, avaliacaoId);
  },

  async create(data: CreateAvaliacaoInput) {
    return prisma.$transaction(async (tx) => {
      // ✅ Verificar se curso existe (APENAS se cursoId foi fornecido)
      if (data.cursoId) {
        await ensureCursoExists(tx, data.cursoId);
      }

      // REGRA 1.0: Se turma for vinculada, buscar informações da turma
      let modalidadeFinal = data.modalidade;
      let instrutorIdFinal = data.instrutorId;

      // SEMPRE criar como RASCUNHO (com ou sem turma)
      // Usuário publica depois via PATCH /avaliacoes/{id}
      const statusFinal = CursosAulaStatus.RASCUNHO;

      if (data.turmaId) {
        const turma = await tx.cursosTurmas.findUnique({
          where: { id: data.turmaId },
          select: {
            id: true,
            cursoId: true,
            metodo: true,
            instrutorId: true,
          },
        });

        if (!turma) {
          const error: any = new Error('Turma não encontrada');
          error.code = 'TURMA_NOT_FOUND';
          throw error;
        }

        // ✅ Verificar se turma pertence ao curso (APENAS se cursoId foi fornecido)
        if (data.cursoId && turma.cursoId !== data.cursoId) {
          const error: any = new Error('Turma não pertence ao curso informado');
          error.code = 'TURMA_CURSO_MISMATCH';
          throw error;
        }

        // Pegar modalidade (metodo) da turma
        modalidadeFinal = turma.metodo;

        // Se instrutor não foi informado, pegar da turma
        if (!instrutorIdFinal && turma.instrutorId) {
          instrutorIdFinal = turma.instrutorId;
        }
      }

      // ✅ Se modalidade não foi definida, tentar pegar de uma turma do curso (apenas se cursoId existe)
      if (!modalidadeFinal && data.cursoId) {
        modalidadeFinal = await tx.cursosTurmas
          .findFirst({
            where: { cursoId: data.cursoId },
            select: { metodo: true },
          })
          .then((t) => t?.metodo ?? data.modalidade);
      }

      // ✅ Se ainda não tem modalidade, usar ONLINE como padrão
      if (!modalidadeFinal) {
        modalidadeFinal = data.modalidade ?? CursosMetodos.ONLINE;
      }

      // Verificar se instrutor existe (se informado)
      if (instrutorIdFinal) {
        const instrutor = await tx.usuarios.findUnique({
          where: { id: instrutorIdFinal },
          select: { id: true, role: true },
        });

        if (!instrutor) {
          const error: any = new Error('Instrutor não encontrado');
          error.code = 'INSTRUTOR_NOT_FOUND';
          throw error;
        }

        // Verificar se usuário tem role de instrutor
        if (
          instrutor.role !== 'INSTRUTOR' &&
          instrutor.role !== 'ADMIN' &&
          instrutor.role !== 'PEDAGOGICO'
        ) {
          const error: any = new Error('Usuário informado não é um instrutor válido');
          error.code = 'INVALID_INSTRUTOR_ROLE';
          throw error;
        }
      }

      // ✅ Calcular ordem (considerar que cursoId pode ser null)
      const ordem =
        data.ordem ??
        (await tx.cursosTurmasProvas.count({
          where: {
            cursoId: data.cursoId ?? null,
            turmaId: data.turmaId ?? null,
          },
        })) + 1;

      // Gerar etiqueta automática se não fornecida
      const etiqueta =
        data.etiqueta ||
        `${data.tipo === CursosAvaliacaoTipo.PROVA ? 'P' : 'A'}${ordem}-${new Date().getTime().toString().slice(-4)}`;

      // ✅ Criar avaliação (cursoId pode ser null)
      const avaliacao = await tx.cursosTurmasProvas.create({
        data: {
          cursoId: data.cursoId ?? null,
          turmaId: data.turmaId ?? null,
          moduloId: null,
          instrutorId: instrutorIdFinal ?? null,
          tipo: data.tipo,
          tipoAtividade: data.tipoAtividade ?? null,
          recuperacaoFinal: data.recuperacaoFinal ?? false,
          titulo: data.titulo,
          etiqueta,
          descricao: data.descricao ?? null,
          peso: new Prisma.Decimal(data.peso),
          valePonto: data.valePonto ?? true,
          ativo: true, // Sempre ativo (status controla publicação)
          status: statusFinal,
          modalidade: modalidadeFinal,
          obrigatoria: data.obrigatoria ?? true,
          dataInicio: data.dataInicio,
          dataFim: data.dataFim,
          horaInicio: data.horaInicio,
          horaTermino: data.horaTermino,
          ordem,
          localizacao: data.turmaId ? CursosLocalProva.TURMA : CursosLocalProva.TURMA,
        },
      });

      // Criar questões (se houver)
      if (data.questoes && data.questoes.length > 0) {
        await createQuestoes(tx, avaliacao.id, data.questoes);
      }

      avaliacoesLogger.info(
        {
          avaliacaoId: avaliacao.id,
          cursoId: data.cursoId,
          turmaId: data.turmaId,
          tipo: data.tipo,
          tipoAtividade: data.tipoAtividade,
        },
        'Avaliação criada',
      );

      return fetchAny(tx, avaliacao.id);
    });
  },

  async update(avaliacaoId: string, data: UpdateAvaliacaoInput) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.cursosTurmasProvas.findUnique({
        where: { id: avaliacaoId },
        select: { id: true, turmaId: true },
      });

      if (!existente || existente.turmaId) {
        const error: any = new Error('Avaliação não encontrada');
        error.code = 'AVALIACAO_NOT_FOUND';
        throw error;
      }

      await tx.cursosTurmasProvas.update({
        where: { id: avaliacaoId },
        data: {
          tipo: data.tipo ?? undefined,
          recuperacaoFinal: data.recuperacaoFinal ?? undefined,
          titulo: data.titulo ?? undefined,
          etiqueta: data.etiqueta ?? undefined,
          descricao: data.descricao !== undefined ? data.descricao : undefined,
          peso: data.peso !== undefined ? new Prisma.Decimal(data.peso) : undefined,
          valePonto: data.valePonto ?? undefined,
          ativo: data.ativo ?? undefined,
          ordem: data.ordem ?? undefined,
        },
      });

      if (data.questoes) {
        await tx.cursosTurmasProvasQuestoes.deleteMany({ where: { provaId: avaliacaoId } });
        await createQuestoes(tx, avaliacaoId, data.questoes);
      }

      avaliacoesLogger.info({ avaliacaoId }, 'Avaliação template atualizada');

      return fetchTemplate(tx, avaliacaoId);
    });
  },

  async remove(avaliacaoId: string) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.cursosTurmasProvas.findUnique({
        where: { id: avaliacaoId },
        select: { id: true, turmaId: true },
      });

      if (!existente || existente.turmaId) {
        const error: any = new Error('Avaliação não encontrada');
        error.code = 'AVALIACAO_NOT_FOUND';
        throw error;
      }

      await tx.cursosTurmasProvas.delete({ where: { id: avaliacaoId } });
      avaliacoesLogger.info({ avaliacaoId }, 'Avaliação template removida');
      return { success: true } as const;
    });
  },

  async clonarParaTurma(cursoId: string, turmaId: string, payload: ClonarAvaliacaoInput) {
    return prisma.$transaction(async (tx) => {
      await ensureTurmaBelongsToCurso(tx, cursoId, turmaId);

      if (payload.moduloId) {
        await ensureModuloBelongsToTurma(tx, turmaId, payload.moduloId);
      }

      const template = await tx.cursosTurmasProvas.findFirst({
        where: { id: payload.templateId, turmaId: null, cursoId },
        ...avaliacaoWithQuestoesInclude,
      });

      if (!template) {
        const error: any = new Error('Avaliação template não encontrada para o curso informado');
        error.code = 'AVALIACAO_NOT_FOUND';
        throw error;
      }

      const ordem =
        payload.ordem ?? (await tx.cursosTurmasProvas.count({ where: { turmaId } })) + 1;

      try {
        const nova = await tx.cursosTurmasProvas.create({
          data: {
            turmaId,
            cursoId,
            moduloId: payload.moduloId ?? null,
            tipo: template.tipo ?? CursosAvaliacaoTipo.PROVA,
            recuperacaoFinal: template.recuperacaoFinal ?? false,
            titulo: template.titulo,
            etiqueta: payload.etiqueta ?? template.etiqueta,
            descricao: template.descricao ?? null,
            peso: template.peso,
            valePonto: template.valePonto ?? true,
            ativo: template.ativo ?? true,
            ordem,
            localizacao: payload.moduloId ? CursosLocalProva.MODULO : CursosLocalProva.TURMA,
          },
        });

        for (const questao of template.CursosTurmasProvasQuestoes) {
          const novaQuestao = await tx.cursosTurmasProvasQuestoes.create({
            data: {
              provaId: nova.id,
              enunciado: questao.enunciado,
              tipo: questao.tipo,
              ordem: questao.ordem,
              peso: questao.peso,
              obrigatoria: questao.obrigatoria,
            },
          });

          if (
            questao.tipo === CursosTipoQuestao.MULTIPLA_ESCOLHA &&
            questao.CursosTurmasProvasQuestoesAlternativas.length
          ) {
            await tx.cursosTurmasProvasQuestoesAlternativas.createMany({
              data: questao.CursosTurmasProvasQuestoesAlternativas.map((alt) => ({
                questaoId: novaQuestao.id,
                texto: alt.texto,
                ordem: alt.ordem,
                correta: alt.correta,
              })),
            });
          }
        }

        avaliacoesLogger.info(
          { cursoId, turmaId, templateId: template.id, avaliacaoId: nova.id },
          'Avaliação clonada para turma',
        );

        return fetchAny(tx, nova.id);
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const duplicated: any = new Error('Já existe uma avaliação com esta etiqueta na turma');
          duplicated.code = 'AVALIACAO_ETIQUETA_DUPLICADA';
          throw duplicated;
        }
        throw error;
      }
    });
  },

  /**
   * Lista turmas disponíveis para seleção no formulário de avaliações
   * - ADMIN/MODERADOR/PEDAGOGICO: todas as turmas ativas
   * - INSTRUTOR: apenas turmas onde instrutorId = userId
   * - Suporta filtro opcional por cursoId
   */
  async listTurmasDisponiveis(userId: string, userRole: string, cursoId?: string) {
    const isInstrutor = userRole === 'INSTRUTOR';

    const turmas = await prisma.cursosTurmas.findMany({
      where: {
        ...(isInstrutor ? { instrutorId: userId } : {}),
        ...(cursoId ? { cursoId } : {}), // Filtro opcional por curso
        status: { in: ['PUBLICADO', 'EM_ANDAMENTO'] }, // Apenas turmas ativas
        Cursos: {
          statusPadrao: 'PUBLICADO', // Apenas turmas de cursos publicados
        },
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        cursoId: true,
        metodo: true,
        instrutorId: true,
        turno: true,
        status: true,
        dataInicio: true,
        dataFim: true,
        Cursos: {
          select: {
            id: true,
            codigo: true,
            nome: true,
          },
        },
        Usuarios: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: [{ dataInicio: 'desc' }, { nome: 'asc' }],
    });

    avaliacoesLogger.info(
      { userId, userRole, cursoId, totalTurmas: turmas.length },
      'Turmas disponíveis listadas',
    );

    return turmas;
  },

  /**
   * Lista instrutores disponíveis para seleção no formulário
   * Retorna apenas usuários com role INSTRUTOR
   */
  async listInstrutoresDisponiveis() {
    const instrutores = await prisma.usuarios.findMany({
      where: {
        role: 'INSTRUTOR',
        status: 'ATIVO',
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        cpf: true,
        UsuariosInformation: {
          select: {
            telefone: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { nomeCompleto: 'asc' },
    });

    avaliacoesLogger.info(
      { totalInstrutores: instrutores.length },
      'Instrutores disponíveis listados',
    );

    return instrutores.map((instrutor) => ({
      id: instrutor.id,
      nomeCompleto: instrutor.nomeCompleto,
      email: instrutor.email,
      cpf: instrutor.cpf,
      telefone: instrutor.UsuariosInformation?.telefone ?? null,
      avatarUrl: instrutor.UsuariosInformation?.avatarUrl ?? null,
    }));
  },
};

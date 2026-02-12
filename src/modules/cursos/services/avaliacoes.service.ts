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
  PutUpdateAvaliacaoInput,
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
        instrutorId: true,
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

const mapModalidadeFromDB = (modalidade: string | null | undefined) => {
  if (!modalidade) return null;
  return modalidade === 'LIVE' ? 'AO_VIVO' : modalidade;
};

const mapAvaliacao = (avaliacao: AvaliacaoWithQuestoes) => {
  const cursoRelacionado = avaliacao.CursosTurmas?.Cursos ?? avaliacao.Cursos ?? null;
  let modalidadeAvaliacao = mapModalidadeFromDB(avaliacao.modalidade) ?? null;

  // Se há turma vinculada, modalidade deve seguir método da turma
  if (avaliacao.CursosTurmas?.metodo) {
    modalidadeAvaliacao = mapModalidadeFromDB(avaliacao.CursosTurmas.metodo) ?? modalidadeAvaliacao;
  }

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
    modalidade: modalidadeAvaliacao,
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
          instrutorId: avaliacao.CursosTurmas.instrutorId,
          modalidade: mapModalidadeFromDB(avaliacao.CursosTurmas.metodo), // metodo da turma vira modalidade na API
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
  async list(query: ListAvaliacoesQuery, usuarioLogado: any) {
    const {
      cursoId,
      turmaId,
      instrutorId,
      includeSemCurso,
      curso,
      turma,
      instrutor,
      tipo,
      tipoAtividade,
      modalidade,
      status,
      obrigatoria,
      semTurma,
      search,
      titulo,
      periodo,
      periodoInicio,
      periodoFim,
      dataInicio,
      dataFim,
      page,
      pageSize,
      orderBy,
      order,
    } = query as any;

    const where: Prisma.CursosTurmasProvasWhereInput = {};

    const applyAndFilter = (filter: Prisma.CursosTurmasProvasWhereInput) => {
      if (where.AND && Array.isArray(where.AND)) {
        where.AND.push(filter);
        return;
      }

      if (where.OR) {
        where.AND = [{ OR: where.OR }, filter];
        delete where.OR;
        return;
      }

      where.AND = [filter];
    };

    // Filtro por role: INSTRUTOR vê apenas avaliações das suas turmas (ou sem turma, próprias)
    if (usuarioLogado?.role === 'INSTRUTOR' && !turmaId) {
      applyAndFilter({
        OR: [
          { CursosTurmas: { instrutorId: usuarioLogado.id } },
          { turmaId: null, instrutorId: usuarioLogado.id },
        ],
      });
    }

    // Filtro por cursoId (templates do curso ou avaliações das turmas do curso)
    if (cursoId) {
      if (semTurma === true) {
        const includeSemCursoFinal = includeSemCurso !== undefined ? includeSemCurso : true;
        if (includeSemCursoFinal) {
          applyAndFilter({ turmaId: null, OR: [{ cursoId }, { cursoId: null }] });
        } else {
          applyAndFilter({ turmaId: null, cursoId });
        }
      } else if (semTurma === false) {
        applyAndFilter({ turmaId: { not: null }, CursosTurmas: { cursoId } });
      } else {
        applyAndFilter({ OR: [{ turmaId: null, cursoId }, { CursosTurmas: { cursoId } }] });
      }
    } else if (semTurma === true) {
      applyAndFilter({ turmaId: null });
    } else if (semTurma === false) {
      applyAndFilter({ turmaId: { not: null } });
    }

    if (turmaId) {
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { turmaId }];
        delete where.OR;
      } else {
        where.turmaId = turmaId;
      }
    }

    if (instrutorId) applyAndFilter({ instrutorId });
    if (tipo) where.tipo = tipo;
    if (tipoAtividade) where.tipoAtividade = tipoAtividade;
    if (obrigatoria !== undefined) where.obrigatoria = obrigatoria;

    // Modalidade (CSV) - aceita LIVE e também AO_VIVO (já normalizado no validator)
    if (modalidade) {
      const modalidades = Array.from(
        new Set(
          String(modalidade)
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean),
        ),
      );
      if (modalidades.length > 0) where.modalidade = { in: modalidades as any };
    }

    // status (compat): "ATIVO|INATIVO" -> boolean ativo; caso contrário -> CursosAulaStatus CSV
    if (status) {
      const parts = String(status)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const onlyAtivo = parts.length > 0 && parts.every((s) => s === 'ATIVO' || s === 'INATIVO');
      if (onlyAtivo) {
        if (parts.length === 1) where.ativo = parts[0] === 'ATIVO';
      } else {
        where.status = { in: parts as any };
      }
    }

    const searchTerm = (search ?? titulo)?.trim();
    const cursoTerm = typeof curso === 'string' ? curso.trim() : undefined;
    const turmaTerm = typeof turma === 'string' ? turma.trim() : undefined;
    const instrutorTerm = typeof instrutor === 'string' ? instrutor.trim() : undefined;

    if (cursoTerm) {
      applyAndFilter({
        OR: [
          { Cursos: { nome: { contains: cursoTerm, mode: 'insensitive' } } },
          { Cursos: { codigo: { contains: cursoTerm, mode: 'insensitive' } } },
          { CursosTurmas: { Cursos: { nome: { contains: cursoTerm, mode: 'insensitive' } } } },
          { CursosTurmas: { Cursos: { codigo: { contains: cursoTerm, mode: 'insensitive' } } } },
        ],
      });
    }

    if (turmaTerm) {
      applyAndFilter({
        CursosTurmas: {
          OR: [
            { nome: { contains: turmaTerm, mode: 'insensitive' } },
            { codigo: { contains: turmaTerm, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (instrutorTerm) {
      applyAndFilter({
        Usuarios: {
          OR: [
            { nomeCompleto: { contains: instrutorTerm, mode: 'insensitive' } },
            { email: { contains: instrutorTerm, mode: 'insensitive' } },
            { cpf: { contains: instrutorTerm, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (searchTerm) {
      applyAndFilter({
        OR: [
          { titulo: { contains: searchTerm, mode: 'insensitive' } },
          { etiqueta: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    // Período: overlap entre [dataInicio,dataFim] e [start,end]
    const parsePeriodoString = (value: string): { start?: Date; end?: Date } => {
      const raw = value.trim();
      if (!raw) return {};
      const separators = [',', ';', ' - ', ' to ', ' até ', ' ate ', '|', '..', '...'];
      let parts: string[] | null = null;
      for (const sep of separators) {
        if (raw.includes(sep)) {
          parts = raw.split(sep).map((p) => p.trim());
          break;
        }
      }
      if (!parts) parts = [raw];
      const [p1, p2] = parts;
      const start = p1 ? new Date(p1) : undefined;
      const end = p2 ? new Date(p2) : undefined;
      return {
        start: start && !Number.isNaN(start.getTime()) ? start : undefined,
        end: end && !Number.isNaN(end.getTime()) ? end : undefined,
      };
    };

    const periodoParsed = typeof periodo === 'string' ? parsePeriodoString(periodo) : {};
    const start = dataInicio ?? periodoInicio ?? periodoParsed.start;
    const end = dataFim ?? periodoFim ?? periodoParsed.end;

    if (start || end) {
      const startFinal = start ?? new Date('1970-01-01T00:00:00.000Z');
      const endFinal = end ?? new Date('9999-12-31T23:59:59.999Z');
      applyAndFilter({
        OR: [
          { dataFim: null, dataInicio: { gte: startFinal, lte: endFinal } },
          { dataFim: { not: null, gte: startFinal }, dataInicio: { lte: endFinal } },
        ],
      });
    }

    const [total, avaliacoes] = await Promise.all([
      prisma.cursosTurmasProvas.count({ where }),
      prisma.cursosTurmasProvas.findMany({
        where,
        ...avaliacaoWithQuestoesInclude,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const avaliacoesPaginadas =
      safePage === page
        ? avaliacoes
        : await prisma.cursosTurmasProvas.findMany({
            where,
            ...avaliacaoWithQuestoesInclude,
            orderBy: { [orderBy]: order },
            skip,
            take: pageSize,
          });

    // Buscar informações dos criadores em lote
    const avaliacaoIds = avaliacoesPaginadas.map((a) => a.id);
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
      data: avaliacoesPaginadas.map((a) => {
        const mapped = mapAvaliacao(a as AvaliacaoWithQuestoes);
        const criadoPor = criadoresMap.get(a.id) ?? null;

        return {
          ...mapped,
          // Campos de visão geral
          nome: mapped.titulo,
          cursoNome: mapped.curso?.nome ?? null,
          turmaNome: mapped.turma?.nome ?? null,
          statusAtivo: a.ativo ? 'ATIVO' : 'INATIVO',
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

  async get(avaliacaoId: string, usuarioLogado: any) {
    const avaliacao = await fetchAny(prisma, avaliacaoId);

    // Restrição extra para instrutor: apenas turmas dele (ou avaliações sem turma com instrutorId dele)
    if (usuarioLogado?.role === 'INSTRUTOR') {
      if (avaliacao.turmaId) {
        if (avaliacao.turma?.instrutorId !== usuarioLogado.id) {
          const error: any = new Error('Instrutor só pode acessar avaliações de suas turmas');
          error.code = 'FORBIDDEN';
          throw error;
        }
      } else if (avaliacao.instrutorId !== usuarioLogado.id) {
        const error: any = new Error('Instrutor só pode acessar avaliações próprias');
        error.code = 'FORBIDDEN';
        throw error;
      }
    }

    return avaliacao;
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
          peso: new Prisma.Decimal(data.valePonto ? (data.peso ?? 0) : 0),
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

  async update(avaliacaoId: string, data: PutUpdateAvaliacaoInput, usuarioLogado: any) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.cursosTurmasProvas.findUnique({
        where: { id: avaliacaoId },
        select: {
          id: true,
          turmaId: true,
          cursoId: true,
          instrutorId: true,
          status: true,
        },
      });

      if (!existente) {
        const error: any = new Error('Avaliação não encontrada');
        error.code = 'AVALIACAO_NOT_FOUND';
        throw error;
      }

      // Permissão: instrutor só edita avaliações de suas turmas (ou sem turma mas dele)
      if (usuarioLogado?.role === 'INSTRUTOR') {
        if (existente.turmaId) {
          const turmaDoInstrutor = await tx.cursosTurmas.findFirst({
            where: { id: existente.turmaId, instrutorId: usuarioLogado.id },
            select: { id: true },
          });
          if (!turmaDoInstrutor) {
            const error: any = new Error('Instrutor só pode editar avaliações de suas turmas');
            error.code = 'FORBIDDEN';
            throw error;
          }
        } else if (existente.instrutorId !== usuarioLogado.id) {
          const error: any = new Error('Instrutor só pode editar avaliações próprias');
          error.code = 'FORBIDDEN';
          throw error;
        }
      }

      const turmaIdFinal = data.turmaId !== undefined ? data.turmaId : existente.turmaId;
      const statusFinal = turmaIdFinal
        ? (data.status ?? existente.status)
        : CursosAulaStatus.RASCUNHO;

      // Se houver turma, modalidade segue turma.metodo e cursoId segue turma.cursoId
      let modalidadeFinal = data.modalidade;
      let cursoIdFinal: string | null | undefined =
        data.cursoId !== undefined ? data.cursoId : existente.cursoId;

      if (turmaIdFinal) {
        const turmaDb = await tx.cursosTurmas.findUnique({
          where: { id: turmaIdFinal },
          select: { cursoId: true, metodo: true },
        });

        if (!turmaDb) {
          const error: any = new Error('Turma não encontrada');
          error.code = 'TURMA_NOT_FOUND';
          throw error;
        }

        // Se cursoId foi informado, validar compatibilidade com a turma
        if (cursoIdFinal && turmaDb.cursoId !== cursoIdFinal) {
          const error: any = new Error('Turma não pertence ao curso informado');
          error.code = 'TURMA_CURSO_MISMATCH';
          throw error;
        }

        cursoIdFinal = turmaDb.cursoId;
        modalidadeFinal = turmaDb.metodo as any;
      }

      // Peso: se não vale ponto, peso = 0
      const pesoFinal = data.valePonto ? (data.peso ?? 0) : 0;

      const updateData: Prisma.CursosTurmasProvasUncheckedUpdateInput = {
        tipo: data.tipo,
        tipoAtividade:
          data.tipo === CursosAvaliacaoTipo.ATIVIDADE ? (data.tipoAtividade ?? null) : null,
        recuperacaoFinal:
          data.tipo === CursosAvaliacaoTipo.PROVA ? (data.recuperacaoFinal ?? false) : false,
        titulo: data.titulo,
        etiqueta: data.etiqueta ?? undefined,
        descricao: data.descricao !== undefined ? (data.descricao ?? null) : undefined,
        peso: new Prisma.Decimal(pesoFinal),
        valePonto: data.valePonto,
        status: statusFinal,
        modalidade: modalidadeFinal as any,
        obrigatoria: data.obrigatoria,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        horaInicio: data.horaInicio,
        horaTermino: data.horaTermino,
      };

      if (turmaIdFinal !== undefined) updateData.turmaId = turmaIdFinal;
      if (cursoIdFinal !== undefined) updateData.cursoId = cursoIdFinal;
      if (data.instrutorId !== undefined) updateData.instrutorId = data.instrutorId;

      await tx.cursosTurmasProvas.update({
        where: { id: avaliacaoId },
        data: updateData,
      });

      // Questões:
      // - PROVA e ATIVIDADE(QUESTOES): substitui pelo payload
      // - ATIVIDADE(PERGUNTA_RESPOSTA): remove quaisquer questões antigas
      if (data.questoes) {
        await tx.cursosTurmasProvasQuestoes.deleteMany({ where: { provaId: avaliacaoId } });
        await createQuestoes(tx, avaliacaoId, data.questoes);
      } else if (
        data.tipo === CursosAvaliacaoTipo.ATIVIDADE &&
        data.tipoAtividade === CursosAtividadeTipo.PERGUNTA_RESPOSTA
      ) {
        await tx.cursosTurmasProvasQuestoes.deleteMany({ where: { provaId: avaliacaoId } });
      }

      avaliacoesLogger.info({ avaliacaoId }, 'Avaliação atualizada');

      return fetchAny(tx, avaliacaoId);
    });
  },

  async remove(avaliacaoId: string, usuarioLogado: any) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.cursosTurmasProvas.findUnique({
        where: { id: avaliacaoId },
        select: { id: true, turmaId: true, instrutorId: true },
      });

      if (!existente) {
        const error: any = new Error('Avaliação não encontrada');
        error.code = 'AVALIACAO_NOT_FOUND';
        throw error;
      }

      if (usuarioLogado?.role === 'INSTRUTOR') {
        if (existente.turmaId) {
          const turmaDoInstrutor = await tx.cursosTurmas.findFirst({
            where: { id: existente.turmaId, instrutorId: usuarioLogado.id },
            select: { id: true },
          });
          if (!turmaDoInstrutor) {
            const error: any = new Error('Instrutor só pode remover avaliações de suas turmas');
            error.code = 'FORBIDDEN';
            throw error;
          }
        } else if (existente.instrutorId !== usuarioLogado.id) {
          const error: any = new Error('Instrutor só pode remover avaliações próprias');
          error.code = 'FORBIDDEN';
          throw error;
        }
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

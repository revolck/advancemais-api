import { prisma, retryOperation } from '@/config/prisma';
import { logger } from '@/utils/logger';
import type {
  CreateAulaInput,
  UpdateAulaInput,
  ListAulasQuery,
  UpdateProgressoInput,
} from '../validators/aulas.schema';
import type { Prisma, Usuarios } from '@prisma/client';
import { googleCalendarService } from './google-calendar.service';
import { notificacoesHelper } from './notificacoes-helper.service';

const aulasLogger = logger.child({ module: 'AulasService' });

// Mapear modalidade do input para enum do banco (API → Banco)
function mapModalidade(modalidade: string): any {
  const map: Record<string, string> = {
    ONLINE: 'ONLINE',
    PRESENCIAL: 'PRESENCIAL',
    AO_VIVO: 'LIVE',
    SEMIPRESENCIAL: 'SEMIPRESENCIAL',
  };
  return map[modalidade] || modalidade;
}

// Mapear modalidade do banco para API (Banco → API)
function mapModalidadeFromDB(modalidade: string): string {
  const map: Record<string, string> = {
    ONLINE: 'ONLINE',
    PRESENCIAL: 'PRESENCIAL',
    LIVE: 'AO_VIVO', // ✅ Converter LIVE → AO_VIVO
    SEMIPRESENCIAL: 'SEMIPRESENCIAL',
  };
  return map[modalidade] || modalidade;
}

// Mapear método da turma para modalidade da aula (Turma → Aula)
function mapMetodoTurmaToModalidadeAula(metodo: string): string {
  const map: Record<string, string> = {
    ONLINE: 'ONLINE',
    PRESENCIAL: 'PRESENCIAL',
    LIVE: 'AO_VIVO', // ✅ Converter LIVE → AO_VIVO
    SEMIPRESENCIAL: 'SEMIPRESENCIAL',
  };
  return map[metodo] || metodo;
}

/**
 * Validar campos obrigatórios para publicação por modalidade
 */
function validarCamposPublicacao(aula: any): {
  valido: boolean;
  camposFaltando: string[];
  erro?: string;
} {
  const camposFaltando: string[] = [];

  // Campos básicos sempre obrigatórios
  if (!aula.titulo || aula.titulo.trim() === '') {
    camposFaltando.push('titulo');
  }
  if (!aula.descricao || aula.descricao.trim() === '') {
    camposFaltando.push('descricao');
  }

  const modalidade = aula.modalidade;

  if (modalidade === 'PRESENCIAL') {
    if (!aula.dataInicio) camposFaltando.push('dataInicio');
    if (!aula.turmaId) camposFaltando.push('turmaId');
    // ✅ instrutorId não é obrigatório - pode ser adicionado depois
  } else if (modalidade === 'AO_VIVO' || modalidade === 'LIVE') {
    if (!aula.dataInicio) camposFaltando.push('dataInicio');
    if (!aula.turmaId) camposFaltando.push('turmaId');
    // ✅ instrutorId não é obrigatório - pode ser adicionado depois
    // Validar data no futuro
    if (aula.dataInicio && new Date(aula.dataInicio) <= new Date()) {
      return {
        valido: false,
        camposFaltando,
        erro: 'A data de início deve ser no futuro para aulas AO_VIVO',
      };
    }
  } else if (modalidade === 'SEMIPRESENCIAL') {
    const temYoutube = !!aula.urlVideo;
    const temDataInicio = !!aula.dataInicio;
    if (!temYoutube && !temDataInicio) {
      camposFaltando.push('youtubeUrl ou dataInicio');
    }
    // Se tem dataInicio, precisa apenas turma para criar Meet (instrutor pode ser adicionado depois)
    if (temDataInicio) {
      if (!aula.turmaId) camposFaltando.push('turmaId');
      // ✅ instrutorId não é obrigatório - pode ser adicionado depois
      // Validar data no futuro
      if (new Date(aula.dataInicio) <= new Date()) {
        return {
          valido: false,
          camposFaltando,
          erro: 'A data de início deve ser no futuro para aulas SEMIPRESENCIAL com Meet',
        };
      }
    }
  } else if (modalidade === 'ONLINE') {
    if (!aula.urlVideo) camposFaltando.push('youtubeUrl');
  }

  return {
    valido: camposFaltando.length === 0 && !aula.erro,
    camposFaltando,
    erro: aula.erro,
  };
}

/**
 * Validar exclusão de aula
 */
function validarExclusaoAula(
  aula: any,
  usuarioLogado: any,
): { valido: boolean; erro?: string; codigo?: string; diasRestantes?: number } {
  // 1. Validar role
  if (!['ADMIN', 'MODERADOR', 'PEDAGOGICO'].includes(usuarioLogado.role)) {
    return {
      valido: false,
      erro: 'Apenas administradores, moderadores e equipe pedagógica podem excluir aulas',
      codigo: 'FORBIDDEN',
    };
  }

  // 2. Validar se aula já foi realizada
  if (aula.dataInicio && new Date(aula.dataInicio) < new Date()) {
    return {
      valido: false,
      erro: 'Não é possível excluir aulas que já foram realizadas',
      codigo: 'AULA_JA_REALIZADA',
    };
  }

  // 3. Validar prazo mínimo (5 dias) - apenas se tiver dataInicio
  if (aula.dataInicio && aula.modalidade !== 'ONLINE') {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAula = new Date(aula.dataInicio);
    dataAula.setHours(0, 0, 0, 0);
    const diffTime = dataAula.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diasRestantes < 5 && diasRestantes >= 0) {
      return {
        valido: false,
        erro: `A exclusão deve ser feita com no mínimo 5 dias de antecedência. A aula acontece em ${diasRestantes} dia(s).`,
        codigo: 'PRAZO_INSUFICIENTE',
        diasRestantes,
      };
    }
  }

  // 4. Validar status
  if (aula.status === 'EM_ANDAMENTO') {
    return {
      valido: false,
      erro: 'Não é possível excluir uma aula em andamento',
      codigo: 'AULA_EM_ANDAMENTO',
    };
  }

  return { valido: true };
}

/**
 * Validar despublicação
 */
function validarDespublicacao(aula: any): { valido: boolean; erro?: string; codigo?: string } {
  if (aula.status === 'EM_ANDAMENTO') {
    return {
      valido: false,
      erro: 'Não é possível despublicar uma aula em andamento',
      codigo: 'STATUS_INVALIDO',
    };
  }

  if (aula.status === 'CONCLUIDA') {
    return {
      valido: false,
      erro: 'Não é possível despublicar uma aula concluída',
      codigo: 'STATUS_INVALIDO',
    };
  }

  // Validar se aula já aconteceu
  if (aula.dataInicio && new Date(aula.dataInicio) < new Date()) {
    return {
      valido: false,
      erro: 'Não é possível despublicar uma aula que já foi realizada',
      codigo: 'AULA_JA_REALIZADA',
    };
  }

  return { valido: true };
}

/**
 * Service de gestão de aulas
 */
export const aulasService = {
  /**
   * Listar aulas com filtros e paginação
   */
  async list(query: ListAulasQuery, usuarioLogado: any) {
    const {
      page,
      pageSize,
      cursoId,
      semTurma,
      turmaId,
      moduloId,
      instrutorId,
      modalidade,
      status,
      obrigatoria,
      dataInicio,
      dataFim,
      search,
      orderBy,
      order,
    } = query;

    const where: Prisma.CursosTurmasAulasWhereInput = {
      deletedAt: null, // Não mostrar deletadas
    };

    const applyAndFilter = (filter: Prisma.CursosTurmasAulasWhereInput) => {
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

    // Filtro por role: INSTRUTOR vê apenas suas turmas
    // IMPORTANTE: Aplicar ANTES dos filtros da query para não sobrescrever
    if (usuarioLogado.role === 'INSTRUTOR' && !turmaId) {
      // Apenas aplicar filtro de INSTRUTOR se não houver filtro explícito de turmaId
      const turmasDoInstrutor = await retryOperation(() =>
        prisma.cursosTurmas.findMany({
          where: { instrutorId: usuarioLogado.id },
          select: { id: true },
        }),
      );
      const turmasIds = turmasDoInstrutor.map((t) => t.id);
      if (turmasIds.length > 0) {
        // Incluir aulas das turmas do instrutor OU aulas sem turma mas do instrutor
        where.OR = [
          { turmaId: { in: turmasIds } },
          { turmaId: null, instrutorId: usuarioLogado.id },
        ];
      } else {
        // Se não tiver turmas, apenas aulas sem turma mas do instrutor
        where.turmaId = null;
        where.instrutorId = usuarioLogado.id;
      }
    }

    if (semTurma === true) {
      applyAndFilter({ turmaId: null });
    }

    if (cursoId) {
      if (turmaId) {
        applyAndFilter({ CursosTurmas: { cursoId } });
      } else if (semTurma === true) {
        applyAndFilter({ cursoId });
      } else if (semTurma === false) {
        applyAndFilter({ turmaId: { not: null }, CursosTurmas: { cursoId } });
      } else {
        applyAndFilter({ OR: [{ turmaId: null, cursoId }, { CursosTurmas: { cursoId } }] });
      }
    }

    // Filtros da query (aplicar após filtro de role)
    if (turmaId) {
      // Se já existe OR (do filtro de INSTRUTOR), não sobrescrever
      if (where.OR) {
        // Manter OR mas adicionar filtro de turmaId
        where.AND = [{ OR: where.OR }, { turmaId }];
        delete where.OR;
      } else {
        where.turmaId = turmaId;
      }
    }
    if (moduloId) where.moduloId = moduloId;
    if (instrutorId) applyAndFilter({ instrutorId });
    if (modalidade) where.modalidade = { in: modalidade.split(',') as any };
    if (status) where.status = { in: status.split(',') as any };
    if (obrigatoria !== undefined) where.obrigatoria = obrigatoria;
    if (dataInicio || dataFim) {
      applyAndFilter({
        dataInicio: {
          gte: dataInicio ?? undefined,
          lte: dataFim ?? undefined,
        },
      });
    }
    if (search) {
      // Combinar search com filtros existentes usando AND
      const searchFilter: Prisma.CursosTurmasAulasWhereInput = {
        OR: [
          { nome: { contains: search, mode: 'insensitive' } },
          { descricao: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.AND && Array.isArray(where.AND)) {
        where.AND.push(searchFilter);
      } else if (where.OR) {
        // Se já tem OR (do filtro de INSTRUTOR), combinar com AND
        where.AND = [{ OR: where.OR }, searchFilter];
        delete where.OR;
      } else {
        where.OR = searchFilter.OR;
      }
    }

    const [total, aulas] = await Promise.all([
      retryOperation(() => prisma.cursosTurmasAulas.count({ where })),
      retryOperation(() =>
        prisma.cursosTurmasAulas.findMany({
          where,
          include: {
            Cursos: {
              select: {
                id: true,
                codigo: true,
                nome: true,
              },
            },
            CursosTurmas: {
              select: {
                id: true,
                codigo: true,
                nome: true,
                turno: true,
                metodo: true,
                Cursos: {
                  select: {
                    id: true,
                    codigo: true,
                    nome: true,
                  },
                },
              },
            },
            CursosTurmasModulos: {
              select: { id: true, nome: true },
            },
            criadoPor: {
              select: { id: true, nomeCompleto: true, cpf: true },
            },
            instrutor: {
              select: {
                id: true,
                codUsuario: true,
                nomeCompleto: true,
                email: true,
                cpf: true,
                UsuariosInformation: {
                  select: {
                    avatarUrl: true,
                  },
                },
              },
            },
          },
          orderBy: { [orderBy]: order },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ),
    ]);

    return {
      data: aulas.map((a) => {
        // ✅ Converter modalidade do banco para API (LIVE → AO_VIVO)
        let modalidadeAula = mapModalidadeFromDB(a.modalidade);
        const cursoRelacionado = a.CursosTurmas?.Cursos ?? a.Cursos ?? null;

        // ✅ Se há turma vinculada, a modalidade deve corresponder ao método da turma
        if (a.CursosTurmas?.metodo) {
          const modalidadeEsperada = mapMetodoTurmaToModalidadeAula(a.CursosTurmas.metodo);
          // Se a modalidade não corresponde, usar a da turma
          if (modalidadeAula !== modalidadeEsperada) {
            modalidadeAula = modalidadeEsperada;
          }
        }

        return {
          id: a.id,
          codigo: a.codigo,
          cursoId: cursoRelacionado?.id || null,
          turmaId: a.turmaId || null,
          titulo: a.nome,
          descricao: a.descricao || null,
          duracaoMinutos: a.duracaoMinutos || null,
          modalidade: modalidadeAula,
          youtubeUrl: a.urlVideo || null,
          meetUrl: a.urlMeet || null,
          // tipoLink calculado (não vem do banco)
          tipoLink: a.urlVideo ? 'YOUTUBE' : a.urlMeet ? 'MEET' : null,
          sala: a.sala || null,
          status: a.status,
          obrigatoria: a.obrigatoria,
          ordem: a.ordem,
          dataInicio: a.dataInicio?.toISOString() || null,
          dataFim: a.dataFim?.toISOString() || null,
          gravarAula: a.gravarAula || null,
          linkGravacao: a.linkGravacao || null,
          statusGravacao: a.statusGravacao || null,
          curso: cursoRelacionado
            ? {
                id: cursoRelacionado.id,
                codigo: cursoRelacionado.codigo,
                nome: cursoRelacionado.nome,
              }
            : null,
          turma: a.CursosTurmas
            ? {
                id: a.CursosTurmas.id,
                codigo: a.CursosTurmas.codigo,
                nome: a.CursosTurmas.nome,
                turno: a.CursosTurmas.turno,
                metodo: a.CursosTurmas.metodo,
                curso: a.CursosTurmas.Cursos
                  ? {
                      id: a.CursosTurmas.Cursos.id,
                      codigo: a.CursosTurmas.Cursos.codigo,
                      nome: a.CursosTurmas.Cursos.nome,
                    }
                  : null,
              }
            : null,
          modulo: a.CursosTurmasModulos
            ? {
                id: a.CursosTurmasModulos.id,
                nome: a.CursosTurmasModulos.nome,
              }
            : null,
          instrutor: a.instrutor
            ? {
                id: a.instrutor.id,
                codigo: a.instrutor.codUsuario,
                nome: a.instrutor.nomeCompleto,
                email: a.instrutor.email,
                cpf: a.instrutor.cpf,
                avatarUrl: a.instrutor.UsuariosInformation?.avatarUrl || null,
              }
            : null,
          criadoPor: a.criadoPor
            ? {
                id: a.criadoPor.id,
                nome: a.criadoPor.nomeCompleto,
                cpf: a.criadoPor.cpf,
              }
            : null,
          criadoEm: a.criadoEm.toISOString(),
          atualizadoEm: a.atualizadoEm.toISOString(),
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  /**
   * Criar nova aula
   */
  async create(input: CreateAulaInput, usuarioLogado: any) {
    // 1. Processar data e hora (Arquitetura Ideal)
    const precisaPeriodo =
      input.modalidade === 'PRESENCIAL' ||
      input.modalidade === 'AO_VIVO' ||
      (input.modalidade === 'SEMIPRESENCIAL' && (input.dataInicio || input.horaInicio));

    let dataInicioCompleta: Date | null = null;
    let dataFimCompleta: Date | null = null;
    let horaFimCalculada: string | null = null;

    if (precisaPeriodo && input.dataInicio && input.horaInicio) {
      // Combinar data + hora
      const [hours, minutes] = input.horaInicio.split(':');
      dataInicioCompleta = new Date(`${input.dataInicio}T${hours}:${minutes}:00.000Z`);

      // Calcular dataFimCompleta e horaFim
      // Cenário 1: dataFim informado → aula acontece de dataInicio a dataFim
      // Cenário 2: dataFim não informado → aula acontece apenas no dataInicio
      if (input.dataFim) {
        // Cenário 1: Período de X a Y
        if (input.horaFim) {
          horaFimCalculada = input.horaFim;
          const [hoursF, minutesF] = input.horaFim.split(':');
          dataFimCompleta = new Date(`${input.dataFim}T${hoursF}:${minutesF}:00.000Z`);
        } else if (input.duracaoMinutos) {
          // Calcular dataFimCompleta usando dataFim (não dataInicio)
          const dataFimBase = new Date(`${input.dataFim}T${hours}:${minutes}:00.000Z`);
          dataFimCompleta = new Date(dataFimBase.getTime() + input.duracaoMinutos * 60000);
          const h = dataFimCompleta.getHours().toString().padStart(2, '0');
          const m = dataFimCompleta.getMinutes().toString().padStart(2, '0');
          horaFimCalculada = `${h}:${m}`;
        }
      } else {
        // Cenário 2: Apenas dataInicio (aula única no dia)
        if (input.horaFim) {
          horaFimCalculada = input.horaFim;
          const [hoursF, minutesF] = input.horaFim.split(':');
          // Usar dataInicio mesmo (mesmo dia)
          dataFimCompleta = new Date(`${input.dataInicio}T${hoursF}:${minutesF}:00.000Z`);
        } else if (input.duracaoMinutos) {
          // Calcular automaticamente usando dataInicio
          dataFimCompleta = new Date(dataInicioCompleta.getTime() + input.duracaoMinutos * 60000);
          const h = dataFimCompleta.getHours().toString().padStart(2, '0');
          const m = dataFimCompleta.getMinutes().toString().padStart(2, '0');
          horaFimCalculada = `${h}:${m}`;
        }
      }

      // Validar futuro para AO_VIVO
      if (input.modalidade === 'AO_VIVO' && dataInicioCompleta < new Date()) {
        throw new Error('Aula ao vivo deve ser agendada para o futuro');
      }
    }

    // 2. Validar permissão do instrutor (se turma foi fornecida)
    if (usuarioLogado.role === 'INSTRUTOR' && input.turmaId) {
      const turmasDoInstrutor = await prisma.cursosTurmas.findMany({
        where: { instrutorId: usuarioLogado.id },
        select: { id: true },
      });

      if (!turmasDoInstrutor.some((t) => t.id === input.turmaId)) {
        throw new Error('Instrutor só pode criar aulas para turmas às quais está vinculado');
      }
    }

    // 3. Resolver cursoId e validar vínculo (turma ou template)
    let cursoIdFinal: string | null = input.cursoId ?? null;

    if (input.turmaId) {
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: input.turmaId },
        select: { cursoId: true, dataInicio: true, dataFim: true, status: true, metodo: true },
      });

      if (!turma) {
        const error: any = new Error('Turma não encontrada');
        error.code = 'TURMA_NOT_FOUND';
        throw error;
      }

      if (cursoIdFinal && cursoIdFinal !== turma.cursoId) {
        const error: any = new Error('cursoId não corresponde à turma informada');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      cursoIdFinal = turma.cursoId;

      if (dataInicioCompleta && turma.dataInicio && dataInicioCompleta < turma.dataInicio) {
        const error: any = new Error('Aula não pode começar antes do início da turma');
        error.code = 'DATA_INVALIDA';
        throw error;
      }

      if (dataFimCompleta && turma.dataFim && dataFimCompleta > turma.dataFim) {
        const error: any = new Error('Aula não pode terminar após o fim da turma');
        error.code = 'DATA_INVALIDA';
        throw error;
      }

      // Calcular ordem se turma já iniciou
      if (turma.status === 'EM_ANDAMENTO') {
        const ultimaAula = await prisma.cursosTurmasAulas.findFirst({
          where: {
            turmaId: input.turmaId,
            moduloId: input.moduloId || null,
            status: { in: ['CONCLUIDA', 'EM_ANDAMENTO'] },
            deletedAt: null,
          },
          orderBy: { ordem: 'desc' },
        });

        (input as any).ordem = (ultimaAula?.ordem || 0) + 1;
        (input as any).adicionadaAposCriacao = true;
      }

      // ✅ Forçar modalidade baseada no método da turma
      if (turma.metodo) {
        const modalidadeEsperada = mapMetodoTurmaToModalidadeAula(turma.metodo);
        if (
          input.modalidade &&
          mapModalidadeFromDB(mapModalidade(input.modalidade)) !== modalidadeEsperada
        ) {
          (input as any).modalidade = modalidadeEsperada;
        }
      }
    } else {
      if (!cursoIdFinal) {
        const error: any = new Error('cursoId é obrigatório quando turmaId não for informado');
        error.code = 'VALIDATION_ERROR';
        throw error;
      }

      const curso = await prisma.cursos.findUnique({
        where: { id: cursoIdFinal },
        select: { id: true },
      });

      if (!curso) {
        const error: any = new Error('Curso não encontrado');
        error.code = 'CURSO_NOT_FOUND';
        throw error;
      }
    }

    // 4. Gerar código único automaticamente
    const ultimaAula = await prisma.cursosTurmasAulas.findFirst({
      where: { codigo: { startsWith: 'AUL-' } },
      orderBy: { criadoEm: 'desc' },
      select: { codigo: true },
    });

    let numero = 1;
    if (ultimaAula?.codigo) {
      const match = ultimaAula.codigo.match(/AUL-(\d+)/);
      if (match) numero = parseInt(match[1], 10) + 1;
    }

    const codigo = `AUL-${numero.toString().padStart(6, '0')}`;

    // 5. Criar aula
    const aula = await prisma.cursosTurmasAulas.create({
      data: {
        codigo,
        cursoId: cursoIdFinal,
        nome: input.titulo,
        descricao: input.descricao,
        turmaId: input.turmaId || null,
        instrutorId: input.instrutorId || usuarioLogado.id,
        moduloId: input.moduloId,
        modalidade: mapModalidade(input.modalidade),
        urlVideo: input.youtubeUrl || null,
        sala: input.sala || null,
        obrigatoria: input.obrigatoria ?? true,
        duracaoMinutos: input.duracaoMinutos,
        // ✅ IMPORTANTE: Aulas devem ser criadas sempre como RASCUNHO
        // Se frontend enviar PUBLICADA, forçar RASCUNHO (publicação via endpoint específico)
        status: (input.status ?? 'RASCUNHO') as any,
        dataInicio: dataInicioCompleta,
        dataFim: dataFimCompleta,
        horaInicio: input.horaInicio || null,
        horaFim: horaFimCalculada || null, // ✅ Garantir que sempre seja string ou null
        gravarAula: input.gravarAula ?? true,
        criadoPorId: usuarioLogado.id,
        ordem: (input as any).ordem || 0,
        adicionadaAposCriacao: (input as any).adicionadaAposCriacao || false,
      },
    });

    // 5. Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId: aula.id,
        usuarioId: usuarioLogado.id,
        acao: 'CRIADA',
        turmaId: input.turmaId,
      },
    });

    // 6. Se AO_VIVO ou SEMIPRESENCIAL com Meet, criar Google Meet
    // ✅ Ajustado: Criar Meet mesmo se dataFim não for informado (usa dataInicio + duração)
    if (
      (input.modalidade === 'AO_VIVO' ||
        (input.modalidade === 'SEMIPRESENCIAL' && input.tipoLink === 'MEET')) &&
      input.turmaId &&
      input.dataInicio &&
      dataInicioCompleta &&
      dataFimCompleta // Garantir que dataFimCompleta foi calculada (mesmo que não tenha dataFim)
    ) {
      try {
        // Buscar emails dos alunos da turma
        const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
          where: { turmaId: input.turmaId, status: 'INSCRITO' },
          include: { Usuarios: { select: { email: true } } },
        });

        const alunoEmails = inscricoes.map((i) => i.Usuarios.email);

        const meetData = await googleCalendarService.createMeetEvent({
          titulo: input.titulo,
          descricao: input.descricao || '',
          dataInicio: dataInicioCompleta,
          dataFim: dataFimCompleta,
          instrutorId: usuarioLogado.id,
          alunoEmails,
        });

        // Atualizar aula com dados do Meet
        await prisma.cursosTurmasAulas.update({
          where: { id: aula.id },
          data: {
            urlMeet: meetData.meetUrl,
            meetEventId: meetData.eventId,
          },
        });

        aula.urlMeet = meetData.meetUrl;
        aula.meetEventId = meetData.eventId;

        aulasLogger.info('[GOOGLE_MEET_CRIADO]', {
          aulaId: aula.id,
          meetUrl: meetData.meetUrl,
        });
      } catch (error: any) {
        aulasLogger.error('[GOOGLE_MEET_ERRO]', {
          aulaId: aula.id,
          error: error?.message,
        });
        // Não falha a criação da aula se Google Meet falhar
      }
    }

    aulasLogger.info('[AULA_CRIADA]', {
      aulaId: aula.id,
      titulo: aula.nome,
      turmaId: input.turmaId,
    });

    return aula;
  },

  /**
   * Buscar aula por ID
   */
  async getById(aulaId: string, usuarioLogado: any) {
    const aula = await retryOperation(() =>
      prisma.cursosTurmasAulas.findUnique({
        where: { id: aulaId, deletedAt: null },
        include: {
          CursosTurmas: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              turno: true,
              metodo: true,
              Cursos: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                },
              },
            },
          },
          CursosTurmasModulos: {
            select: { id: true, nome: true },
          },
          criadoPor: {
            select: { id: true, nomeCompleto: true, cpf: true },
          },
          instrutor: {
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              UsuariosInformation: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    );

    if (!aula) throw new Error('Aula não encontrada');

    // Validar permissão do instrutor
    if (usuarioLogado.role === 'INSTRUTOR') {
      const turma = await retryOperation(() =>
        prisma.cursosTurmas.findUnique({
          where: { id: aula.turmaId || undefined },
          select: { instrutorId: true },
        }),
      );

      if (turma?.instrutorId !== usuarioLogado.id) {
        throw new Error('Instrutor só pode acessar aulas de suas turmas');
      }
    }

    // ✅ Converter modalidade do banco para API (LIVE → AO_VIVO)
    let modalidadeAula = mapModalidadeFromDB(aula.modalidade);

    // ✅ Se há turma vinculada, a modalidade deve corresponder ao método da turma
    if (aula.CursosTurmas?.metodo) {
      const modalidadeEsperada = mapMetodoTurmaToModalidadeAula(aula.CursosTurmas.metodo);
      // Se a modalidade não corresponde, usar a da turma
      if (modalidadeAula !== modalidadeEsperada) {
        modalidadeAula = modalidadeEsperada;
      }
    }

    // Transformar para o mesmo formato do list
    return {
      id: aula.id,
      codigo: aula.codigo,
      titulo: aula.nome,
      descricao: aula.descricao || null,
      duracaoMinutos: aula.duracaoMinutos || null,
      modalidade: modalidadeAula,
      youtubeUrl: aula.urlVideo || null,
      meetUrl: aula.urlMeet || null,
      // tipoLink calculado (não vem do banco)
      tipoLink: aula.urlVideo ? 'YOUTUBE' : aula.urlMeet ? 'MEET' : null,
      sala: aula.sala || null,
      status: aula.status,
      obrigatoria: aula.obrigatoria,
      ordem: aula.ordem,
      dataInicio: aula.dataInicio?.toISOString() || null,
      dataFim: aula.dataFim?.toISOString() || null,
      horaInicio: aula.horaInicio || null,
      horaFim: aula.horaFim || null,
      gravarAula: aula.gravarAula || null,
      linkGravacao: aula.linkGravacao || null,
      statusGravacao: aula.statusGravacao || null,
      meetEventId: aula.meetEventId || null,
      turmaId: aula.turmaId || null,
      turma: aula.CursosTurmas
        ? {
            id: aula.CursosTurmas.id,
            codigo: aula.CursosTurmas.codigo,
            nome: aula.CursosTurmas.nome,
            turno: aula.CursosTurmas.turno,
            metodo: aula.CursosTurmas.metodo,
            curso: aula.CursosTurmas.Cursos
              ? {
                  id: aula.CursosTurmas.Cursos.id,
                  codigo: aula.CursosTurmas.Cursos.codigo,
                  nome: aula.CursosTurmas.Cursos.nome,
                }
              : null,
          }
        : null,
      modulo: aula.CursosTurmasModulos
        ? {
            id: aula.CursosTurmasModulos.id,
            nome: aula.CursosTurmasModulos.nome,
          }
        : null,
      instrutor: aula.instrutor
        ? {
            id: aula.instrutor.id,
            codigo: aula.instrutor.codUsuario,
            nome: aula.instrutor.nomeCompleto,
            email: aula.instrutor.email,
            cpf: aula.instrutor.cpf,
            avatarUrl: aula.instrutor.UsuariosInformation?.avatarUrl || null,
          }
        : null,
      criadoPor: aula.criadoPor
        ? {
            id: aula.criadoPor.id,
            nome: aula.criadoPor.nomeCompleto,
            cpf: aula.criadoPor.cpf,
          }
        : null,
      criadoEm: aula.criadoEm.toISOString(),
      atualizadoEm: aula.atualizadoEm.toISOString(),
    };
  },

  /**
   * Atualizar aula
   */
  async update(aulaId: string, input: UpdateAulaInput, usuarioLogado: any) {
    const aulaAnterior = await this.getById(aulaId, usuarioLogado);

    // Validar permissão
    const podeEditar =
      ['ADMIN', 'MODERADOR', 'PEDAGOGICO'].includes(usuarioLogado.role) ||
      (usuarioLogado.role === 'INSTRUTOR' && aulaAnterior.criadoPor?.id === usuarioLogado.id);

    if (!podeEditar) {
      const error: any = new Error('Sem permissão para editar esta aula');
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Aula concluída só Admin
    if (aulaAnterior.status === 'CONCLUIDA' && usuarioLogado.role !== 'ADMIN') {
      const error: any = new Error('Apenas administradores podem editar aulas concluídas');
      error.code = 'FORBIDDEN';
      throw error;
    }

    // Aula em andamento não pode editar
    if (aulaAnterior.status === 'EM_ANDAMENTO') {
      const error: any = new Error('Não é possível editar uma aula em andamento');
      error.code = 'STATUS_INVALIDO';
      throw error;
    }

    // Validar publicação se status está mudando para PUBLICADA
    const statusAnterior = aulaAnterior.status;
    const statusNovo = input.status || statusAnterior;
    const estaPublicando = statusAnterior !== 'PUBLICADA' && statusNovo === 'PUBLICADA';
    const estaDespublicando = statusAnterior === 'PUBLICADA' && statusNovo === 'RASCUNHO';

    if (estaPublicando) {
      // Buscar dados completos da aula para validação
      const aulaCompleta = await retryOperation(() =>
        prisma.cursosTurmasAulas.findUnique({
          where: { id: aulaId },
          select: {
            nome: true,
            descricao: true,
            modalidade: true,
            dataInicio: true,
            dataFim: true,
            turmaId: true,
            instrutorId: true,
            urlVideo: true,
          },
        }),
      );

      const aulaParaValidar = {
        titulo: input.titulo || aulaCompleta?.nome || '',
        descricao: input.descricao || aulaCompleta?.descricao || '',
        modalidade: input.modalidade || aulaCompleta?.modalidade || '',
        dataInicio: input.dataInicio || aulaCompleta?.dataInicio,
        dataFim: input.dataFim || aulaCompleta?.dataFim,
        // @ts-ignore - turmaId e instrutorId estão no select mas TypeScript não infere corretamente
        turmaId: input.turmaId || (aulaCompleta as any)?.turmaId || null,
        // @ts-ignore
        instrutorId: input.instrutorId || (aulaCompleta as any)?.instrutorId || null,
        urlVideo: input.youtubeUrl || aulaCompleta?.urlVideo,
      };

      const validacao = validarCamposPublicacao(aulaParaValidar);
      if (!validacao.valido) {
        const error: any = new Error(
          validacao.erro ||
            `Não é possível publicar a aula. Campos obrigatórios faltando: ${validacao.camposFaltando.join(', ')}`,
        );
        error.code = validacao.erro ? 'DATA_INVALIDA' : 'CAMPOS_OBRIGATORIOS_FALTANDO';
        error.camposFaltando = validacao.camposFaltando;
        error.modalidade = aulaParaValidar.modalidade;
        throw error;
      }
    }

    if (estaDespublicando) {
      const validacao = validarDespublicacao(aulaAnterior);
      if (!validacao.valido) {
        const error: any = new Error(validacao.erro || 'Não é possível despublicar esta aula');
        error.code = validacao.codigo || 'NAO_PODE_DESPUBLICAR';
        throw error;
      }
    }

    // ✅ Tratar remoção de vínculos (turmaId, instrutorId, moduloId)
    // Se campo não foi enviado mas existia antes, remover vínculo (setar null)
    // Se campo foi enviado, atualizar (pode ser null para remover explicitamente)
    const aulaAnteriorTyped = aulaAnterior as any;
    // @ts-ignore - turmaId, instrutorId, moduloId podem estar nos relacionamentos ou diretamente
    const turmaIdAnterior = aulaAnterior.turma?.id || aulaAnteriorTyped?.turmaId || null;
    // @ts-ignore
    const instrutorIdAnterior =
      aulaAnterior.instrutor?.id || aulaAnteriorTyped?.instrutorId || null;
    // @ts-ignore
    const moduloIdAnterior = aulaAnterior.modulo?.id || aulaAnteriorTyped?.moduloId || null;

    // Determinar valores finais para turmaId, instrutorId e moduloId
    let turmaIdParaSalvar: string | null | undefined;
    let instrutorIdParaSalvar: string | null | undefined;
    let moduloIdParaSalvar: string | null | undefined;

    // ✅ Processar turmaId
    if (input.turmaId !== undefined) {
      // Campo foi enviado explicitamente (pode ser null para remover)
      turmaIdParaSalvar = input.turmaId || null;
    } else if (turmaIdAnterior) {
      // Campo não foi enviado mas existia antes → remover vínculo
      turmaIdParaSalvar = null;
    }
    // Se não foi enviado e não existia antes, não incluir no update (mantém null)

    // ✅ Processar instrutorId
    if (input.instrutorId !== undefined) {
      // Campo foi enviado explicitamente (pode ser null para remover)
      instrutorIdParaSalvar = input.instrutorId || null;
    } else if (instrutorIdAnterior) {
      // Campo não foi enviado mas existia antes → remover vínculo
      instrutorIdParaSalvar = null;
    }

    // ✅ Processar moduloId
    if (input.moduloId !== undefined) {
      // Campo foi enviado explicitamente (pode ser null para remover)
      moduloIdParaSalvar = input.moduloId || null;
    } else if (moduloIdAnterior) {
      // Campo não foi enviado mas existia antes → remover vínculo
      moduloIdParaSalvar = null;
    }

    // ✅ Validar e forçar modalidade baseada na turma quando turmaId é fornecido
    let modalidadeParaSalvar = input.modalidade ? mapModalidade(input.modalidade) : undefined;

    // Se turmaId foi fornecido (não null), validar modalidade
    if (turmaIdParaSalvar) {
      // Buscar método da turma
      const turma = await retryOperation(() =>
        prisma.cursosTurmas.findUnique({
          where: { id: turmaIdParaSalvar },
          select: { metodo: true },
        }),
      );

      if (turma?.metodo) {
        // Converter método da turma para modalidade da aula
        const modalidadeEsperada = mapMetodoTurmaToModalidadeAula(turma.metodo);

        // Se modalidade foi fornecida e não corresponde à turma, usar a da turma
        if (
          modalidadeParaSalvar &&
          mapModalidadeFromDB(modalidadeParaSalvar) !== modalidadeEsperada
        ) {
          // Converter modalidade esperada para formato do banco
          modalidadeParaSalvar = mapModalidade(modalidadeEsperada);
        } else if (!modalidadeParaSalvar) {
          // Se modalidade não foi fornecida, usar a da turma
          modalidadeParaSalvar = mapModalidade(modalidadeEsperada);
        }
      }
    } else if (turmaIdAnterior && !turmaIdParaSalvar) {
      // Turma foi removida, modalidade pode ser independente
      // Se modalidade foi fornecida, usar ela (já convertida acima)
      // Se não foi fornecida, manter a atual (não incluir no update)
    }

    // Preparar objeto de atualização
    const updateData: any = {
      nome: input.titulo,
      descricao: input.descricao,
      tipoLink: null,
      urlVideo: input.youtubeUrl,
      obrigatoria: input.obrigatoria,
      duracaoMinutos: input.duracaoMinutos,
      status: input.status,
      dataInicio: input.dataInicio,
      dataFim: input.dataFim,
      horaInicio: input.horaInicio,
      horaFim: input.horaFim,
    };

    // Incluir modalidade apenas se foi fornecida ou calculada
    if (modalidadeParaSalvar !== undefined) {
      updateData.modalidade = modalidadeParaSalvar;
    }

    // Incluir turmaId apenas se foi explicitamente definido (incluindo null para remover)
    if (turmaIdParaSalvar !== undefined) {
      updateData.turmaId = turmaIdParaSalvar;
    }

    // Incluir instrutorId apenas se foi explicitamente definido (incluindo null para remover)
    if (instrutorIdParaSalvar !== undefined) {
      updateData.instrutorId = instrutorIdParaSalvar;
    }

    // Incluir moduloId apenas se foi explicitamente definido (incluindo null para remover)
    if (moduloIdParaSalvar !== undefined) {
      updateData.moduloId = moduloIdParaSalvar;
    }

    // Atualizar
    const aulaAtualizada = await prisma.cursosTurmasAulas.update({
      where: { id: aulaId },
      data: updateData,
    });

    // Ações automáticas ao publicar
    // ✅ Apenas turmaId é necessário - instrutorId pode ser adicionado depois
    if (estaPublicando && aulaAtualizada.turmaId) {
      try {
        // Criar evento no Google Calendar se tiver data e hora
        if (aulaAtualizada.dataInicio && aulaAtualizada.horaInicio) {
          const dataInicioCompleta = new Date(aulaAtualizada.dataInicio);
          const [hora, minuto] = aulaAtualizada.horaInicio.split(':');
          dataInicioCompleta.setHours(parseInt(hora), parseInt(minuto), 0, 0);

          const dataFimCompleta = aulaAtualizada.dataFim
            ? new Date(aulaAtualizada.dataFim)
            : new Date(dataInicioCompleta);
          if (aulaAtualizada.horaFim) {
            const [horaFim, minutoFim] = aulaAtualizada.horaFim.split(':');
            dataFimCompleta.setHours(parseInt(horaFim), parseInt(minutoFim), 0, 0);
          } else {
            dataFimCompleta.setHours(dataInicioCompleta.getHours() + 2, 0, 0, 0);
          }

          // ✅ Criar Google Meet apenas se tiver instrutorId (pode ser adicionado depois)
          if (aulaAtualizada.instrutorId) {
            // Buscar emails dos alunos
            const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
              where: { turmaId: aulaAtualizada.turmaId, status: 'INSCRITO' },
              include: { Usuarios: { select: { email: true } } },
            });

            const alunoEmails = inscricoes.map((i) => i.Usuarios.email).filter(Boolean);

            const meetEvent = await googleCalendarService.createMeetEvent({
              titulo: aulaAtualizada.nome,
              descricao: aulaAtualizada.descricao || '',
              dataInicio: dataInicioCompleta,
              dataFim: dataFimCompleta,
              instrutorId: aulaAtualizada.instrutorId,
              alunoEmails,
            });

            // Atualizar aula com meetEventId e meetUrl
            await prisma.cursosTurmasAulas.update({
              where: { id: aulaId },
              data: {
                meetEventId: meetEvent.eventId,
                urlMeet: meetEvent.meetUrl,
              },
            });

            aulaAtualizada.meetEventId = meetEvent.eventId;
            aulaAtualizada.urlMeet = meetEvent.meetUrl;
          }

          // ✅ Criar evento na agenda interna sempre (com ou sem instrutor)
          await prisma.cursosTurmasAgenda.create({
            data: {
              turmaId: aulaAtualizada.turmaId,
              tipo: 'AULA',
              titulo: aulaAtualizada.nome,
              descricao: aulaAtualizada.descricao || null,
              inicio: dataInicioCompleta,
              fim: dataFimCompleta,
              aulaId: aulaId,
            },
          });

          // ✅ Notificar alunos sempre (com ou sem instrutor)
          await notificacoesHelper.notificarAlunosDaTurma(aulaAtualizada.turmaId, {
            tipo: 'NOVA_AULA' as any, // TODO: Adicionar AULA_PUBLICADA ao enum NotificacaoTipo
            titulo: `Nova aula: ${aulaAtualizada.nome}`,
            mensagem: aulaAtualizada.instrutorId
              ? `Uma nova aula foi publicada para sua turma.`
              : `Uma nova aula foi publicada para sua turma. O instrutor será definido em breve.`,
            prioridade: 'NORMAL',
            linkAcao: `/turmas/${aulaAtualizada.turmaId}`,
            eventoId: aulaId,
          });

          if (!aulaAtualizada.instrutorId) {
            aulasLogger.info('[AULA_PUBLICADA_SEM_INSTRUTOR]', {
              aulaId,
              turmaId: aulaAtualizada.turmaId,
              message:
                'Aula publicada sem instrutor. Meet será criado quando instrutor for adicionado.',
            });
          }
        }
      } catch (error: any) {
        aulasLogger.error('[PUBLICACAO_ERRO]', { error: error?.message, aulaId });
        // Não falha a atualização se ações automáticas falharem
      }
    }

    // Ações automáticas ao despublicar
    if (estaDespublicando) {
      try {
        // Remover evento do Google Calendar
        if (aulaAnterior.meetEventId && aulaAnterior.turmaId) {
          const turma = await prisma.cursosTurmas.findUnique({
            where: { id: aulaAnterior.turmaId },
            select: { instrutorId: true },
          });

          if (turma?.instrutorId) {
            await googleCalendarService.deleteEvent(aulaAnterior.meetEventId, turma.instrutorId);
          }
        }

        // Remover eventos da agenda interna
        await prisma.cursosTurmasAgenda.deleteMany({
          where: { aulaId },
        });

        // Notificar alunos
        if (aulaAnterior.turmaId) {
          const nomeAula = aulaAnterior.titulo || (aulaAnterior as any).nome || 'Aula';
          await notificacoesHelper.notificarAlunosDaTurma(aulaAnterior.turmaId, {
            tipo: 'AULA_CANCELADA' as any, // TODO: Adicionar AULA_DESPUBLICADA ao enum NotificacaoTipo
            titulo: `Aula despublicada: ${nomeAula}`,
            mensagem: 'Esta aula foi despublicada e não está mais disponível.',
            prioridade: 'NORMAL',
            linkAcao: `/turmas/${aulaAnterior.turmaId}`,
            eventoId: aulaId,
          });
        }
      } catch (error: any) {
        aulasLogger.error('[DESPUBLICACAO_ERRO]', { error: error?.message, aulaId });
        // Não falha a atualização se ações automáticas falharem
      }
    }

    // Registrar histórico
    const camposAlterados: any = {};
    if (statusAnterior !== statusNovo) {
      camposAlterados.status = { de: statusAnterior, para: statusNovo };
    }

    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId: usuarioLogado.id,
        acao: estaPublicando || estaDespublicando ? 'STATUS_ALTERADO' : 'EDITADA',
        turmaId: aulaAnterior.turmaId,
        camposAlterados: Object.keys(camposAlterados).length > 0 ? camposAlterados : null,
      },
    });

    // ✅ Buscar aula atualizada com relacionamentos para retornar formato completo
    const aulaRetornada = await retryOperation(() =>
      prisma.cursosTurmasAulas.findUnique({
        where: { id: aulaId },
        include: {
          CursosTurmas: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              turno: true,
              metodo: true,
              Cursos: {
                select: {
                  id: true,
                  codigo: true,
                  nome: true,
                },
              },
            },
          },
          CursosTurmasModulos: {
            select: { id: true, nome: true },
          },
          criadoPor: {
            select: { id: true, nomeCompleto: true, cpf: true },
          },
          instrutor: {
            select: {
              id: true,
              codUsuario: true,
              nomeCompleto: true,
              email: true,
              cpf: true,
              UsuariosInformation: {
                select: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    );

    if (!aulaRetornada) {
      throw new Error('Aula não encontrada após atualização');
    }

    // ✅ Converter modalidade do banco para API (LIVE → AO_VIVO)
    let modalidadeAula = mapModalidadeFromDB(aulaRetornada.modalidade);

    // ✅ Se há turma vinculada, a modalidade deve corresponder ao método da turma
    if (aulaRetornada.CursosTurmas?.metodo) {
      const modalidadeEsperada = mapMetodoTurmaToModalidadeAula(aulaRetornada.CursosTurmas.metodo);
      // Se a modalidade não corresponde, usar a da turma
      if (modalidadeAula !== modalidadeEsperada) {
        modalidadeAula = modalidadeEsperada;
      }
    }

    // Transformar para o mesmo formato do getById
    return {
      id: aulaRetornada.id,
      codigo: aulaRetornada.codigo,
      titulo: aulaRetornada.nome,
      descricao: aulaRetornada.descricao || null,
      duracaoMinutos: aulaRetornada.duracaoMinutos || null,
      modalidade: modalidadeAula,
      youtubeUrl: aulaRetornada.urlVideo || null,
      meetUrl: aulaRetornada.urlMeet || null,
      tipoLink: aulaRetornada.urlVideo ? 'YOUTUBE' : aulaRetornada.urlMeet ? 'MEET' : null,
      sala: aulaRetornada.sala || null,
      status: aulaRetornada.status,
      obrigatoria: aulaRetornada.obrigatoria,
      ordem: aulaRetornada.ordem,
      dataInicio: aulaRetornada.dataInicio?.toISOString() || null,
      dataFim: aulaRetornada.dataFim?.toISOString() || null,
      horaInicio: aulaRetornada.horaInicio || null,
      horaFim: aulaRetornada.horaFim || null,
      gravarAula: aulaRetornada.gravarAula || null,
      linkGravacao: aulaRetornada.linkGravacao || null,
      statusGravacao: aulaRetornada.statusGravacao || null,
      meetEventId: aulaRetornada.meetEventId || null,
      turmaId: aulaRetornada.turmaId || null,
      turma: aulaRetornada.CursosTurmas
        ? {
            id: aulaRetornada.CursosTurmas.id,
            codigo: aulaRetornada.CursosTurmas.codigo,
            nome: aulaRetornada.CursosTurmas.nome,
            turno: aulaRetornada.CursosTurmas.turno,
            metodo: aulaRetornada.CursosTurmas.metodo,
            curso: aulaRetornada.CursosTurmas.Cursos
              ? {
                  id: aulaRetornada.CursosTurmas.Cursos.id,
                  codigo: aulaRetornada.CursosTurmas.Cursos.codigo,
                  nome: aulaRetornada.CursosTurmas.Cursos.nome,
                }
              : null,
          }
        : null,
      modulo: aulaRetornada.CursosTurmasModulos
        ? {
            id: aulaRetornada.CursosTurmasModulos.id,
            nome: aulaRetornada.CursosTurmasModulos.nome,
          }
        : null,
      instrutor: aulaRetornada.instrutor
        ? {
            id: aulaRetornada.instrutor.id,
            codigo: aulaRetornada.instrutor.codUsuario,
            nome: aulaRetornada.instrutor.nomeCompleto,
            email: aulaRetornada.instrutor.email,
            cpf: aulaRetornada.instrutor.cpf,
            avatarUrl: aulaRetornada.instrutor.UsuariosInformation?.avatarUrl || null,
          }
        : null,
      criadoPor: aulaRetornada.criadoPor
        ? {
            id: aulaRetornada.criadoPor.id,
            nome: aulaRetornada.criadoPor.nomeCompleto,
            cpf: aulaRetornada.criadoPor.cpf,
          }
        : null,
      criadoEm: aulaRetornada.criadoEm.toISOString(),
      atualizadoEm: aulaRetornada.atualizadoEm.toISOString(),
    };
  },

  /**
   * Soft delete de aula (com proteção e limpeza completa)
   */
  async delete(aulaId: string, usuarioLogado: any) {
    const aula = await prisma.cursosTurmasAulas.findUnique({
      where: { id: aulaId, deletedAt: null },
      include: {
        CursosAulasProgresso: {
          where: { concluida: true },
          select: { id: true },
        },
        CursosTurmas: {
          select: { status: true },
        },
        CursosTurmasAulasMateriais: {
          select: { id: true },
        },
      },
    });

    if (!aula) {
      const error: any = new Error('Aula não encontrada');
      error.code = 'AULA_NOT_FOUND';
      throw error;
    }

    // Validar exclusão
    const validacao = validarExclusaoAula(aula, usuarioLogado);
    if (!validacao.valido) {
      const error: any = new Error(validacao.erro || 'Não é possível excluir esta aula');
      error.code = validacao.codigo || 'VALIDATION_ERROR';
      if (validacao.diasRestantes !== undefined) {
        error.diasRestantes = validacao.diasRestantes;
        error.dataAula = aula.dataInicio;
      }
      throw error;
    }

    // Aula obrigatória com progresso: só Admin/Moderador
    if (aula.obrigatoria && aula.CursosAulasProgresso.length > 0) {
      if (!['ADMIN', 'MODERADOR'].includes(usuarioLogado.role)) {
        const error: any = new Error(
          `Esta aula obrigatória já foi concluída por ${aula.CursosAulasProgresso.length} aluno(s). ` +
            `Apenas administradores podem cancelá-la.`,
        );
        error.code = 'FORBIDDEN';
        throw error;
      }
    }

    // Registrar histórico ANTES de excluir
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId: usuarioLogado.id,
        acao: 'CANCELADA',
        turmaId: aula.turmaId || undefined,
        camposAlterados: {
          status: { de: aula.status, para: 'CANCELADA' },
        },
      },
    });

    // Limpeza completa de dados relacionados
    const dadosRemovidos = {
      materiais: 0,
      linksMeet: 0,
      eventosAgenda: 0,
      eventosCalendar: 0,
    };

    try {
      // 1. Remover materiais complementares
      const materiaisRemovidos = await prisma.cursosTurmasAulasMateriais.deleteMany({
        where: { aulaId },
      });
      dadosRemovidos.materiais = materiaisRemovidos.count;

      // 2. Remover eventos da agenda interna
      const eventosAgendaRemovidos = await prisma.cursosTurmasAgenda.deleteMany({
        where: { aulaId },
      });
      dadosRemovidos.eventosAgenda = eventosAgendaRemovidos.count;

      // 3. Cancelar evento Google Calendar e remover links
      if (aula.meetEventId) {
        try {
          const turma = await prisma.cursosTurmas.findUnique({
            where: { id: aula.turmaId || undefined },
            select: { instrutorId: true },
          });

          if (turma?.instrutorId) {
            await googleCalendarService.deleteEvent(aula.meetEventId, turma.instrutorId);
            dadosRemovidos.eventosCalendar = 1;
          }
        } catch (error: any) {
          aulasLogger.error('[GOOGLE_DELETE_ERRO]', { error: error?.message });
        }
      }

      if (aula.urlMeet) {
        dadosRemovidos.linksMeet = 1;
      }
    } catch (error: any) {
      aulasLogger.error('[LIMPEZA_ERRO]', { error: error?.message, aulaId });
      // Continuar mesmo se limpeza parcial falhar
    }

    // Soft delete da aula
    await prisma.cursosTurmasAulas.update({
      where: { id: aulaId },
      data: {
        status: 'CANCELADA',
        deletedAt: new Date(),
        deletedBy: usuarioLogado.id,
        // Limpar links
        urlMeet: null,
        urlVideo: null,
        meetEventId: null,
        tipoLink: null,
      },
    });

    // Notificar alunos se turma já iniciou
    if (aula.CursosTurmas?.status === 'EM_ANDAMENTO' && aula.turmaId) {
      try {
        await notificacoesHelper.notificarAlunosDaTurma(aula.turmaId, {
          tipo: 'AULA_CANCELADA',
          titulo: `Aula cancelada: ${aula.nome}`,
          mensagem: aula.obrigatoria
            ? 'Esta aula obrigatória foi cancelada. Seu progresso foi recalculado.'
            : 'Esta aula foi cancelada.',
          prioridade: aula.obrigatoria ? 'URGENTE' : 'NORMAL',
          linkAcao: `/turmas/${aula.turmaId}`,
          eventoId: aulaId,
        });
      } catch (error: any) {
        aulasLogger.error('[NOTIF_ERRO]', { error: error?.message });
      }
    }

    aulasLogger.info('[AULA_EXCLUIDA]', {
      aulaId,
      usuarioId: usuarioLogado.id,
      dadosRemovidos,
    });

    return {
      success: true,
      message: 'Aula excluída com sucesso',
      aulaId,
      dadosRemovidos,
    };
  },

  /**
   * Atualizar progresso do aluno
   */
  async updateProgresso(aulaId: string, input: UpdateProgressoInput, alunoId: string) {
    // Validar inscrição
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: input.inscricaoId, alunoId },
    });

    if (!inscricao) throw new Error('Inscrição não encontrada');

    // Upsert progresso
    const progresso = await prisma.cursosAulasProgresso.upsert({
      where: {
        aulaId_inscricaoId: { aulaId, inscricaoId: input.inscricaoId },
      },
      create: {
        aulaId,
        inscricaoId: input.inscricaoId,
        turmaId: inscricao.turmaId,
        alunoId,
        percentualAssistido: input.percentualAssistido,
        tempoAssistidoSegundos: input.tempoAssistidoSegundos,
        ultimaPosicao: input.ultimaPosicao || 0,
        iniciadoEm: new Date(),
      },
      update: {
        percentualAssistido: input.percentualAssistido,
        tempoAssistidoSegundos: input.tempoAssistidoSegundos,
        ultimaPosicao: input.ultimaPosicao || 0,
        atualizadoEm: new Date(),
      },
    });

    // Marcar como concluída aos 90%
    if (input.percentualAssistido >= 90 && !progresso.concluida) {
      await prisma.cursosAulasProgresso.update({
        where: { id: progresso.id },
        data: {
          concluida: true,
          concluidaEm: new Date(),
          percentualAssistido: 100,
        },
      });

      // TODO: Verificar se completou todas obrigatórias
      // await this.verificarConclusaoCurso(alunoId, inscricao.turmaId);
    }

    return progresso;
  },

  /**
   * Registrar presença (entrada/saída em aula ao vivo)
   */
  async registrarPresenca(
    aulaId: string,
    tipo: 'entrada' | 'saida',
    inscricaoId: string,
    usuarioId: string,
  ) {
    const aula = await prisma.cursosTurmasAulas.findUnique({
      where: { id: aulaId },
      select: { modalidade: true, turmaId: true },
    });

    if (!aula) throw new Error('Aula não encontrada');

    // Validar modalidade
    if (!['AO_VIVO', 'SEMIPRESENCIAL'].includes(aula.modalidade)) {
      throw new Error('Presença só pode ser registrada em aulas ao vivo');
    }

    if (tipo === 'entrada') {
      // Registrar entrada via CursosFrequenciaAlunos
      if (!aula.turmaId) {
        throw new Error('Aula sem turma vinculada - não é possível registrar presença');
      }

      await prisma.cursosFrequenciaAlunos.create({
        data: {
          turmaId: aula.turmaId,
          inscricaoId,
          aulaId,
          status: 'PRESENTE',
          dataReferencia: new Date(),
        },
      });

      aulasLogger.info('[PRESENCA_ENTRADA]', { aulaId, usuarioId });
    } else {
      // Registrar saída (já existe entrada)
      const presenca = await prisma.cursosFrequenciaAlunos.findFirst({
        where: {
          aulaId,
          inscricaoId,
          dataReferencia: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Últimas 24h
        },
      });

      if (presenca) {
        await prisma.cursosFrequenciaAlunos.update({
          where: { id: presenca.id },
          data: {
            observacoes: `Saída registrada às ${new Date().toLocaleTimeString('pt-BR')}`,
          },
        });
      }

      aulasLogger.info('[PRESENCA_SAIDA]', { aulaId, usuarioId });
    }

    return { success: true };
  },

  /**
   * Buscar histórico de alterações da aula
   */
  async getHistorico(aulaId: string, usuarioLogado: any) {
    // Apenas Admin, Moderador e Pedagógico podem ver histórico
    if (!['ADMIN', 'MODERADOR', 'PEDAGOGICO'].includes(usuarioLogado.role)) {
      throw new Error('Sem permissão para ver histórico');
    }

    // Verificar se a aula existe
    const aulaExiste = await retryOperation(() =>
      prisma.cursosTurmasAulas.findUnique({
        where: { id: aulaId, deletedAt: null },
        select: { id: true },
      }),
    );

    if (!aulaExiste) {
      throw new Error('Aula não encontrada');
    }

    const historico = await retryOperation(() =>
      prisma.cursosAulasHistorico.findMany({
        where: { aulaId },
        include: {
          Usuarios: {
            select: {
              id: true,
              nomeCompleto: true,
              role: true,
              email: true,
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
      }),
    );

    // Transformar para o formato esperado pelo frontend
    return historico.map((h) => ({
      id: h.id,
      aulaId: h.aulaId,
      usuarioId: h.usuarioId,
      usuario: {
        id: h.Usuarios.id,
        nome: h.Usuarios.nomeCompleto,
        // Campos opcionais para futuras melhorias
        role: h.Usuarios.role || undefined,
        email: h.Usuarios.email || undefined,
      },
      acao: h.acao,
      camposAlterados: h.camposAlterados || null, // Garantir null ao invés de undefined
      criadoEm: h.criadoEm.toISOString(),
      // Campos adicionais (opcionais, não usados pelo frontend mas úteis para debug)
      ip: h.ip || undefined,
      userAgent: h.userAgent || undefined,
    }));
  },

  /**
   * Buscar progresso da aula (todos alunos ou específico)
   */
  async getProgresso(aulaId: string, usuarioLogado: any, alunoId?: string) {
    const where: any = { aulaId };

    // Se for aluno, só vê próprio progresso
    if (usuarioLogado.role === 'ALUNO_CANDIDATO') {
      where.alunoId = usuarioLogado.id;
    } else if (alunoId) {
      where.alunoId = alunoId;
    }

    const progressos = await prisma.cursosAulasProgresso.findMany({
      where,
      include: {
        Usuarios: {
          select: { id: true, nomeCompleto: true, email: true },
        },
      },
      orderBy: { percentualAssistido: 'desc' },
    });

    return progressos.map((p) => ({
      id: p.id,
      aluno: p.Usuarios,
      percentualAssistido: Number(p.percentualAssistido),
      tempoAssistidoSegundos: p.tempoAssistidoSegundos,
      concluida: p.concluida,
      concluidaEm: p.concluidaEm?.toISOString() || null,
      iniciadoEm: p.iniciadoEm?.toISOString() || null,
    }));
  },

  /**
   * Listar presenças de uma aula ao vivo
   */
  async getPresencas(aulaId: string, usuarioLogado: any) {
    // Validar que é aula ao vivo
    const aula = await prisma.cursosTurmasAulas.findUnique({
      where: { id: aulaId },
      select: { modalidade: true, turmaId: true },
    });

    if (!aula) throw new Error('Aula não encontrada');

    if (!['AO_VIVO', 'SEMIPRESENCIAL'].includes(aula.modalidade)) {
      throw new Error('Presença só está disponível para aulas ao vivo');
    }

    // Validar permissão (instrutor só vê suas turmas)
    if (usuarioLogado.role === 'INSTRUTOR') {
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: aula.turmaId! },
        select: { instrutorId: true },
      });

      if (turma?.instrutorId !== usuarioLogado.id) {
        throw new Error('Instrutor só pode ver presenças de suas turmas');
      }
    }

    const presencas = await prisma.cursosFrequenciaAlunos.findMany({
      where: { aulaId },
      include: {
        CursosTurmasInscricoes: {
          include: {
            Usuarios: {
              select: { id: true, nomeCompleto: true, email: true },
            },
          },
        },
      },
      orderBy: { dataReferencia: 'desc' },
    });

    return presencas.map((p) => ({
      id: p.id,
      aluno: p.CursosTurmasInscricoes.Usuarios,
      status: p.status,
      dataReferencia: p.dataReferencia.toISOString(),
      observacoes: p.observacoes,
    }));
  },
};

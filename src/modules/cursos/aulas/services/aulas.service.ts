import { prisma } from '@/config/prisma';
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

// Mapear modalidade do input para enum do banco
function mapModalidade(modalidade: string): any {
  const map: Record<string, string> = {
    ONLINE: 'ONLINE',
    PRESENCIAL: 'PRESENCIAL',
    AO_VIVO: 'LIVE',
    SEMIPRESENCIAL: 'SEMIPRESENCIAL',
  };
  return map[modalidade] || modalidade;
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
      turmaId,
      moduloId,
      modalidade,
      status,
      obrigatoria,
      search,
      orderBy,
      order,
    } = query;

    const where: Prisma.CursosTurmasAulasWhereInput = {
      deletedAt: null, // Não mostrar deletadas
    };

    // Filtro por role: INSTRUTOR vê apenas suas turmas
    if (usuarioLogado.role === 'INSTRUTOR') {
      const turmasDoInstrutor = await prisma.cursosTurmas.findMany({
        where: { instrutorId: usuarioLogado.id },
        select: { id: true },
      });
      where.turmaId = { in: turmasDoInstrutor.map((t) => t.id) };
    }

    // Filtros da query
    if (turmaId) where.turmaId = turmaId;
    if (moduloId) where.moduloId = moduloId;
    if (modalidade) where.modalidade = { in: modalidade.split(',') as any };
    if (status) where.status = { in: status.split(',') as any };
    if (obrigatoria !== undefined) where.obrigatoria = obrigatoria;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, aulas] = await Promise.all([
      prisma.cursosTurmasAulas.count({ where }),
      prisma.cursosTurmasAulas.findMany({
        where,
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
        orderBy: { [orderBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: aulas.map((a) => ({
        id: a.id,
        codigo: a.codigo,
        titulo: a.nome,
        descricao: a.descricao || null,
        duracaoMinutos: a.duracaoMinutos || null,
        modalidade: a.modalidade,
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
      })),
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

      // Calcular horaFim se não fornecida
      if (input.horaFim) {
        horaFimCalculada = input.horaFim;
        const [hoursF, minutesF] = input.horaFim.split(':');
        dataFimCompleta = new Date(`${input.dataInicio}T${hoursF}:${minutesF}:00.000Z`);
      } else if (input.duracaoMinutos) {
        // Calcular automaticamente
        dataFimCompleta = new Date(dataInicioCompleta.getTime() + input.duracaoMinutos * 60000);
        const h = dataFimCompleta.getHours().toString().padStart(2, '0');
        const m = dataFimCompleta.getMinutes().toString().padStart(2, '0');
        horaFimCalculada = `${h}:${m}`;
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

    // 3. Validar período dentro da turma (se aplicável e se turma foi fornecida)
    if (precisaPeriodo && input.dataInicio && input.dataFim && input.turmaId) {
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: input.turmaId },
        select: { dataInicio: true, dataFim: true, status: true },
      });

      if (!turma) throw new Error('Turma não encontrada');

      if (turma.dataInicio && input.dataInicio && new Date(input.dataInicio) < turma.dataInicio) {
        throw new Error('Aula não pode começar antes do início da turma');
      }

      if (turma.dataFim && input.dataFim && new Date(input.dataFim) > turma.dataFim) {
        throw new Error('Aula não pode terminar após o fim da turma');
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
        status: input.status ?? 'RASCUNHO',
        dataInicio: dataInicioCompleta,
        dataFim: dataFimCompleta,
        horaInicio: input.horaInicio || null,
        horaFim: horaFimCalculada,
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
    if (
      (input.modalidade === 'AO_VIVO' ||
        (input.modalidade === 'SEMIPRESENCIAL' && input.tipoLink === 'MEET')) &&
      input.dataInicio &&
      input.dataFim
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
          dataInicio: dataInicioCompleta!,
          dataFim: dataFimCompleta!,
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
    const aula = await prisma.cursosTurmasAulas.findUnique({
      where: { id: aulaId, deletedAt: null },
      include: {
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            Cursos: { select: { nome: true } },
          },
        },
        CursosTurmasModulos: {
          select: { id: true, nome: true },
        },
        criadoPor: {
          select: { id: true, nomeCompleto: true },
        },
      },
    });

    if (!aula) throw new Error('Aula não encontrada');

    // Validar permissão do instrutor
    if (usuarioLogado.role === 'INSTRUTOR') {
      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: aula.turmaId || undefined },
        select: { instrutorId: true },
      });

      if (turma?.instrutorId !== usuarioLogado.id) {
        throw new Error('Instrutor só pode acessar aulas de suas turmas');
      }
    }

    return aula;
  },

  /**
   * Atualizar aula
   */
  async update(aulaId: string, input: UpdateAulaInput, usuarioLogado: any) {
    const aulaAnterior = await this.getById(aulaId, usuarioLogado);

    // Validar permissão
    const podeEditar =
      ['ADMIN', 'MODERADOR', 'PEDAGOGICO'].includes(usuarioLogado.role) ||
      (usuarioLogado.role === 'INSTRUTOR' && aulaAnterior.criadoPorId === usuarioLogado.id);

    if (!podeEditar) {
      throw new Error('Sem permissão para editar esta aula');
    }

    // Aula concluída só Admin
    if (aulaAnterior.status === 'CONCLUIDA' && usuarioLogado.role !== 'ADMIN') {
      throw new Error('Apenas administradores podem editar aulas concluídas');
    }

    // Aula em andamento não pode editar
    if (aulaAnterior.status === 'EM_ANDAMENTO') {
      throw new Error('Não é possível editar uma aula em andamento');
    }

    // Atualizar
    const aulaAtualizada = await prisma.cursosTurmasAulas.update({
      where: { id: aulaId },
      data: {
        nome: input.titulo,
        descricao: input.descricao,
        modalidade: input.modalidade ? mapModalidade(input.modalidade) : undefined,
        tipoLink: null,
        urlVideo: input.youtubeUrl,
        obrigatoria: input.obrigatoria,
        duracaoMinutos: input.duracaoMinutos,
        status: input.status,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        horaInicio: input.horaInicio,
        horaFim: input.horaFim,
      },
    });

    // Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId: usuarioLogado.id,
        acao: 'EDITADA',
        turmaId: aulaAnterior.turmaId,
      },
    });

    return aulaAtualizada;
  },

  /**
   * Soft delete de aula (com proteção)
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
      },
    });

    if (!aula) throw new Error('Aula não encontrada');

    // Bloquear se EM_ANDAMENTO
    if (aula.status === 'EM_ANDAMENTO') {
      throw new Error('Não é possível remover uma aula em andamento');
    }

    // Aula obrigatória com progresso: só Admin/Moderador
    if (aula.obrigatoria && aula.CursosAulasProgresso.length > 0) {
      if (!['ADMIN', 'MODERADOR'].includes(usuarioLogado.role)) {
        throw new Error(
          `Esta aula obrigatória já foi concluída por ${aula.CursosAulasProgresso.length} aluno(s). ` +
            `Apenas administradores podem cancelá-la.`,
        );
      }
    }

    // Soft delete
    await prisma.cursosTurmasAulas.update({
      where: { id: aulaId },
      data: {
        status: 'CANCELADA',
        deletedAt: new Date(),
        deletedBy: usuarioLogado.id,
      },
    });

    // Registrar histórico
    await prisma.cursosAulasHistorico.create({
      data: {
        aulaId,
        usuarioId: usuarioLogado.id,
        acao: 'CANCELADA',
        turmaId: aula.turmaId || undefined,
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

    // Cancelar evento Google Calendar
    if (aula.meetEventId) {
      try {
        const turma = await prisma.cursosTurmas.findUnique({
          where: { id: aula.turmaId || undefined },
          select: { instrutorId: true },
        });

        if (turma?.instrutorId) {
          await googleCalendarService.deleteEvent(aula.meetEventId, turma.instrutorId);
        }
      } catch (error: any) {
        aulasLogger.error('[GOOGLE_DELETE_ERRO]', { error: error?.message });
      }
    }

    aulasLogger.info('[AULA_CANCELADA]', { aulaId, usuarioId: usuarioLogado.id });

    return { success: true, mensagem: 'Aula cancelada com sucesso' };
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

    const historico = await prisma.cursosAulasHistorico.findMany({
      where: { aulaId },
      include: {
        Usuarios: {
          select: { id: true, nomeCompleto: true, role: true },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    return historico.map((h) => ({
      id: h.id,
      acao: h.acao,
      camposAlterados: h.camposAlterados,
      usuario: h.Usuarios,
      ip: h.ip,
      criadoEm: h.criadoEm.toISOString(),
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

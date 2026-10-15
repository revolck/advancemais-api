import { google } from 'googleapis';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { googleOAuthService } from './google-oauth.service';
import { resolveOrganizadorId } from './meet-attendees.helper';
import crypto from 'crypto';

const calendarLogger = logger.child({ module: 'GoogleCalendar' });
const GOOGLE_MEET_URI_REGEX =
  /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:[/?#].*)?$/i;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extrai o código da sala (ex: "abc-defg-hij") de uma URL do Google Meet.
 * Usado para montar o nome de recurso "spaces/{code}" da Meet REST API.
 */
export const extractMeetingCodeFromUrl = (meetUrl: string | null | undefined): string | null => {
  if (!meetUrl) return null;
  const match = meetUrl.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return match ? match[1] : null;
};

const extractMeetUrlFromEvent = (event: any): string | null => {
  const hangoutLink = event?.hangoutLink?.trim();
  if (hangoutLink && GOOGLE_MEET_URI_REGEX.test(hangoutLink)) {
    return hangoutLink;
  }

  const entryPoints = event?.conferenceData?.entryPoints;
  if (!Array.isArray(entryPoints)) {
    return null;
  }

  const videoEntryPoint = entryPoints.find(
    (entry: any) =>
      entry?.entryPointType === 'video' &&
      typeof entry?.uri === 'string' &&
      GOOGLE_MEET_URI_REGEX.test(entry.uri.trim()),
  );

  return videoEntryPoint?.uri?.trim() ?? null;
};

/**
 * Service de integração Google Calendar + Meet
 */
export const googleCalendarService = {
  /**
   * Criar evento no Google Calendar + Sala Google Meet
   */
  async createMeetEvent(params: {
    titulo: string;
    descricao: string;
    dataInicio: Date;
    dataFim: Date;
    instrutorId: string;
    alunoEmails?: string[];
    /**
     * E-mails adicionados após a criação, via patch com sendUpdates:'none'
     * (ex: ADMIN/MODERADOR/PEDAGOGICO/institucionais) — não recebem e-mail de convite,
     * evitando ruído de agenda para uma lista potencialmente grande de gestores.
     */
    adicionaisSilenciosos?: string[];
    requestId?: string;
    externalReferenceId?: string;
  }): Promise<{ eventId: string; meetUrl: string }> {
    const oauth2Client = await googleOAuthService.getOAuth2Client(params.instrutorId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const event = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: params.titulo,
          description: params.descricao,
          start: {
            dateTime: params.dataInicio.toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: params.dataFim.toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          conferenceData: {
            createRequest: {
              requestId: params.requestId?.trim() || crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          extendedProperties: params.externalReferenceId
            ? {
                private: {
                  source: 'advancemais-entrevista',
                  externalReferenceId: params.externalReferenceId,
                },
              }
            : undefined,
          attendees: params.alunoEmails?.map((email) => ({ email })),
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 120 }, // 2h antes
              { method: 'popup', minutes: 15 }, // 15min antes
            ],
          },
          guestsCanModify: false,
          guestsCanInviteOthers: false,
          guestsCanSeeOtherGuests: true,
        },
      });

      const eventId = event.data.id!;
      let meetUrl = extractMeetUrlFromEvent(event.data);

      if (!meetUrl) {
        for (let attempt = 0; attempt < 5; attempt++) {
          await sleep(500);

          const refreshedEvent = await calendar.events.get({
            calendarId: 'primary',
            eventId,
          });

          meetUrl = extractMeetUrlFromEvent(refreshedEvent.data);
          if (meetUrl) {
            break;
          }
        }
      }

      if (!meetUrl) {
        throw new Error('Google não retornou uma URL válida do Meet para o evento criado.');
      }

      if (params.adicionaisSilenciosos?.length) {
        try {
          await calendar.events.patch({
            calendarId: 'primary',
            eventId,
            sendUpdates: 'none',
            requestBody: {
              // events.patch substitui a lista inteira de attendees — reenviar quem já foi convidado
              attendees: [
                ...(params.alunoEmails ?? []).map((email) => ({ email })),
                ...params.adicionaisSilenciosos.map((email) => ({ email })),
              ],
            },
          });
        } catch (error: any) {
          calendarLogger.warn('[MEET_ADICIONAIS_SILENCIOSOS_ERRO]', {
            eventId,
            error: error?.message,
          });
        }
      }

      calendarLogger.info('[MEET_CRIADO]', {
        eventId,
        titulo: params.titulo,
        instrutorId: params.instrutorId,
      });

      return { eventId, meetUrl };
    } catch (error: any) {
      calendarLogger.error('[MEET_ERRO]', {
        error: error?.message,
        instrutorId: params.instrutorId,
      });
      throw new Error(`Erro ao criar Google Meet: ${error?.message}`);
    }
  },

  /**
   * Atualizar evento no Google Calendar
   */
  async updateEvent(
    eventId: string,
    instrutorId: string,
    updates: {
      titulo?: string;
      descricao?: string;
      dataInicio?: Date;
      dataFim?: Date;
    },
  ) {
    const oauth2Client = await googleOAuthService.getOAuth2Client(instrutorId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const updateData: any = {};
    if (updates.titulo) updateData.summary = updates.titulo;
    if (updates.descricao) updateData.description = updates.descricao;
    if (updates.dataInicio) {
      updateData.start = {
        dateTime: updates.dataInicio.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
    }
    if (updates.dataFim) {
      updateData.end = {
        dateTime: updates.dataFim.toISOString(),
        timeZone: 'America/Sao_Paulo',
      };
    }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: updateData,
    });

    calendarLogger.info('[EVENTO_ATUALIZADO]', { eventId, instrutorId });
  },

  /**
   * Cancelar evento no Google Calendar
   */
  async deleteEvent(eventId: string, instrutorId: string) {
    const oauth2Client = await googleOAuthService.getOAuth2Client(instrutorId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    calendarLogger.info('[EVENTO_CANCELADO]', { eventId, instrutorId });
  },

  /**
   * Sincronizar aulas ao vivo existentes ao conectar Google
   */
  async sincronizarAulasExistentes(instrutorId: string) {
    // Buscar todas as aulas ao vivo futuras do instrutor
    const aulas = await prisma.cursosTurmasAulas.findMany({
      where: {
        CursosTurmas: {
          instrutorId,
        },
        modalidade: { in: ['LIVE', 'SEMIPRESENCIAL'] },
        tipoLink: 'MEET',
        dataInicio: { gte: new Date() },
        status: 'PUBLICADA',
        meetEventId: null, // Ainda não sincronizada
        deletedAt: null,
      },
      include: {
        CursosTurmas: {
          include: {
            CursosTurmasInscricoes: {
              where: { status: 'INSCRITO' },
              include: {
                Usuarios: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    let sincronizadas = 0;

    for (const aula of aulas) {
      try {
        const alunoEmails = (aula.CursosTurmas?.CursosTurmasInscricoes || []).map(
          (i: any) => i.Usuarios.email,
        );

        const { eventId, meetUrl } = await this.createMeetEvent({
          titulo: aula.nome,
          descricao: aula.descricao || '',
          dataInicio: aula.dataInicio!,
          dataFim: aula.dataFim!,
          instrutorId,
          alunoEmails,
        });

        await prisma.cursosTurmasAulas.update({
          where: { id: aula.id },
          data: {
            meetEventId: eventId,
            urlMeet: meetUrl,
          },
        });

        sincronizadas++;
      } catch (error: any) {
        calendarLogger.error('[SYNC_ERRO]', {
          aulaId: aula.id,
          error: error?.message,
        });
      }
    }

    calendarLogger.info('[SYNC_COMPLETO]', {
      instrutorId,
      totalAulas: aulas.length,
      sincronizadas,
    });

    return { total: aulas.length, sincronizadas };
  },

  /**
   * Criar evento no Google Calendar (sem Meet) - para sincronização de alunos
   */
  async createCalendarEvent(params: {
    usuarioId: string;
    titulo: string;
    descricao: string;
    dataInicio: Date;
    dataFim: Date;
    location?: string;
    link?: string;
    /** Marca o evento com a turma, para achá-lo e apagá-lo se o aluno sair dela */
    marcador?: { turmaId: string; itemId: string };
  }): Promise<{ eventId: string }> {
    const oauth2Client = await googleOAuthService.getOAuth2Client(params.usuarioId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: params.titulo,
          description: params.descricao + (params.link ? `\n\nLink: ${params.link}` : ''),
          location: params.location,
          start: {
            dateTime: params.dataInicio.toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: params.dataFim.toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 120 }, // 2h antes
              { method: 'popup', minutes: 15 }, // 15min antes
            ],
          },
          ...(params.marcador
            ? {
                extendedProperties: {
                  private: {
                    advanceTurmaId: params.marcador.turmaId,
                    advanceItemId: params.marcador.itemId,
                  },
                },
              }
            : {}),
        },
      });

      const eventId = event.data.id!;

      calendarLogger.info('[CALENDAR_EVENT_CRIADO]', {
        eventId,
        titulo: params.titulo,
        usuarioId: params.usuarioId,
      });

      return { eventId };
    } catch (error: any) {
      calendarLogger.error('[CALENDAR_EVENT_ERRO]', {
        error: error?.message,
        usuarioId: params.usuarioId,
      });
      throw new Error(`Erro ao criar evento no Google Calendar: ${error?.message}`);
    }
  },

  /**
   * Põe ou tira o aluno da lista de convidados das salas do Meet das aulas e provas
   * futuras da turma (eventos do instrutor organizador). Sem e-mail de aviso do Google.
   * events.patch substitui a lista inteira: lê a lista atual e devolve com o ajuste.
   */
  async ajustarConviteDoAluno(params: {
    alunoId: string;
    turmaId: string;
    acao: 'adicionar' | 'remover';
  }): Promise<{ alterados: number; erros: number }> {
    const aluno = await prisma.usuarios.findUnique({
      where: { id: params.alunoId },
      select: { email: true },
    });
    if (!aluno?.email) return { alterados: 0, erros: 0 };
    const email = aluno.email.trim().toLowerCase();

    const agora = new Date();
    const futuro = {
      OR: [{ dataFim: { gte: agora } }, { dataFim: null, dataInicio: { gte: agora } }],
    };
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: params.turmaId },
      select: {
        instrutorId: true,
        CursosTurmasInstrutores: { select: { instrutorId: true } },
        CursosTurmasAulas: {
          where: { meetEventId: { not: null }, deletedAt: null, ...futuro },
          select: { id: true, meetEventId: true, instrutorId: true },
        },
        CursosTurmasProvas: {
          where: { meetEventId: { not: null }, ativo: true, ...futuro },
          select: { id: true, meetEventId: true, instrutorId: true },
        },
      },
    });
    if (!turma) return { alterados: 0, erros: 0 };

    const clientes = new Map<string, ReturnType<typeof google.calendar>>();
    const agendaDo = async (organizadorId: string) => {
      if (!clientes.has(organizadorId)) {
        const auth = await googleOAuthService.getOAuth2Client(organizadorId);
        clientes.set(organizadorId, google.calendar({ version: 'v3', auth }));
      }
      return clientes.get(organizadorId)!;
    };

    let alterados = 0;
    let erros = 0;
    for (const item of [...turma.CursosTurmasAulas, ...turma.CursosTurmasProvas]) {
      const organizadorId = resolveOrganizadorId(item.instrutorId, turma);
      if (!organizadorId || !item.meetEventId) continue;
      try {
        const calendar = await agendaDo(organizadorId);
        const { data } = await calendar.events.get({
          calendarId: 'primary',
          eventId: item.meetEventId,
        });
        const convidados = data.attendees ?? [];
        const jaConvidado = convidados.some((c) => c.email?.trim().toLowerCase() === email);
        if (params.acao === 'remover' ? !jaConvidado : jaConvidado) continue;

        await calendar.events.patch({
          calendarId: 'primary',
          eventId: item.meetEventId,
          sendUpdates: 'none',
          requestBody: {
            attendees:
              params.acao === 'remover'
                ? convidados.filter((c) => c.email?.trim().toLowerCase() !== email)
                : [...convidados, { email: aluno.email }],
          },
        });
        alterados++;
      } catch (error: any) {
        erros++;
        calendarLogger.warn('[CONVITE_ALUNO_ERRO]', {
          acao: params.acao,
          itemId: item.id,
          turmaId: params.turmaId,
          alunoId: params.alunoId,
          error: error?.message,
        });
      }
    }
    return { alterados, erros };
  },

  /**
   * Apaga da agenda do aluno (Google conectado) os eventos futuros que a plataforma criou
   * para a turma: os marcados com a turma e, dos antigos sem marcador, os criados pelo
   * próprio aluno com o mesmo título e horário de uma aula ou prova da turma.
   */
  async apagarEventosDoAluno(params: {
    alunoId: string;
    turmaId: string;
  }): Promise<{ apagados: number; erros: number }> {
    const aluno = await prisma.usuarios.findUnique({
      where: { id: params.alunoId },
      select: { googleAccessToken: true },
    });
    if (!aluno?.googleAccessToken) return { apagados: 0, erros: 0 };

    const agora = new Date();
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: params.turmaId },
      select: {
        CursosTurmasAulas: {
          where: { dataInicio: { gte: agora }, deletedAt: null },
          select: { nome: true, dataInicio: true, dataFim: true },
        },
        CursosTurmasProvas: {
          where: { dataInicio: { gte: agora } },
          select: { titulo: true, tipo: true, dataInicio: true, dataFim: true },
        },
      },
    });
    if (!turma) return { apagados: 0, erros: 0 };

    // Mesmos títulos usados em sincronizarAgendaAluno
    const esperados = new Set<string>();
    let fimDaJanela = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const esperar = (titulo: string, inicio: Date | null, fim: Date | null) => {
      if (!inicio) return;
      esperados.add(`${titulo}|${inicio.getTime()}`);
      const limite = fim ?? inicio;
      if (limite > fimDaJanela) fimDaJanela = new Date(limite.getTime() + 60 * 60 * 1000);
    };
    turma.CursosTurmasAulas.forEach((a) => esperar(`📚 ${a.nome}`, a.dataInicio, a.dataFim));
    turma.CursosTurmasProvas.forEach((p) =>
      esperar(
        `${p.tipo === 'PROVA' ? '📝 Prova' : '📋 Atividade'}: ${p.titulo}`,
        p.dataInicio,
        p.dataFim,
      ),
    );

    let apagados = 0;
    let erros = 0;
    try {
      const auth = await googleOAuthService.getOAuth2Client(params.alunoId);
      const calendar = google.calendar({ version: 'v3', auth });
      const paraApagar: string[] = [];
      let pageToken: string | undefined;
      do {
        const { data } = await calendar.events.list({
          calendarId: 'primary',
          timeMin: agora.toISOString(),
          timeMax: fimDaJanela.toISOString(),
          singleEvents: true,
          maxResults: 2500,
          pageToken,
        });
        for (const evento of data.items ?? []) {
          if (!evento.id) continue;
          const marcado = evento.extendedProperties?.private?.advanceTurmaId === params.turmaId;
          const inicio = evento.start?.dateTime ? new Date(evento.start.dateTime).getTime() : NaN;
          const antigo =
            evento.organizer?.self === true && esperados.has(`${evento.summary ?? ''}|${inicio}`);
          if (marcado || antigo) paraApagar.push(evento.id);
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken);

      for (const eventId of paraApagar) {
        try {
          await calendar.events.delete({ calendarId: 'primary', eventId, sendUpdates: 'none' });
          apagados++;
        } catch (error: any) {
          erros++;
          calendarLogger.warn('[AGENDA_ALUNO_APAGAR_ERRO]', { eventId, error: error?.message });
        }
      }
    } catch (error: any) {
      erros++;
      calendarLogger.warn('[AGENDA_ALUNO_LISTAR_ERRO]', {
        alunoId: params.alunoId,
        turmaId: params.turmaId,
        error: error?.message,
      });
    }
    return { apagados, erros };
  },

  /** Aluno saiu da turma (ou perdeu o acesso): some dos convites do Meet e da própria agenda */
  async removerAlunoDaAgendaDaTurma(params: { alunoId: string; turmaId: string }) {
    const convites = await this.ajustarConviteDoAluno({ ...params, acao: 'remover' });
    const agenda = await this.apagarEventosDoAluno(params);
    calendarLogger.info('[AGENDA_ALUNO_REMOVIDO_DA_TURMA]', {
      ...params,
      convitesRemovidos: convites.alterados,
      eventosApagados: agenda.apagados,
      erros: convites.erros + agenda.erros,
    });
    return { convitesRemovidos: convites.alterados, eventosApagados: agenda.apagados };
  },

  /**
   * Sincronizar agenda completa do aluno ao se inscrever em turma
   * Sincroniza: aulas, provas e atividades da turma
   */
  async sincronizarAgendaAluno(params: {
    alunoId: string;
    turmaId: string;
  }): Promise<{ sincronizados: number; erros: number }> {
    const { alunoId, turmaId } = params;

    // Verificar se aluno tem Google Calendar conectado
    const aluno = await prisma.usuarios.findUnique({
      where: { id: alunoId },
      select: {
        id: true,
        email: true,
        googleCalendarId: true,
        googleAccessToken: true,
      },
    });

    if (!aluno?.googleAccessToken) {
      calendarLogger.info('[SYNC_SKIP] Aluno sem Google Calendar conectado', { alunoId });
      return { sincronizados: 0, erros: 0 };
    }

    let sincronizados = 0;
    let erros = 0;

    // Buscar turma e todos os eventos futuros
    const turma = await prisma.cursosTurmas.findUnique({
      where: { id: turmaId },
      include: {
        Cursos: { select: { nome: true } },
        CursosTurmasAulas: {
          where: {
            dataInicio: { gte: new Date() },
            status: { in: ['PUBLICADA', 'EM_ANDAMENTO'] },
            deletedAt: null,
          },
          orderBy: { dataInicio: 'asc' },
        },
        CursosTurmasProvas: {
          where: {
            dataInicio: { gte: new Date() },
            ativo: true,
            status: { in: ['PUBLICADA', 'EM_ANDAMENTO'] },
          },
          orderBy: { dataInicio: 'asc' },
        },
      },
    });

    if (!turma) {
      throw new Error('Turma não encontrada');
    }

    // Sincronizar aulas
    for (const aula of turma.CursosTurmasAulas) {
      try {
        if (!aula.dataInicio || !aula.dataFim) continue;

        const dataFim = aula.dataFim || new Date(aula.dataInicio.getTime() + 60 * 60 * 1000);

        await this.createCalendarEvent({
          usuarioId: alunoId,
          titulo: `📚 ${aula.nome}`,
          descricao: `Aula: ${aula.nome}\nCurso: ${turma.Cursos.nome}\nTurma: ${turma.nome}${aula.descricao ? `\n\n${aula.descricao}` : ''}`,
          dataInicio: aula.dataInicio,
          dataFim,
          location: aula.sala || undefined,
          link: aula.urlMeet || aula.urlVideo || undefined,
          marcador: { turmaId, itemId: aula.id },
        });

        sincronizados++;
      } catch (error: any) {
        calendarLogger.error('[SYNC_AULA_ERRO]', {
          aulaId: aula.id,
          alunoId,
          error: error?.message,
        });
        erros++;
      }
    }

    // Sincronizar provas e atividades
    for (const prova of turma.CursosTurmasProvas) {
      try {
        if (!prova.dataInicio || !prova.dataFim) continue;

        const tipo = prova.tipo === 'PROVA' ? '📝 Prova' : '📋 Atividade';
        await this.createCalendarEvent({
          usuarioId: alunoId,
          titulo: `${tipo}: ${prova.titulo}`,
          descricao: `${prova.tipo === 'PROVA' ? 'Prova' : 'Atividade'}: ${prova.titulo}\nCurso: ${turma.Cursos.nome}\nTurma: ${turma.nome}${prova.descricao ? `\n\n${prova.descricao}` : ''}`,
          dataInicio: prova.dataInicio,
          dataFim: prova.dataFim,
          marcador: { turmaId, itemId: prova.id },
        });

        sincronizados++;
      } catch (error: any) {
        calendarLogger.error('[SYNC_PROVA_ERRO]', {
          provaId: prova.id,
          alunoId,
          error: error?.message,
        });
        erros++;
      }
    }

    calendarLogger.info('[SYNC_ALUNO_COMPLETO]', {
      alunoId,
      turmaId,
      sincronizados,
      erros,
    });

    return { sincronizados, erros };
  },

  /**
   * Sincronizar entrevista no Google Calendar do recrutador e candidato
   */
  async sincronizarEntrevista(params: {
    entrevistaId: string;
    recrutadorId: string;
    candidatoId: string;
  }): Promise<{ recrutadorEventId?: string; candidatoEventId?: string }> {
    const { entrevistaId, recrutadorId, candidatoId } = params;

    const entrevista = await prisma.empresasVagasEntrevistas.findUnique({
      where: { id: entrevistaId },
      include: {
        EmpresasVagas: { select: { titulo: true } },
        candidato: { select: { nomeCompleto: true, email: true, googleAccessToken: true } },
        recrutador: { select: { nomeCompleto: true, email: true, googleAccessToken: true } },
      },
    });

    if (!entrevista) {
      throw new Error('Entrevista não encontrada');
    }

    const resultado: { recrutadorEventId?: string; candidatoEventId?: string } = {};

    // Sincronizar com recrutador (sempre tenta)
    try {
      if (entrevista.recrutador.googleAccessToken) {
        const event = await this.createCalendarEvent({
          usuarioId: recrutadorId,
          titulo: `💼 Entrevista: ${entrevista.candidato.nomeCompleto} - ${entrevista.EmpresasVagas.titulo}`,
          descricao: `Entrevista agendada\n\nVaga: ${entrevista.EmpresasVagas.titulo}\nCandidato: ${entrevista.candidato.nomeCompleto}\n${entrevista.descricao ? `\n${entrevista.descricao}` : ''}`,
          dataInicio: entrevista.dataInicio,
          dataFim: entrevista.dataFim,
          link: entrevista.meetUrl || undefined,
        });
        resultado.recrutadorEventId = event.eventId;
      }
    } catch (error: any) {
      calendarLogger.error('[SYNC_ENTREVISTA_RECRUTADOR_ERRO]', {
        entrevistaId,
        recrutadorId,
        error: error?.message,
      });
    }

    // Sincronizar com candidato (se tiver Google conectado)
    try {
      if (entrevista.candidato.googleAccessToken) {
        const event = await this.createCalendarEvent({
          usuarioId: candidatoId,
          titulo: `🎯 Entrevista: ${entrevista.EmpresasVagas.titulo}`,
          descricao: `Entrevista agendada\n\nVaga: ${entrevista.EmpresasVagas.titulo}\nRecrutador: ${entrevista.recrutador.nomeCompleto}\n${entrevista.descricao ? `\n${entrevista.descricao}` : ''}`,
          dataInicio: entrevista.dataInicio,
          dataFim: entrevista.dataFim,
          link: entrevista.meetUrl || undefined,
        });
        resultado.candidatoEventId = event.eventId;
      }
    } catch (error: any) {
      calendarLogger.error('[SYNC_ENTREVISTA_CANDIDATO_ERRO]', {
        entrevistaId,
        candidatoId,
        error: error?.message,
      });
    }

    calendarLogger.info('[SYNC_ENTREVISTA_COMPLETO]', {
      entrevistaId,
      recrutadorEventId: resultado.recrutadorEventId,
      candidatoEventId: resultado.candidatoEventId,
    });

    return resultado;
  },
};

import { google } from 'googleapis';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { googleOAuthService } from './google-oauth.service';
import crypto from 'crypto';

const calendarLogger = logger.child({ module: 'GoogleCalendar' });

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
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
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
      const meetUrl = event.data.hangoutLink!;

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

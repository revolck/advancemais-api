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
              { method: 'popup', minutes: 30 }, // 30min antes
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
};

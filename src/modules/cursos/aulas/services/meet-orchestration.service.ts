import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { googleCalendarService } from './google-calendar.service';
import { googleMeetService } from './google-meet.service';
import { googleOAuthService } from './google-oauth.service';
import {
  buildAttendeeGroups,
  resolveInstrutorAttendeeIds,
  resolveOrganizadorId,
} from './meet-attendees.helper';

const orchestrationLogger = logger.child({ module: 'MeetOrchestration' });

function combinarDataHora(data: Date | null, hora: string | null): Date | null {
  if (!data) return null;
  if (!hora) return data;
  const [horas, minutos] = hora.split(':').map((v) => Number(v));
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return data;
  const combinada = new Date(data);
  combinada.setUTCHours(horas, minutos, 0, 0);
  return combinada;
}

async function fetchAlunoEmails(turmaId: string): Promise<string[]> {
  const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
    where: { turmaId, status: 'INSCRITO' },
    include: { Usuarios: { select: { email: true } } },
  });
  return inscricoes.map((i) => i.Usuarios.email).filter(Boolean);
}

export const meetOrchestrationService = {
  /**
   * Cria a sala do Meet para uma aula elegível (AO_VIVO, ou SEMIPRESENCIAL+MEET) que
   * ainda não tenha `meetEventId`. Idempotente e não-fatal — qualquer falha é logada e
   * a função simplesmente não faz nada (a aula continua existindo normalmente).
   */
  async ensureMeetParaAula(aulaId: string): Promise<void> {
    try {
      const aula = await prisma.cursosTurmasAulas.findUnique({
        where: { id: aulaId },
        select: {
          id: true,
          nome: true,
          descricao: true,
          modalidade: true,
          tipoLink: true,
          turmaId: true,
          instrutorId: true,
          dataInicio: true,
          dataFim: true,
          horaInicio: true,
          horaFim: true,
          meetEventId: true,
          gravarAula: true,
          deletedAt: true,
        },
      });

      if (!aula || aula.deletedAt || aula.meetEventId || !aula.turmaId) {
        return;
      }

      const elegivel =
        aula.modalidade === 'LIVE' ||
        (aula.modalidade === 'SEMIPRESENCIAL' && aula.tipoLink === 'MEET');
      if (!elegivel) {
        return;
      }

      const dataInicio = combinarDataHora(aula.dataInicio, aula.horaInicio);
      const dataFim = combinarDataHora(aula.dataFim, aula.horaFim) ?? dataInicio;
      if (!dataInicio || !dataFim) {
        return;
      }

      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: aula.turmaId },
        select: {
          instrutorId: true,
          CursosTurmasInstrutores: { select: { instrutorId: true } },
        },
      });
      if (!turma) return;

      const organizadorId = resolveOrganizadorId(aula.instrutorId, turma);
      if (!organizadorId) {
        return;
      }

      const instrutorIds = resolveInstrutorAttendeeIds(aula.instrutorId, turma);
      const alunoEmails = await fetchAlunoEmails(aula.turmaId);
      const { convidados, adicionaisSilenciosos } = await buildAttendeeGroups({
        alunoEmails,
        instrutorIds,
      });

      const meetData = await googleCalendarService.createMeetEvent({
        titulo: aula.nome,
        descricao: aula.descricao || '',
        dataInicio,
        dataFim,
        instrutorId: organizadorId,
        alunoEmails: convidados,
        adicionaisSilenciosos,
      });

      await prisma.cursosTurmasAulas.update({
        where: { id: aula.id },
        data: { meetEventId: meetData.eventId, urlMeet: meetData.meetUrl },
      });

      await configurarSalaComTolerancia({
        organizadorId,
        meetUrl: meetData.meetUrl,
        habilitarGravacaoAutomatica: aula.gravarAula ?? true,
        onSpaceName: (spaceName) =>
          prisma.cursosTurmasAulas.update({
            where: { id: aula.id },
            data: { meetSpaceName: spaceName },
          }),
      });

      orchestrationLogger.info('[MEET_AULA_CRIADO]', {
        aulaId: aula.id,
        meetUrl: meetData.meetUrl,
      });
    } catch (error: any) {
      orchestrationLogger.error('[MEET_AULA_ERRO]', { aulaId, error: error?.message });
    }
  },

  /**
   * Cria a sala do Meet para uma prova/atividade elegível (modalidade AO_VIVO) que ainda
   * não tenha `meetEventId`. Mesmas garantias de idempotência/não-falha de `ensureMeetParaAula`.
   */
  async ensureMeetParaProvaOuAtividade(provaId: string): Promise<void> {
    try {
      const prova = await prisma.cursosTurmasProvas.findUnique({
        where: { id: provaId },
        select: {
          id: true,
          titulo: true,
          descricao: true,
          modalidade: true,
          turmaId: true,
          instrutorId: true,
          dataInicio: true,
          dataFim: true,
          horaInicio: true,
          horaTermino: true,
          meetEventId: true,
        },
      });

      if (!prova || prova.meetEventId || !prova.turmaId) {
        return;
      }

      if (prova.modalidade !== 'LIVE') {
        return;
      }

      const dataInicio = combinarDataHora(prova.dataInicio, prova.horaInicio);
      const dataFim = combinarDataHora(prova.dataFim, prova.horaTermino) ?? dataInicio;
      if (!dataInicio || !dataFim) {
        return;
      }

      const turma = await prisma.cursosTurmas.findUnique({
        where: { id: prova.turmaId },
        select: {
          instrutorId: true,
          CursosTurmasInstrutores: { select: { instrutorId: true } },
        },
      });
      if (!turma) return;

      const organizadorId = resolveOrganizadorId(prova.instrutorId, turma);
      if (!organizadorId) {
        return;
      }

      const instrutorIds = resolveInstrutorAttendeeIds(prova.instrutorId, turma);
      const alunoEmails = await fetchAlunoEmails(prova.turmaId);
      const { convidados, adicionaisSilenciosos } = await buildAttendeeGroups({
        alunoEmails,
        instrutorIds,
      });

      const meetData = await googleCalendarService.createMeetEvent({
        titulo: prova.titulo,
        descricao: prova.descricao || '',
        dataInicio,
        dataFim,
        instrutorId: organizadorId,
        alunoEmails: convidados,
        adicionaisSilenciosos,
      });

      await prisma.cursosTurmasProvas.update({
        where: { id: prova.id },
        data: { meetEventId: meetData.eventId, urlMeet: meetData.meetUrl },
      });

      // Gravação automática desligada por padrão para prova/atividade nesta primeira entrega.
      await configurarSalaComTolerancia({
        organizadorId,
        meetUrl: meetData.meetUrl,
        habilitarGravacaoAutomatica: false,
        onSpaceName: (spaceName) =>
          prisma.cursosTurmasProvas.update({
            where: { id: prova.id },
            data: { meetSpaceName: spaceName },
          }),
      });

      orchestrationLogger.info('[MEET_PROVA_CRIADO]', {
        provaId: prova.id,
        meetUrl: meetData.meetUrl,
      });
    } catch (error: any) {
      orchestrationLogger.error('[MEET_PROVA_ERRO]', { provaId, error: error?.message });
    }
  },
};

async function configurarSalaComTolerancia(params: {
  organizadorId: string;
  meetUrl: string;
  habilitarGravacaoAutomatica: boolean;
  onSpaceName: (spaceName: string) => Promise<unknown>;
}): Promise<void> {
  try {
    const oauth2Client = await googleOAuthService.getOAuth2Client(params.organizadorId);
    const resultado = await googleMeetService.configureSpace({
      oauth2Client,
      meetUrl: params.meetUrl,
      habilitarGravacaoAutomatica: params.habilitarGravacaoAutomatica,
    });

    if (resultado?.spaceName) {
      await params.onSpaceName(resultado.spaceName);
    }
  } catch (error: any) {
    orchestrationLogger.warn('[MEET_SPACE_CONFIG_SKIP]', {
      organizadorId: params.organizadorId,
      error: error?.message,
    });
  }
}

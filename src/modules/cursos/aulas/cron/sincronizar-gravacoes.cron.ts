import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { googleMeetService } from '../services/google-meet.service';
import { googleOAuthService } from '../services/google-oauth.service';
import { resolveOrganizadorId } from '../services/meet-attendees.helper';

const cronLogger = logger.child({ module: 'CronSincronizarGravacoes' });

const JANELA_TENTATIVAS_HORAS = 72;

/**
 * Cron Job: localizar a gravação gerada pelo Google Meet para aulas AO_VIVO já encerradas
 * e salvar seus metadados (id da gravação, arquivo no Drive, link de reprodução).
 * Desiste depois de JANELA_TENTATIVAS_HORAS sem encontrar nada (marca EXPIRADO_SEM_GRAVACAO).
 */
export async function sincronizarGravacoesProximas() {
  cronLogger.info('[CRON] Iniciando sincronização de gravações...');

  const agora = new Date();
  const limiteInferior = new Date(agora.getTime() - JANELA_TENTATIVAS_HORAS * 60 * 60 * 1000);

  const aulas = await prisma.cursosTurmasAulas.findMany({
    where: {
      modalidade: 'LIVE',
      meetEventId: { not: null },
      dataFim: { lt: agora },
      deletedAt: null,
      OR: [
        { statusGravacao: null },
        { statusGravacao: { notIn: ['FILE_GENERATED', 'EXPIRADO_SEM_GRAVACAO'] } },
      ],
    },
    include: {
      CursosTurmas: {
        select: {
          instrutorId: true,
          CursosTurmasInstrutores: { select: { instrutorId: true } },
        },
      },
    },
    orderBy: { dataFim: 'asc' },
    take: 50,
  });

  let encontradas = 0;
  let expiradas = 0;

  for (const aula of aulas) {
    try {
      if (!aula.CursosTurmas || !aula.urlMeet) continue;

      const organizadorId = resolveOrganizadorId(aula.instrutorId, aula.CursosTurmas);
      if (!organizadorId) continue;

      const oauth2Client = await googleOAuthService.getOAuth2Client(organizadorId);
      const gravacao = await googleMeetService.findGeneratedRecording({
        oauth2Client,
        meetUrl: aula.urlMeet,
        meetSpaceName: aula.meetSpaceName,
      });

      if (gravacao) {
        const duracaoGravacao =
          gravacao.startTime && gravacao.endTime
            ? Math.round(
                (new Date(gravacao.endTime).getTime() - new Date(gravacao.startTime).getTime()) /
                  60000,
              )
            : undefined;

        await prisma.cursosTurmasAulas.update({
          where: { id: aula.id },
          data: {
            gravacaoDriveFileId: gravacao.driveFileId,
            linkGravacao: gravacao.exportUri,
            statusGravacao: 'FILE_GENERATED',
            duracaoGravacao,
          },
        });
        encontradas++;
      } else if (aula.dataFim && aula.dataFim <= limiteInferior) {
        await prisma.cursosTurmasAulas.update({
          where: { id: aula.id },
          data: { statusGravacao: 'EXPIRADO_SEM_GRAVACAO' },
        });
        expiradas++;
      }
    } catch (error: any) {
      cronLogger.warn('[CRON] Erro ao sincronizar gravação de aula', {
        aulaId: aula.id,
        error: error?.message,
      });
    }
  }

  cronLogger.info('[CRON] Sincronização de gravações concluída', {
    processadas: aulas.length,
    encontradas,
    expiradas,
  });

  return { processadas: aulas.length, encontradas, expiradas };
}

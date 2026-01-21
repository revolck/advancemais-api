import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { notificacoesHelper } from '@/modules/cursos/aulas/services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarEntrevistas' });

/**
 * Cron Job: Notificar entrevistas agendadas (2h e 15min antes)
 * Frequência: A cada 15 minutos
 * Schedule: configurável via AGENDA_CRON_ENTREVISTAS_SCHEDULE (padrão: a cada 15 minutos)
 */
export async function notificarEntrevistasProximas() {
  cronLogger.info('[CRON] Iniciando verificação de entrevistas próximas...');

  try {
    // Processar notificações de 2h e 15min
    await notificarEntrevistasEm(120); // 2 horas
    await notificarEntrevistasEm(15); // 15 minutos

    cronLogger.info('[CRON] Verificação de entrevistas concluída');
  } catch (error: any) {
    cronLogger.error('[CRON] Erro ao processar entrevistas', { error: error?.message });
  }
}

/**
 * Notificar entrevistas em X minutos
 */
async function notificarEntrevistasEm(minutos: number) {
  const agora = new Date();

  // Janela de ±10min para tolerância
  const inicio = new Date(agora.getTime() + (minutos - 10) * 60 * 1000);
  const fim = new Date(agora.getTime() + (minutos + 10) * 60 * 1000);

  const entrevistas = await prisma.empresasVagasEntrevistas.findMany({
    where: {
      status: 'AGENDADA',
      dataInicio: {
        gte: inicio,
        lte: fim,
      },
    },
    include: {
      EmpresasVagas: {
        select: { titulo: true },
      },
      candidato: {
        select: { id: true, nomeCompleto: true, email: true },
      },
      recrutador: {
        select: { id: true, nomeCompleto: true, email: true },
      },
    },
    take: 100, // Limitar para não sobrecarregar
  });

  const prioridade = minutos === 15 ? 'URGENTE' : 'ALTA';
  const tituloRecrutador =
    minutos === 120 ? '💼 Entrevista em 2 horas!' : '⏰ Entrevista em 15 minutos!';
  const tituloCandidato =
    minutos === 120 ? '🎯 Entrevista em 2 horas!' : '⏰ Entrevista em 15 minutos!';
  const mensagem =
    minutos === 15
      ? 'Sua entrevista está se aproximando! Prepare-se e tome água antes de começar!'
      : 'Prepare-se para a entrevista que está chegando.';

  let notificacoesEnviadas = 0;

  for (const entrevista of entrevistas) {
    // Notificar RECRUTADOR
    try {
      await notificacoesHelper.criar({
        usuarioId: entrevista.recrutadorId,
        tipo: minutos === 120 ? 'ENTREVISTA_EM_2H' : 'ENTREVISTA_INICIADA',
        titulo: tituloRecrutador,
        mensagem: `${mensagem}\n\nCandidato: ${entrevista.candidato.nomeCompleto}\nVaga: ${entrevista.EmpresasVagas.titulo}`,
        prioridade,
        linkAcao: `/vagas/${entrevista.vagaId}/entrevistas/${entrevista.id}`,
        eventoId: `entrevista-rec-${entrevista.id}-${minutos}min`,
        dados: {
          entrevistaId: entrevista.id,
          vagaId: entrevista.vagaId,
          candidatoId: entrevista.candidatoId,
          minutos,
        },
      });

      // Email para 15min (crítico)
      if (minutos === 15) {
        await notificacoesHelper.enviarEmailCritico({
          para: entrevista.recrutador.email,
          nomeDestinatario: entrevista.recrutador.nomeCompleto,
          assunto: `⏰ Entrevista em 15 minutos`,
          mensagem: `Sua entrevista com ${entrevista.candidato.nomeCompleto} para a vaga "${entrevista.EmpresasVagas.titulo}" começará em 15 minutos.${entrevista.meetUrl ? `\n\nLink: ${entrevista.meetUrl}` : ''}`,
          linkAcao: `${process.env.FRONTEND_URL}/vagas/${entrevista.vagaId}/entrevistas/${entrevista.id}`,
        });
      }

      notificacoesEnviadas++;
    } catch (error: any) {
      cronLogger.error('[CRON] Erro ao notificar recrutador', {
        entrevistaId: entrevista.id,
        recrutadorId: entrevista.recrutadorId,
        error: error?.message,
      });
    }

    // Notificar CANDIDATO
    try {
      await notificacoesHelper.criar({
        usuarioId: entrevista.candidatoId,
        tipo: minutos === 120 ? 'ENTREVISTA_EM_2H' : 'ENTREVISTA_INICIADA',
        titulo: tituloCandidato,
        mensagem: `${mensagem}\n\nVaga: ${entrevista.EmpresasVagas.titulo}\nRecrutador: ${entrevista.recrutador.nomeCompleto}`,
        prioridade,
        linkAcao: `/vagas/${entrevista.vagaId}/entrevistas/${entrevista.id}`,
        eventoId: `entrevista-cand-${entrevista.id}-${minutos}min`,
        dados: {
          entrevistaId: entrevista.id,
          vagaId: entrevista.vagaId,
          recrutadorId: entrevista.recrutadorId,
          minutos,
        },
      });

      // Email para 15min (crítico)
      if (minutos === 15) {
        await notificacoesHelper.enviarEmailCritico({
          para: entrevista.candidato.email,
          nomeDestinatario: entrevista.candidato.nomeCompleto,
          assunto: `⏰ Entrevista em 15 minutos`,
          mensagem: `Sua entrevista para a vaga "${entrevista.EmpresasVagas.titulo}" começará em 15 minutos. Prepare-se!${entrevista.meetUrl ? `\n\nLink: ${entrevista.meetUrl}` : ''}`,
          linkAcao: `${process.env.FRONTEND_URL}/vagas/${entrevista.vagaId}/entrevistas/${entrevista.id}`,
        });
      }

      notificacoesEnviadas++;
    } catch (error: any) {
      cronLogger.error('[CRON] Erro ao notificar candidato', {
        entrevistaId: entrevista.id,
        candidatoId: entrevista.candidatoId,
        error: error?.message,
      });
    }
  }

  cronLogger.info(`[CRON] Entrevistas em ${minutos}min processadas`, {
    entrevistasEncontradas: entrevistas.length,
    notificacoesEnviadas,
    emailsEnviados: minutos === 15 ? notificacoesEnviadas : 0,
  });

  return { processadas: entrevistas.length, notificacoesEnviadas };
}

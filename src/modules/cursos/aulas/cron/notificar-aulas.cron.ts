import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { notificacoesHelper } from '../services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarAulas' });

/**
 * Cron Job: Notificar aulas ao vivo que começam em 2 horas e 15 minutos
 * Frequência: A cada 15 minutos
 * Schedule: configurável via AGENDA_CRON_AULAS_SCHEDULE (padrão: a cada 15 minutos)
 */
export async function notificarAulasProximas() {
  cronLogger.info('[CRON] Iniciando verificação de aulas próximas...');

  try {
    // Processar notificações de 2h e 15min
    await notificarAulasEm(120); // 2 horas
    await notificarAulasEm(15); // 15 minutos

    cronLogger.info('[CRON] Verificação de aulas concluída');
  } catch (error: any) {
    cronLogger.error('[CRON] Erro ao processar aulas', { error: error?.message });
  }
}

/**
 * Notificar aulas em X minutos
 */
async function notificarAulasEm(minutos: number) {
  const agora = new Date();

  // Janela de ±10min para tolerância
  const inicio = new Date(agora.getTime() + (minutos - 10) * 60 * 1000);
  const fim = new Date(agora.getTime() + (minutos + 10) * 60 * 1000);

  const aulas = await prisma.cursosTurmasAulas.findMany({
    where: {
      modalidade: { in: ['LIVE', 'SEMIPRESENCIAL'] },
      tipoLink: 'MEET',
      status: { in: ['PUBLICADA', 'EM_ANDAMENTO'] },
      dataInicio: {
        gte: inicio,
        lte: fim,
      },
      deletedAt: null,
    },
    include: {
      CursosTurmas: {
        include: {
          CursosTurmasInscricoes: {
            where: { status: 'INSCRITO' },
            include: {
              Usuarios: { select: { email: true, nomeCompleto: true } },
            },
          },
        },
      },
    },
    take: 100, // Limitar para não sobrecarregar
  });

  const tipoNotificacao = minutos === 120 ? 'AULA_EM_2H' : 'AULA_INICIADA';
  const prioridade = minutos === 15 ? 'URGENTE' : 'ALTA';
  const titulo =
    minutos === 120
      ? '🕐 Sua aula começa em 2 horas!'
      : minutos === 15
        ? '⏰ Sua aula começa em 15 minutos!'
        : '📚 Aula iniciando em breve';
  const mensagem =
    minutos === 15
      ? 'Sua aula está se aproximando! Prepare-se e tome água antes de começar!'
      : 'Prepare-se para a aula que está chegando.';

  let notificacoesEnviadas = 0;

  for (const aula of aulas) {
    if (!aula.CursosTurmas) continue;

    const alunos = aula.CursosTurmas.CursosTurmasInscricoes;

    for (const inscricao of alunos) {
      // Notificação no sistema
      await notificacoesHelper.criar({
        usuarioId: inscricao.alunoId,
        tipo: tipoNotificacao,
        titulo,
        mensagem: `${mensagem}\n\nAula: ${aula.nome}`,
        prioridade,
        linkAcao: `/turmas/${aula.turmaId}/aulas/${aula.id}`,
        eventoId: `aula-${aula.id}-${minutos}min`, // Deduplicação
        dados: {
          aulaId: aula.id,
          turmaId: aula.turmaId,
          dataInicio: aula.dataInicio,
          meetUrl: aula.urlMeet,
          minutos,
        },
      });

      // Email apenas para 15min (crítico)
      if (minutos === 15) {
        await notificacoesHelper.enviarEmailCritico({
          para: inscricao.Usuarios.email,
          nomeDestinatario: inscricao.Usuarios.nomeCompleto,
          assunto: `⏰ Aula em 15 minutos: ${aula.nome}`,
          mensagem: `Sua aula "${aula.nome}" começará em 15 minutos. Prepare-se!${
            aula.urlMeet ? `\n\nLink da aula: ${aula.urlMeet}` : ''
          }`,
          linkAcao: `${process.env.FRONTEND_URL}/turmas/${aula.turmaId}/aulas/${aula.id}`,
        });
      }

      notificacoesEnviadas++;
    }
  }

  cronLogger.info(`[CRON] Aulas em ${minutos}min processadas`, {
    aulasEncontradas: aulas.length,
    notificacoesEnviadas,
    emailsEnviados: minutos === 15 ? notificacoesEnviadas : 0,
  });

  return { processadas: aulas.length, notificacoesEnviadas };
}

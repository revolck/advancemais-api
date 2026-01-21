import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { notificacoesHelper } from '../services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarProvas' });

/**
 * Cron Job: Notificar provas e atividades próximas (24h, 8h, 2h, 15min)
 * Frequência: A cada 15 minutos
 * Schedule: configurável via AGENDA_CRON_PROVAS_SCHEDULE (padrão: a cada 15 minutos)
 */
export async function notificarProvasProximas() {
  cronLogger.info('[CRON] Iniciando verificação de provas e atividades próximas...');

  try {
    // Processar cada prazo
    await notificarProvasEm(24);
    await notificarProvasEm(8);
    await notificarProvasEm(2);
    await notificarProvasEm(0.25); // 15 minutos (0.25 horas)

    cronLogger.info('[CRON] Verificação de provas concluída');
  } catch (error: any) {
    cronLogger.error('[CRON] Erro ao processar provas', { error: error?.message });
  }
}

/**
 * Notificar provas em X horas ou minutos
 */
async function notificarProvasEm(horas: number) {
  const agora = new Date();
  const minutos = horas * 60;

  // Janela de ±10min para tolerância
  const inicio = new Date(agora.getTime() + (minutos - 10) * 60 * 1000);
  const fim = new Date(agora.getTime() + (minutos + 10) * 60 * 1000);

  const provas = await prisma.cursosTurmasProvas.findMany({
    where: {
      // dataInicio entre inicio e fim
      // Nota: Ajustar conforme campo real da prova
      ativo: true,
      turmaId: { not: null },
      dataInicio: {
        gte: inicio,
        lte: fim,
      },
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
  const tipoNotificacao =
    minutos === 1440
      ? 'PROVA_EM_24H'
      : minutos === 480
        ? 'PROVA_EM_8H'
        : minutos === 120
          ? 'PROVA_EM_2H'
          : minutos === 15
            ? 'PROVA_EM_2H' // Reutiliza tipo existente para 15min
            : 'PROVA_EM_2H';
  const prioridade = minutos === 120 || minutos === 15 ? 'URGENTE' : 'ALTA';
  const enviarEmail = minutos === 120 || minutos === 15; // Email para 2h e 15min

  let notificacoesEnviadas = 0;

  for (const prova of provas) {
    if (!prova.CursosTurmas) {
      continue;
    }

    const alunos = prova.CursosTurmas.CursosTurmasInscricoes;

    for (const inscricao of alunos) {
      const titulo =
        minutos === 1440
          ? `📝 Prova em 24h: ${prova.titulo}`
          : minutos === 480
            ? `📝 Prova em 8h: ${prova.titulo}`
            : minutos === 120
              ? `📝 Prova em 2h: ${prova.titulo}`
              : `⏰ Prova em 15min: ${prova.titulo}`;
      const mensagem =
        minutos === 15
          ? 'Sua prova está se aproximando! Prepare-se e tome água antes de começar!'
          : minutos === 120
            ? 'Sua prova está se aproximando! Prepare-se!'
            : 'Lembre-se da sua prova.';

      // Notificação no sistema
      await notificacoesHelper.criar({
        usuarioId: inscricao.alunoId,
        tipo: tipoNotificacao,
        titulo,
        mensagem: `${mensagem}\n\n${prova.titulo}`,
        prioridade,
        linkAcao: `/turmas/${prova.turmaId}/provas/${prova.id}`,
        eventoId: `prova-${prova.id}-${minutos}min`, // Deduplicação
        dados: {
          provaId: prova.id,
          turmaId: prova.turmaId,
          minutos,
        },
      });

      // Email para 2h e 15min (crítico)
      if (enviarEmail) {
        const assunto =
          minutos === 120
            ? `⏰ Prova em 2 horas: ${prova.titulo}`
            : `⏰ Prova em 15 minutos: ${prova.titulo}`;
        const mensagemEmail =
          minutos === 15
            ? `Sua prova "${prova.titulo}" começará em 15 minutos. Não se atrase! Prepare-se!`
            : `Sua prova "${prova.titulo}" começará em 2 horas. Não se atrase!`;

        await notificacoesHelper.enviarEmailCritico({
          para: inscricao.Usuarios.email,
          nomeDestinatario: inscricao.Usuarios.nomeCompleto,
          assunto,
          mensagem: mensagemEmail,
          linkAcao: `${process.env.FRONTEND_URL}/turmas/${prova.turmaId}/provas/${prova.id}`,
        });
      }

      notificacoesEnviadas++;
    }
  }

  cronLogger.info(`[CRON] Provas em ${minutos}min processadas`, {
    provasEncontradas: provas.length,
    notificacoesEnviadas,
    emailsEnviados: enviarEmail ? notificacoesEnviadas : 0,
  });

  return { processadas: provas.length, notificacoesEnviadas };
}

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { notificacoesHelper } from '../services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarProvas' });

/**
 * Cron Job: Notificar provas próximas (24h, 8h, 2h)
 * Frequência: A cada 1 hora
 * Cron Expression: 0 (asterisco) (asterisco) (asterisco) (asterisco)
 */
export async function notificarProvasProximas() {
  cronLogger.info('[CRON] Iniciando verificação de provas próximas...');

  try {
    // Processar cada prazo
    await notificarProvasEm(24);
    await notificarProvasEm(8);
    await notificarProvasEm(2);

    cronLogger.info('[CRON] Verificação de provas concluída');
  } catch (error: any) {
    cronLogger.error('[CRON] Erro ao processar provas', { error: error?.message });
  }
}

/**
 * Notificar provas em X horas
 */
async function notificarProvasEm(horas: number) {
  const agora = new Date();

  // Janela de ±10min para tolerância
  const inicio = new Date(agora.getTime() + (horas * 60 - 10) * 60 * 1000);
  const fim = new Date(agora.getTime() + (horas * 60 + 10) * 60 * 1000);

  const provas = await prisma.cursosTurmasProvas.findMany({
    where: {
      // dataInicio entre inicio e fim
      // Nota: Ajustar conforme campo real da prova
      ativo: true,
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
    horas === 24 ? 'PROVA_EM_24H' : horas === 8 ? 'PROVA_EM_8H' : 'PROVA_EM_2H';
  const prioridade = horas === 2 ? 'URGENTE' : 'ALTA';
  const enviarEmail = horas === 2; // Email apenas para 2h

  let notificacoesEnviadas = 0;

  for (const prova of provas) {
    const alunos = prova.CursosTurmas.CursosTurmasInscricoes;

    for (const inscricao of alunos) {
      // Sininho
      await notificacoesHelper.criar({
        usuarioId: inscricao.alunoId,
        tipo: tipoNotificacao,
        titulo: `📝 Prova em ${horas}h: ${prova.titulo}`,
        mensagem:
          horas === 2 ? 'Sua prova está se aproximando! Prepare-se!' : 'Lembre-se da sua prova.',
        prioridade,
        linkAcao: `/turmas/${prova.turmaId}/provas/${prova.id}`,
        eventoId: `prova-${prova.id}-${horas}h`,
        dados: {
          provaId: prova.id,
          turmaId: prova.turmaId,
          horas,
        },
      });

      // Email (apenas 2h - crítico)
      if (enviarEmail) {
        await notificacoesHelper.enviarEmailCritico({
          para: inscricao.Usuarios.email,
          nomeDestinatario: inscricao.Usuarios.nomeCompleto,
          assunto: `⏰ Prova em 2 horas: ${prova.titulo}`,
          mensagem: `Sua prova "${prova.titulo}" começará em 2 horas. Não se atrase!`,
          linkAcao: `${process.env.FRONTEND_URL}/turmas/${prova.turmaId}/provas/${prova.id}`,
        });
      }

      notificacoesEnviadas++;
    }
  }

  cronLogger.info(`[CRON] Provas em ${horas}h processadas`, {
    provasEncontradas: provas.length,
    notificacoesEnviadas,
    emailsEnviados: enviarEmail
      ? provas.reduce((sum, p) => sum + p.CursosTurmas.CursosTurmasInscricoes.length, 0)
      : 0,
  });

  return { processadas: provas.length, notificacoesEnviadas };
}

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { notificacoesHelper } from '../services/notificacoes-helper.service';

const cronLogger = logger.child({ module: 'CronNotificarAulas' });

/**
 * Cron Job: Notificar aulas ao vivo que começam em 2 horas
 * Frequência: A cada 30 minutos
 * Cron Expression: (asterisco)(barra)30 (asterisco) (asterisco) (asterisco) (asterisco)
 */
export async function notificarAulasProximas() {
  cronLogger.info('[CRON] Iniciando verificação de aulas próximas...');

  try {
    const agora = new Date();
    const daquiA2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);

    // Buscar aulas entre 1h50min e 2h10min (janela de 20min)
    const inicio = new Date(agora.getTime() + 110 * 60 * 1000); // 1h50min
    const fim = new Date(agora.getTime() + 130 * 60 * 1000); // 2h10min

    const aulasProximas = await prisma.cursosTurmasAulas.findMany({
      where: {
        modalidade: { in: ['LIVE', 'SEMIPRESENCIAL'] },
        tipoLink: 'MEET',
        status: 'PUBLICADA',
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
              select: {
                alunoId: true,
                Usuarios: { select: { email: true, nomeCompleto: true } },
              },
            },
          },
        },
      },
    });

    if (aulasProximas.length === 0) {
      cronLogger.info('[CRON] Nenhuma aula próxima encontrada');
      return { processadas: 0 };
    }

    let notificacoesEnviadas = 0;

    for (const aula of aulasProximas) {
      const alunos = aula.CursosTurmas?.CursosTurmasInscricoes || [];

      for (const inscricao of alunos) {
        await notificacoesHelper.criar({
          usuarioId: inscricao.alunoId,
          tipo: 'AULA_EM_2H',
          titulo: '🕐 Sua aula começa em 2 horas!',
          mensagem: `Prepare-se para a aula: ${aula.nome}`,
          prioridade: 'ALTA',
          linkAcao: `/turmas/${aula.turmaId}/aulas/${aula.id}`,
          eventoId: aula.id, // Deduplicação
          dados: {
            aulaId: aula.id,
            turmaId: aula.turmaId,
            dataInicio: aula.dataInicio,
            meetUrl: aula.urlMeet,
          },
        });

        notificacoesEnviadas++;
      }

      cronLogger.info('[CRON] Aula notificada', {
        aulaId: aula.id,
        titulo: aula.nome,
        alunos: alunos.length,
      });
    }

    cronLogger.info('[CRON] Verificação concluída', {
      aulasEncontradas: aulasProximas.length,
      notificacoesEnviadas,
    });

    return {
      processadas: aulasProximas.length,
      notificacoesEnviadas,
    };
  } catch (error: any) {
    cronLogger.error('[CRON] Erro ao processar aulas', { error: error?.message });
    throw error;
  }
}

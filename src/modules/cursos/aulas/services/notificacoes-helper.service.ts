import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { EmailService } from '@/modules/brevo/services/email-service';
import type { NotificacaoTipo, NotificacaoPrioridade } from '@prisma/client';

const notifLogger = logger.child({ module: 'NotificacoesHelper' });

/**
 * Helper para criar notificações (sininho + email quando necessário)
 */
export const notificacoesHelper = {
  /**
   * Criar notificação com deduplicação automática
   */
  async criar(params: {
    usuarioId: string;
    tipo: NotificacaoTipo;
    titulo: string;
    mensagem: string;
    prioridade?: NotificacaoPrioridade;
    linkAcao?: string;
    dados?: any;
    eventoId?: string; // Para deduplicação (aulaId, provaId, etc)
  }) {
    // Verificar se já foi enviada (deduplicação)
    if (params.eventoId) {
      const jaEnviada = await prisma.notificacoesEnviadas.findUnique({
        where: {
          tipo_eventoId_usuarioId: {
            tipo: params.tipo,
            eventoId: params.eventoId,
            usuarioId: params.usuarioId,
          },
        },
      });

      if (jaEnviada) {
        notifLogger.debug('[NOTIF] Já enviada, pulando', {
          tipo: params.tipo,
          eventoId: params.eventoId,
        });
        return null;
      }
    }

    // Criar notificação (sininho)
    const notificacao = await prisma.notificacoes.create({
      data: {
        usuarioId: params.usuarioId,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        prioridade: params.prioridade || 'NORMAL',
        linkAcao: params.linkAcao,
        dados: params.dados,
      },
    });

    // Registrar como enviada
    if (params.eventoId) {
      await prisma.notificacoesEnviadas.create({
        data: {
          tipo: params.tipo,
          eventoId: params.eventoId,
          usuarioId: params.usuarioId,
        },
      });
    }

    notifLogger.info('[NOTIF] Criada', {
      tipo: params.tipo,
      usuarioId: params.usuarioId,
    });

    return notificacao;
  },

  /**
   * Notificar todos os alunos de uma turma
   */
  async notificarAlunosDaTurma(
    turmaId: string,
    notificacao: {
      tipo: NotificacaoTipo;
      titulo: string;
      mensagem: string;
      prioridade?: NotificacaoPrioridade;
      linkAcao?: string;
      eventoId?: string;
    },
  ) {
    const alunos = await prisma.cursosTurmasInscricoes.findMany({
      where: {
        turmaId,
        status: 'INSCRITO',
      },
      select: {
        alunoId: true,
        Usuarios: { select: { email: true, nomeCompleto: true } },
      },
    });

    for (const inscricao of alunos) {
      await this.criar({
        usuarioId: inscricao.alunoId,
        ...notificacao,
      });
    }

    notifLogger.info('[NOTIF] Alunos notificados', {
      turmaId,
      tipo: notificacao.tipo,
      quantidade: alunos.length,
    });

    return { notificados: alunos.length };
  },

  /**
   * Enviar email crítico (usa Brevo - limite 1000/mês)
   */
  async enviarEmailCritico(params: {
    para: string;
    nomeDestinatario: string;
    assunto: string;
    mensagem: string;
    linkAcao?: string;
  }) {
    const emailService = new EmailService();

    await emailService.sendGeneric(
      params.para,
      params.nomeDestinatario,
      params.assunto,
      `<p>Olá, ${params.nomeDestinatario}!</p><p>${params.mensagem}</p>${
        params.linkAcao ? `<p><a href="${params.linkAcao}">Acessar plataforma</a></p>` : ''
      }`,
      `${params.mensagem}\n\n${params.linkAcao || ''}`,
    );

    notifLogger.info('[EMAIL] Email crítico enviado', {
      para: params.para,
      assunto: params.assunto,
    });
  },

  /**
   * Tabela de decisão: quando enviar email além do sininho
   */
  deveEnviarEmail(tipo: NotificacaoTipo): boolean {
    const tiposCriticos: NotificacaoTipo[] = [
      'PROVA_EM_2H',
      'AULA_CANCELADA', // Apenas se obrigatória
      'INSTRUTOR_VINCULADO',
      'TURMA_INICIOU',
      'TURMA_FINALIZADA',
    ];

    return tiposCriticos.includes(tipo);
  },
};

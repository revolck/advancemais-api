import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { EmailService } from '@/modules/brevo/services/email-service';
import { Roles, Status, type NotificacaoTipo, type NotificacaoPrioridade } from '@prisma/client';
import { createHash } from 'crypto';

const notifLogger = logger.child({ module: 'NotificacoesHelper' });

const NOTIFICACAO_EVENTO_ID_MAX_LENGTH = 36;

const normalizeEventoId = (eventoId: string) => {
  if (eventoId.length <= NOTIFICACAO_EVENTO_ID_MAX_LENGTH) {
    return eventoId;
  }

  return createHash('sha1')
    .update(eventoId)
    .digest('hex')
    .slice(0, NOTIFICACAO_EVENTO_ID_MAX_LENGTH);
};

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
    const eventoId = params.eventoId ? normalizeEventoId(params.eventoId) : undefined;

    // Verificar se já foi enviada (deduplicação)
    if (eventoId) {
      const jaEnviada = await prisma.notificacoesEnviadas.findUnique({
        where: {
          tipo_eventoId_usuarioId: {
            tipo: params.tipo,
            eventoId,
            usuarioId: params.usuarioId,
          },
        },
      });

      if (jaEnviada) {
        notifLogger.debug('[NOTIF] Já enviada, pulando', {
          tipo: params.tipo,
          eventoId,
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
    if (eventoId) {
      await prisma.notificacoesEnviadas.create({
        data: {
          tipo: params.tipo,
          eventoId,
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
      enviarEmail?: boolean;
      emailAssunto?: string;
      emailMensagem?: string;
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
      const notificacaoCriada = await this.criar({
        usuarioId: inscricao.alunoId,
        ...notificacao,
      });

      if (notificacao.enviarEmail && notificacaoCriada) {
        await this.enviarEmailCritico({
          para: inscricao.Usuarios.email,
          nomeDestinatario: inscricao.Usuarios.nomeCompleto,
          assunto: notificacao.emailAssunto ?? notificacao.titulo,
          mensagem: notificacao.emailMensagem ?? notificacao.mensagem,
          linkAcao: notificacao.linkAcao
            ? `${process.env.FRONTEND_URL ?? ''}${notificacao.linkAcao}`
            : undefined,
        });
      }
    }

    notifLogger.info('[NOTIF] Alunos notificados', {
      turmaId,
      tipo: notificacao.tipo,
      quantidade: alunos.length,
    });

    return { notificados: alunos.length };
  },

  /**
   * Notificar a equipe de gestão de uma turma: ADMIN/MODERADOR/PEDAGOGICO ativos
   * (plataforma toda, sem vínculo com a turma) + instrutor(es) vinculados à turma
   * (passados via `instrutorIds`, ex.: `resolveInstrutorAttendeeIds`). Deduplica por
   * usuário e envia notificação + email para cada um.
   */
  async notificarEquipeDaTurma(params: {
    turmaId: string;
    instrutorIds: string[];
    tipo: NotificacaoTipo;
    titulo: string;
    mensagem: string;
    prioridade?: NotificacaoPrioridade;
    linkAcao: string;
    eventoId: string;
  }) {
    const [gestores, instrutores] = await Promise.all([
      prisma.usuarios.findMany({
        where: {
          role: { in: [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO] },
          status: Status.ATIVO,
        },
        select: { id: true, nomeCompleto: true, email: true },
      }),
      params.instrutorIds.length
        ? prisma.usuarios.findMany({
            where: { id: { in: params.instrutorIds }, status: Status.ATIVO },
            select: { id: true, nomeCompleto: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const destinatarios = new Map<string, { id: string; nomeCompleto: string; email: string }>();
    for (const usuario of [...gestores, ...instrutores]) {
      destinatarios.set(usuario.id, usuario);
    }

    for (const destinatario of destinatarios.values()) {
      const notificacaoCriada = await this.criar({
        usuarioId: destinatario.id,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        prioridade: params.prioridade,
        linkAcao: params.linkAcao,
        eventoId: params.eventoId,
      });

      if (notificacaoCriada) {
        await this.enviarEmailCritico({
          para: destinatario.email,
          nomeDestinatario: destinatario.nomeCompleto,
          assunto: params.titulo,
          mensagem: params.mensagem,
          linkAcao: `${process.env.FRONTEND_URL ?? ''}${params.linkAcao}`,
        });
      }
    }

    notifLogger.info('[NOTIF] Equipe da turma notificada', {
      turmaId: params.turmaId,
      tipo: params.tipo,
      quantidade: destinatarios.size,
    });

    return { notificados: destinatarios.size };
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
      'TURMA_ESTRUTURA_PENDENTE_24H',
      'TURMA_INICIO_BLOQUEADO_ESTRUTURA',
      'TURMA_INICIO_REPROGRAMADO',
      'TURMA_NOVA_DATA_CONFIRMADA',
      'TURMA_FREQUENCIA_ALERTA',
      'ALUNO_FREQUENCIA_BAIXA',
    ];

    return tiposCriticos.includes(tipo);
  },
};

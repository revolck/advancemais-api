import { createHash } from 'crypto';

import { prisma } from '@/config/prisma';
import { EmailService } from '@/modules/brevo/services/email-service';
import {
  EmailTemplates,
  type CoursePaymentEmailStatus,
} from '@/modules/brevo/templates/email-templates';
import { logger } from '@/utils/logger';
import type { NotificacaoPrioridade } from '@prisma/client';

const serviceLogger = logger.child({ module: 'CursoPagamentoNotificacoesService' });

export type CursoPagamentoStatus =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'ESTORNADO'
  | 'CONTESTADO';

const EVENTO_ID_MAX_LENGTH = 36;

const STATUS_TO_TIPO: Record<CursoPagamentoStatus, string> = {
  PENDENTE: 'CURSO_PAGAMENTO_PENDENTE',
  PROCESSANDO: 'CURSO_PAGAMENTO_PROCESSANDO',
  APROVADO: 'CURSO_PAGAMENTO_APROVADO',
  RECUSADO: 'CURSO_PAGAMENTO_RECUSADO',
  CANCELADO: 'CURSO_PAGAMENTO_CANCELADO',
  ESTORNADO: 'CURSO_PAGAMENTO_ESTORNADO',
  CONTESTADO: 'CURSO_PAGAMENTO_CONTESTADO',
};

const STATUS_META: Record<
  CursoPagamentoStatus,
  { titulo: string; mensagem: (cursoNome: string) => string; prioridade: NotificacaoPrioridade }
> = {
  PENDENTE: {
    titulo: 'Pagamento pendente',
    mensagem: (cursoNome) =>
      `Recebemos sua solicitação de matrícula no curso "${cursoNome}". Conclua o pagamento para liberar o acesso.`,
    prioridade: 'ALTA',
  },
  PROCESSANDO: {
    titulo: 'Pagamento em processamento',
    mensagem: (cursoNome) =>
      `Seu pagamento do curso "${cursoNome}" está em processamento. Avisaremos quando houver confirmação.`,
    prioridade: 'NORMAL',
  },
  APROVADO: {
    titulo: 'Pagamento aprovado',
    mensagem: (cursoNome) =>
      `Seu pagamento foi aprovado e sua matrícula no curso "${cursoNome}" está liberada.`,
    prioridade: 'ALTA',
  },
  RECUSADO: {
    titulo: 'Pagamento recusado',
    mensagem: (cursoNome) =>
      `O pagamento do curso "${cursoNome}" foi recusado. Confira os dados e tente novamente.`,
    prioridade: 'URGENTE',
  },
  CANCELADO: {
    titulo: 'Pagamento cancelado',
    mensagem: (cursoNome) =>
      `O pagamento do curso "${cursoNome}" foi cancelado ou expirou. Faça uma nova tentativa para garantir sua vaga.`,
    prioridade: 'ALTA',
  },
  ESTORNADO: {
    titulo: 'Pagamento estornado',
    mensagem: (cursoNome) =>
      `O pagamento do curso "${cursoNome}" foi estornado ou reembolsado. Acompanhe os detalhes na plataforma.`,
    prioridade: 'ALTA',
  },
  CONTESTADO: {
    titulo: 'Pagamento em contestação',
    mensagem: (cursoNome) =>
      `O pagamento do curso "${cursoNome}" entrou em contestação. Acompanhe a situação pela plataforma.`,
    prioridade: 'URGENTE',
  },
};

export type NotificarCursoPagamentoParams = {
  inscricaoId: string;
  statusAnterior?: string | null;
  statusNovo?: string | null;
  gatewayStatus?: string | null;
  gatewayStatusDetail?: string | null;
  mpPaymentId?: string | null;
  mpOrderId?: string | null;
  eventoOrigem?: string | null;
};

function normalizeEventoId(value: string) {
  if (value.length <= EVENTO_ID_MAX_LENGTH) return value;
  return createHash('sha1').update(value).digest('hex').slice(0, EVENTO_ID_MAX_LENGTH);
}

function normalizeText(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeCursoPagamentoStatus(status?: string | null): CursoPagamentoStatus {
  const value = String(status ?? '')
    .trim()
    .toUpperCase();
  if (value === 'APROVADO' || value === 'PAGO' || value === 'APPROVED' || value === 'ACCREDITED') {
    return 'APROVADO';
  }
  if (
    value === 'PROCESSANDO' ||
    value === 'EM_PROCESSAMENTO' ||
    value === 'PROCESSING' ||
    value === 'IN_PROCESS' ||
    value === 'IN_REVIEW'
  ) {
    return 'PROCESSANDO';
  }
  if (value === 'RECUSADO' || value === 'REJECTED' || value === 'FAILED') return 'RECUSADO';
  if (
    value === 'CANCELADO' ||
    value === 'CANCELLED' ||
    value === 'CANCELED' ||
    value === 'EXPIRED'
  ) {
    return 'CANCELADO';
  }
  if (
    value === 'ESTORNADO' ||
    value === 'REFUNDED' ||
    value === 'REEMBOLSADO' ||
    value === 'PARTIALLY_REFUNDED'
  ) {
    return 'ESTORNADO';
  }
  if (value === 'CONTESTADO' || value === 'CHARGED_BACK' || value === 'CHARGEBACK') {
    return 'CONTESTADO';
  }
  return 'PENDENTE';
}

export function mapGatewayStatusToCursoPagamentoStatus(
  status?: string | null,
  statusDetail?: string | null,
): CursoPagamentoStatus {
  const normalized = normalizeText(status);
  const detail = normalizeText(statusDetail);

  if (normalized === 'charged_back') return 'CONTESTADO';
  if (normalized === 'refunded' || detail === 'refunded' || detail === 'partially_refunded') {
    return 'ESTORNADO';
  }
  if (
    normalized === 'processed' ||
    normalized === 'approved' ||
    normalized === 'accredited' ||
    normalized === 'authorized' ||
    normalized === 'authorized_for_collect' ||
    normalized === 'active' ||
    detail === 'accredited'
  ) {
    return 'APROVADO';
  }
  if (normalized === 'failed' || normalized === 'rejected') return 'RECUSADO';
  if (
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized === 'expired' ||
    detail === 'expired' ||
    detail === 'canceled'
  ) {
    return 'CANCELADO';
  }
  if (
    normalized === 'processing' ||
    normalized === 'in_process' ||
    normalized === 'in_review' ||
    detail === 'in_process' ||
    detail === 'pending_review_manual' ||
    detail === 'in_review'
  ) {
    return 'PROCESSANDO';
  }
  if (
    normalized === 'created' ||
    normalized === 'action_required' ||
    normalized === 'pending' ||
    detail === 'waiting_payment' ||
    detail === 'waiting_transfer' ||
    detail === 'pending_challenge'
  ) {
    return 'PENDENTE';
  }

  return normalizeCursoPagamentoStatus(status);
}

function getFrontendBaseUrl() {
  return (
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.CLIENT_URL ||
    'https://advancemais.com'
  ).replace(/\/+$/, '');
}

function formatMoney(value?: number | string | null) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

function formatDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function metodoLabel(value?: string | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  if (upper === 'PIX') return 'PIX';
  if (upper === 'BOLETO') return 'Boleto';
  if (upper.includes('CARTAO_CREDITO')) return 'Cartão de crédito';
  if (upper.includes('CARTAO_DEBITO')) return 'Cartão de débito';
  return normalized;
}

export const cursoPagamentoNotificacoesService = {
  async notificarStatusInscricao(params: NotificarCursoPagamentoParams) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: params.inscricaoId },
      include: {
        Usuarios: { select: { id: true, nomeCompleto: true, email: true } },
        CursosTurmas: {
          select: {
            id: true,
            nome: true,
            cursoId: true,
            Cursos: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!inscricao) return null;

    const statusNovo = normalizeCursoPagamentoStatus(
      params.statusNovo ?? inscricao.statusPagamento,
    );
    const statusAnterior = params.statusAnterior
      ? normalizeCursoPagamentoStatus(params.statusAnterior)
      : null;
    const tipo = STATUS_TO_TIPO[statusNovo];
    const meta = STATUS_META[statusNovo];
    const curso = inscricao.CursosTurmas.Cursos;
    const paymentIdentifier =
      params.mpPaymentId ||
      params.mpOrderId ||
      inscricao.mpPaymentId ||
      inscricao.mpOrderId ||
      (Number(inscricao.valorFinal ?? 0) === 0 ? 'free' : 'sem-pagamento');
    const rawEventoId = `curso-pagamento:${inscricao.id}:${paymentIdentifier}:${statusNovo}`;
    const eventoId = normalizeEventoId(rawEventoId);
    const frontendBase = getFrontendBaseUrl();
    const paymentPath =
      statusNovo === 'PENDENTE' || statusNovo === 'PROCESSANDO'
        ? '/dashboard/cursos/pagamentos?tab=pendentes'
        : '/dashboard/cursos/pagamentos';
    const coursePath = `/dashboard/cursos/alunos/cursos/${curso.id}/${inscricao.turmaId}`;
    const linkAcao = statusNovo === 'APROVADO' ? coursePath : paymentPath;
    const valor = Number(
      inscricao.valorPago ?? inscricao.valorFinal ?? inscricao.valorOriginal ?? 0,
    );
    const dados = {
      evento: 'CURSO_PAGAMENTO_STATUS_ATUALIZADO',
      inscricaoId: inscricao.id,
      alunoId: inscricao.alunoId,
      cursoId: curso.id,
      cursoNome: curso.nome,
      turmaId: inscricao.turmaId,
      turmaNome: inscricao.CursosTurmas.nome,
      statusAnterior,
      statusNovo,
      gatewayStatus: params.gatewayStatus ?? null,
      gatewayStatusDetail: params.gatewayStatusDetail ?? null,
      metodoPagamento: inscricao.metodoPagamento,
      valor,
      mpPaymentId: params.mpPaymentId ?? inscricao.mpPaymentId,
      mpOrderId: params.mpOrderId ?? inscricao.mpOrderId,
      expiraEm: inscricao.pagamentoExpiraEm?.toISOString() ?? null,
      eventoOrigem: params.eventoOrigem ?? null,
      eventoId: rawEventoId,
    };

    try {
      const [, notificacao] = await prisma.$transaction([
        prisma.notificacoesEnviadas.create({
          data: {
            tipo,
            eventoId,
            usuarioId: inscricao.alunoId,
          },
        }),
        prisma.notificacoes.create({
          data: {
            usuarioId: inscricao.alunoId,
            tipo: tipo as any,
            titulo: meta.titulo,
            mensagem: meta.mensagem(curso.nome),
            prioridade: meta.prioridade,
            linkAcao,
            dados,
          },
        }),
      ]);

      if (inscricao.Usuarios.email) {
        const emailService = new EmailService();
        const emailContent = EmailTemplates.generateCoursePaymentStatusEmail({
          nomeCompleto: inscricao.Usuarios.nomeCompleto,
          cursoNome: curso.nome,
          turmaNome: inscricao.CursosTurmas.nome,
          status: statusNovo as CoursePaymentEmailStatus,
          valorFormatado: formatMoney(valor),
          metodoPagamento: metodoLabel(inscricao.metodoPagamento),
          expiraEmFormatada: formatDate(inscricao.pagamentoExpiraEm),
          paymentUrl: `${frontendBase}${paymentPath}`,
          courseUrl: `${frontendBase}${coursePath}`,
        });

        const result = await emailService.sendGeneric(
          inscricao.Usuarios.email,
          inscricao.Usuarios.nomeCompleto,
          emailContent.subject,
          emailContent.html,
          emailContent.text,
        );

        if (!result.success) {
          serviceLogger.warn(
            { inscricaoId: inscricao.id, alunoId: inscricao.alunoId, error: result.error },
            'Falha ao enviar email de pagamento de curso',
          );
        }
      }

      serviceLogger.info(
        { inscricaoId: inscricao.id, alunoId: inscricao.alunoId, tipo, statusNovo },
        'Notificação de pagamento de curso criada',
      );

      return notificacao;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        serviceLogger.debug(
          { inscricaoId: inscricao.id, tipo, eventoId },
          'Notificação de pagamento de curso já enviada',
        );
        return null;
      }

      serviceLogger.warn(
        { err: error, inscricaoId: inscricao.id, alunoId: inscricao.alunoId, statusNovo },
        'Falha ao notificar pagamento de curso',
      );
      return null;
    }
  },

  async notificarStatusInscricaoSafe(params: NotificarCursoPagamentoParams) {
    try {
      return await this.notificarStatusInscricao(params);
    } catch (error) {
      serviceLogger.warn({ err: error, inscricaoId: params.inscricaoId }, 'Notificação ignorada');
      return null;
    }
  },
};

import { CursosAulaStatus, Prisma, StatusInscricao } from '@prisma/client';
import { Payment } from 'mercadopago';

import { assertMercadoPagoConfigured, mpClient } from '@/config/mercadopago';
import { prisma } from '@/config/prisma';
import { notificacoesService } from '@/modules/notificacoes/services/notificacoes.service';
import { logger } from '@/utils/logger';

import { avaliacaoService } from './avaliacao.service';
import type {
  CheckoutRecuperacaoInput,
  ListMeusPagamentosQuery,
} from '../validators/pagamentos-aluno.schema';

const pagamentosLogger = logger.child({ module: 'CursosPagamentosAlunoService' });
const VALOR_RECUPERACAO = new Prisma.Decimal(50);
const STATUS_PENDENTES = new Set(['PENDENTE', 'PROCESSANDO']);

type StatusPagamento =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'ESTORNADO';

const normalizeStatus = (status?: string | null): StatusPagamento => {
  const value = String(status ?? '').toUpperCase();
  if (value === 'APROVADO' || value === 'PAGO' || value === 'APPROVED' || value === 'ACCREDITED') {
    return 'APROVADO';
  }
  if (
    value === 'PROCESSANDO' ||
    value === 'EM_PROCESSAMENTO' ||
    value === 'IN_PROCESS' ||
    value === 'PENDING'
  ) {
    return 'PROCESSANDO';
  }
  if (value === 'RECUSADO' || value === 'REJECTED' || value === 'CHARGED_BACK') {
    return 'RECUSADO';
  }
  if (value === 'CANCELADO' || value === 'CANCELLED' || value === 'EXPIRED') {
    return 'CANCELADO';
  }
  if (value === 'ESTORNADO' || value === 'REFUNDED') return 'ESTORNADO';
  return 'PENDENTE';
};

const normalizeMetodo = (metodo?: string | null) => {
  const value = String(metodo ?? '').toLowerCase();
  if (!value) return null;
  if (value.includes('pix')) return 'pix';
  if (value.includes('boleto') || value.includes('bolbradesco') || value.includes('ticket')) {
    return 'boleto';
  }
  if (value.includes('cartao') || value.includes('card')) return 'credit_card';
  return value;
};

const metodoLabel = (metodo: string | null) => {
  if (metodo === 'pix') return 'PIX';
  if (metodo === 'boleto') return 'Boleto';
  if (metodo === 'credit_card') return 'Cartao de Credito';
  return metodo;
};

const statusLabel = (status: StatusPagamento) =>
  ({
    PENDENTE: 'Pendente',
    PROCESSANDO: 'Processando',
    APROVADO: 'Aprovado',
    RECUSADO: 'Recusado',
    CANCELADO: 'Cancelado',
    ESTORNADO: 'Estornado',
  })[status];

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

type PagamentoItem = {
  id: string;
  origem: 'MATRICULA' | 'RECUPERACAO_FINAL';
  tipo: string;
  tipoDescricao: string;
  status: StatusPagamento;
  statusDescricao: string;
  valor: number;
  valorFormatado: string;
  metodo: string | null;
  metodoDescricao: string | null;
  curso: { id: string; nome: string };
  turma: { id: string; nome: string };
  prova: { id: string; titulo: string } | null;
  tipoPagamento: 'matricula' | 'recuperacao-final';
  referencia: string;
  transacaoId: string | null;
  criadoEm: string;
  validadeAte: string | null;
  detalhes: {
    pix?: { qrCode: string | null; copiaCola: string | null; expiraEm: string | null };
    boleto?: { codigo: string | null; urlPdf: string | null; vencimento: string | null };
  } | null;
  podePagar: boolean;
};

const notificationSafe = async (callback: () => Promise<unknown>) => {
  try {
    await callback();
  } catch (error) {
    pagamentosLogger.warn({ err: error }, 'Nao foi possivel enviar notificacao de recuperacao');
  }
};

export const pagamentosAlunoService = {
  async reconciliarRecuperacaoInscricao(inscricaoId: string) {
    const inscricao = await prisma.cursosTurmasInscricoes.findUnique({
      where: { id: inscricaoId },
      select: { alunoId: true },
    });
    if (!inscricao) return;

    await this.reconciliarRecuperacoes(inscricao.alunoId);
  },

  async reconciliarRecuperacoes(alunoId: string) {
    const inscricoes = await prisma.cursosTurmasInscricoes.findMany({
      where: {
        alunoId,
        statusPagamento: 'APROVADO',
        status: {
          in: [
            StatusInscricao.INSCRITO,
            StatusInscricao.EM_ANDAMENTO,
            StatusInscricao.EM_ESTAGIO,
            StatusInscricao.CONCLUIDO,
            StatusInscricao.REPROVADO,
          ],
        },
      },
      include: {
        CursosTurmas: {
          include: {
            Cursos: { select: { id: true, nome: true } },
            CursosTurmasProvas: {
              where: {
                recuperacaoFinal: true,
                ativo: true,
                status: CursosAulaStatus.PUBLICADA,
              },
              select: { id: true },
            },
          },
        },
      },
    });

    for (const inscricao of inscricoes) {
      if (inscricao.CursosTurmas.CursosTurmasProvas.length === 0) continue;

      const boletim = await avaliacaoService.calcularNotasInscricao(inscricao.id, alunoId);
      const notaFinal = boletim.resultadoFinal.media;
      if (notaFinal === null || notaFinal >= 7) continue;

      for (const prova of inscricao.CursosTurmas.CursosTurmasProvas) {
        const existing = await prisma.cursosRecuperacaoPagamentos.findUnique({
          where: { inscricaoId_provaId: { inscricaoId: inscricao.id, provaId: prova.id } },
          select: { id: true },
        });
        if (existing) continue;

        try {
          await prisma.cursosRecuperacaoPagamentos.create({
            data: {
              alunoId,
              inscricaoId: inscricao.id,
              turmaId: inscricao.turmaId,
              provaId: prova.id,
              valor: VALOR_RECUPERACAO,
            },
          });

          await notificationSafe(() =>
            notificacoesService.notificarRecuperacaoFinalPendente({
              alunoId,
              cursoId: inscricao.CursosTurmas.Cursos.id,
              cursoNome: inscricao.CursosTurmas.Cursos.nome,
              turmaId: inscricao.turmaId,
              turmaNome: inscricao.CursosTurmas.nome,
              provaId: prova.id,
              valor: Number(VALOR_RECUPERACAO),
            }),
          );
        } catch (error: any) {
          if (error?.code !== 'P2002') throw error;
        }
      }
    }
  },

  async list(alunoId: string, query: ListMeusPagamentosQuery) {
    await this.reconciliarRecuperacoes(alunoId);

    const [inscricoes, recuperacoes] = await Promise.all([
      prisma.cursosTurmasInscricoes.findMany({
        where: {
          alunoId,
          valorFinal: { gt: 0 },
        },
        include: { CursosTurmas: { include: { Cursos: true } } },
      }),
      prisma.cursosRecuperacaoPagamentos.findMany({
        where: { alunoId },
        include: {
          CursosTurmas: { include: { Cursos: true } },
          CursosTurmasProvas: true,
        },
      }),
    ]);

    const items: PagamentoItem[] = [
      ...inscricoes.map((item) => {
        const status = normalizeStatus(item.statusPagamento);
        const metodo = normalizeMetodo(item.metodoPagamento);
        const valor = Number(item.valorPago ?? item.valorFinal ?? 0);
        const detalhes =
          item.pixQrCode || item.boletoUrl || item.boletoCodigo
            ? {
                ...(item.pixQrCode
                  ? {
                      pix: {
                        qrCode: item.pixQrCode,
                        copiaCola: item.pixQrCode,
                        expiraEm: item.pagamentoExpiraEm?.toISOString() ?? null,
                      },
                    }
                  : {}),
                ...(item.boletoUrl || item.boletoCodigo
                  ? {
                      boleto: {
                        codigo: item.boletoCodigo,
                        urlPdf: item.boletoUrl,
                        vencimento: item.pagamentoExpiraEm?.toISOString() ?? null,
                      },
                    }
                  : {}),
              }
            : null;
        return {
          id: `matricula:${item.id}`,
          origem: 'MATRICULA' as const,
          tipo: 'MATRICULA',
          tipoDescricao: 'Matricula',
          status,
          statusDescricao: statusLabel(status),
          valor,
          valorFormatado: money(valor),
          metodo,
          metodoDescricao: metodoLabel(metodo),
          curso: { id: item.CursosTurmas.Cursos.id, nome: item.CursosTurmas.Cursos.nome },
          turma: { id: item.CursosTurmas.id, nome: item.CursosTurmas.nome },
          prova: null,
          tipoPagamento: 'matricula' as const,
          referencia: item.id,
          transacaoId: item.mpPaymentId,
          criadoEm: item.criadoEm.toISOString(),
          validadeAte: null,
          detalhes,
          podePagar: false,
        };
      }),
      ...recuperacoes.map((item) => {
        const status = normalizeStatus(item.statusPagamento);
        const metodo = normalizeMetodo(item.metodoPagamento);
        const valor = Number(item.valor);
        const detalhes =
          item.pixQrCode || item.boletoUrl || item.boletoCodigo
            ? {
                ...(item.pixQrCode
                  ? {
                      pix: {
                        qrCode: item.pixQrCode,
                        copiaCola: item.pixQrCode,
                        expiraEm: item.expiraEm?.toISOString() ?? null,
                      },
                    }
                  : {}),
                ...(item.boletoUrl || item.boletoCodigo
                  ? {
                      boleto: {
                        codigo: item.boletoCodigo,
                        urlPdf: item.boletoUrl,
                        vencimento: item.expiraEm?.toISOString() ?? null,
                      },
                    }
                  : {}),
              }
            : null;
        return {
          id: item.id,
          origem: 'RECUPERACAO_FINAL' as const,
          tipo: 'RECUPERACAO_FINAL',
          tipoDescricao: 'Recuperacao final',
          status,
          statusDescricao: statusLabel(status),
          valor,
          valorFormatado: money(valor),
          metodo,
          metodoDescricao: metodoLabel(metodo),
          curso: { id: item.CursosTurmas.Cursos.id, nome: item.CursosTurmas.Cursos.nome },
          turma: { id: item.CursosTurmas.id, nome: item.CursosTurmas.nome },
          prova: { id: item.CursosTurmasProvas.id, titulo: item.CursosTurmasProvas.titulo },
          tipoPagamento: 'recuperacao-final' as const,
          referencia: item.id,
          transacaoId: item.mpPaymentId,
          criadoEm: item.criadoEm.toISOString(),
          validadeAte: item.expiraEm?.toISOString() ?? null,
          detalhes,
          podePagar:
            (status === 'PENDENTE' || status === 'RECUSADO' || status === 'CANCELADO') &&
            !item.pixQrCode &&
            !item.boletoUrl,
        };
      }),
    ].sort((left, right) => right.criadoEm.localeCompare(left.criadoEm));

    const pendingCount = items.filter((item) => STATUS_PENDENTES.has(item.status)).length;
    const summary = {
      totalPago: items
        .filter((item) => item.status === 'APROVADO')
        .reduce((sum, item) => sum + item.valor, 0),
      totalPendente: items
        .filter((item) => STATUS_PENDENTES.has(item.status))
        .reduce((sum, item) => sum + item.valor, 0),
      totalTransacoes: items.length,
      ultimoPagamento: items.find((item) => item.status === 'APROVADO')?.criadoEm ?? null,
    };

    const cursos = Array.from(
      new Map(items.map((item) => [item.curso.id, item.curso])).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const turmas = Array.from(
      new Map(
        items.map((item) => [item.turma.id, { ...item.turma, cursoId: item.curso.id }]),
      ).values(),
    ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const endDate = query.dataFim
      ? new Date(new Date(query.dataFim).setHours(23, 59, 59, 999))
      : undefined;
    const filtered = items.filter((item) => {
      if (query.tab === 'pendentes' && !STATUS_PENDENTES.has(item.status)) return false;
      if (query.status && item.status !== query.status) return false;
      if (query.metodo && item.metodo !== normalizeMetodo(query.metodo)) return false;
      if (query.cursoId && item.curso.id !== query.cursoId) return false;
      if (query.turmaId && item.turma.id !== query.turmaId) return false;
      if (query.valorMin !== undefined && item.valor < query.valorMin) return false;
      if (query.valorMax !== undefined && item.valor > query.valorMax) return false;
      const createdAt = new Date(item.criadoEm);
      if (query.dataInicio && createdAt < query.dataInicio) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const pageItems = filtered.slice((page - 1) * query.pageSize, page * query.pageSize);

    return {
      items: pageItems,
      summary,
      pendingCount,
      filters: {
        cursos,
        turmas,
        metodos: ['pix', 'boleto', 'credit_card'],
        status: ['PENDENTE', 'PROCESSANDO', 'APROVADO', 'RECUSADO', 'CANCELADO', 'ESTORNADO'],
      },
      pagination: { page, pageSize: query.pageSize, total, totalPages },
    };
  },

  async checkoutRecuperacao(alunoId: string, pagamentoId: string, input: CheckoutRecuperacaoInput) {
    const pagamento = await prisma.cursosRecuperacaoPagamentos.findFirst({
      where: { id: pagamentoId, alunoId },
      include: {
        CursosTurmasProvas: true,
        CursosTurmas: { include: { Cursos: true } },
      },
    });
    if (!pagamento) {
      const error: any = new Error('Cobranca de recuperacao nao encontrada');
      error.code = 'PAGAMENTO_NOT_FOUND';
      throw error;
    }
    if (normalizeStatus(pagamento.statusPagamento) === 'APROVADO') {
      const error: any = new Error('Cobranca ja paga');
      error.code = 'PAGAMENTO_JA_APROVADO';
      throw error;
    }

    assertMercadoPagoConfigured();
    const paymentApi = new Payment(mpClient!);
    const body: Record<string, unknown> = {
      transaction_amount: Number(pagamento.valor),
      description: pagamento.CursosTurmasProvas.titulo,
      external_reference: `recuperacao:${pagamento.id}`,
      payer: input.payer,
    };
    if (input.pagamento === 'pix') body.payment_method_id = 'pix';
    if (input.pagamento === 'boleto') body.payment_method_id = 'bolbradesco';
    if (input.pagamento === 'card') {
      body.token = input.card?.token;
      body.installments = input.card?.installments ?? 1;
    }

    const result: any = await paymentApi.create({ body: body as any });
    const payment = result?.body ?? result;
    const status = normalizeStatus(payment?.status);
    const details = payment?.point_of_interaction?.transaction_data ?? {};
    const metodo = input.pagamento === 'card' ? 'CARTAO_CREDITO' : input.pagamento.toUpperCase();

    await prisma.cursosRecuperacaoPagamentos.update({
      where: { id: pagamento.id },
      data: {
        statusPagamento: status,
        metodoPagamento: metodo,
        mpPaymentId: payment?.id ? String(payment.id) : null,
        pixQrCode: details?.qr_code ?? null,
        pixQrCodeBase64: details?.qr_code_base64 ?? null,
        boletoCodigo: payment?.barcode?.content ?? null,
        boletoUrl: payment?.transaction_details?.external_resource_url ?? null,
        expiraEm: payment?.date_of_expiration ? new Date(payment.date_of_expiration) : null,
        atualizadoEm: new Date(),
      },
    });

    if (status === 'APROVADO') {
      await this.aprovarRecuperacao(pagamento.id);
    }

    return {
      success: true,
      pagamento: {
        id: pagamento.id,
        statusPagamento: status,
        tipo: input.pagamento,
        paymentId: payment?.id ? String(payment.id) : null,
        qrCode: details?.qr_code ?? null,
        qrCodeBase64: details?.qr_code_base64 ?? null,
        barcode: payment?.barcode?.content ?? null,
        boletoUrl: payment?.transaction_details?.external_resource_url ?? null,
        expiresAt: payment?.date_of_expiration ?? null,
      },
    };
  },

  async aprovarRecuperacao(pagamentoId: string) {
    const pagamento = await prisma.cursosRecuperacaoPagamentos.findUnique({
      where: { id: pagamentoId },
      include: { CursosTurmas: { include: { Cursos: true } } },
    });
    if (!pagamento) return;

    await prisma.$transaction([
      prisma.cursosRecuperacaoPagamentos.update({
        where: { id: pagamento.id },
        data: { statusPagamento: 'APROVADO', pagoEm: new Date(), atualizadoEm: new Date() },
      }),
      prisma.cursosTurmasInscricoesProvasAcesso.upsert({
        where: {
          inscricaoId_provaId: { inscricaoId: pagamento.inscricaoId, provaId: pagamento.provaId },
        },
        create: {
          inscricaoId: pagamento.inscricaoId,
          provaId: pagamento.provaId,
          origem: 'PAGAMENTO_RECUPERACAO',
        },
        update: {
          liberadoEm: new Date(),
          origem: 'PAGAMENTO_RECUPERACAO',
          atualizadoEm: new Date(),
        },
      }),
    ]);

    await notificationSafe(() =>
      notificacoesService.notificarRecuperacaoFinalAprovada({
        alunoId: pagamento.alunoId,
        cursoId: pagamento.CursosTurmas.Cursos.id,
        cursoNome: pagamento.CursosTurmas.Cursos.nome,
        turmaId: pagamento.turmaId,
        turmaNome: pagamento.CursosTurmas.nome,
        provaId: pagamento.provaId,
      }),
    );
  },

  async processarWebhook(event: { type?: string; action?: string; data?: any }) {
    if (event.type !== 'payment' || !event.data?.id) return false;
    const pagamento = await prisma.cursosRecuperacaoPagamentos.findFirst({
      where: { mpPaymentId: String(event.data.id) },
      include: { CursosTurmas: { include: { Cursos: true } } },
    });
    if (!pagamento) return false;

    let payment = event.data;
    if (mpClient) {
      try {
        const fetched: any = await new Payment(mpClient).get({ id: String(event.data.id) });
        payment = fetched?.body ?? fetched;
      } catch (error) {
        pagamentosLogger.warn({ err: error }, 'Falha ao reconciliar pagamento no gateway');
      }
    }
    const status = normalizeStatus(payment?.status);
    await prisma.cursosRecuperacaoPagamentos.update({
      where: { id: pagamento.id },
      data: { statusPagamento: status, atualizadoEm: new Date() },
    });
    if (status === 'APROVADO') await this.aprovarRecuperacao(pagamento.id);
    if (status === 'RECUSADO') {
      await notificationSafe(() =>
        notificacoesService.notificarRecuperacaoFinalRecusada({
          alunoId: pagamento.alunoId,
          cursoId: pagamento.CursosTurmas.Cursos.id,
          cursoNome: pagamento.CursosTurmas.Cursos.nome,
          turmaId: pagamento.turmaId,
          turmaNome: pagamento.CursosTurmas.nome,
          provaId: pagamento.provaId,
          motivo: payment?.status_detail,
        }),
      );
    }
    return true;
  },

  async getAcessoRecuperacao(alunoId: string, inscricaoId: string, provaId: string) {
    const inscricao = await prisma.cursosTurmasInscricoes.findFirst({
      where: { id: inscricaoId, alunoId },
      select: { id: true, turmaId: true },
    });
    if (!inscricao) {
      const error: any = new Error('Inscricao nao encontrada');
      error.code = 'INSCRICAO_NOT_FOUND';
      throw error;
    }

    const provaRecuperacao = await prisma.cursosTurmasProvas.findFirst({
      where: {
        id: provaId,
        turmaId: inscricao.turmaId,
        recuperacaoFinal: true,
        ativo: true,
      },
      select: { id: true },
    });
    if (!provaRecuperacao) {
      return { requiresPayment: false, liberado: true, pagamento: null };
    }

    await this.reconciliarRecuperacoes(alunoId);
    const pagamento = await prisma.cursosRecuperacaoPagamentos.findUnique({
      where: { inscricaoId_provaId: { inscricaoId, provaId } },
    });
    if (!pagamento) return { requiresPayment: true, liberado: false, pagamento: null };
    const status = normalizeStatus(pagamento.statusPagamento);
    return {
      requiresPayment: true,
      liberado: status === 'APROVADO',
      pagamento: {
        id: pagamento.id,
        status,
        valor: Number(pagamento.valor),
      },
    };
  },
};

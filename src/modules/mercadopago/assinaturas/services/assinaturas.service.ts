import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig } from '@/config/env';
import { Preference, PreApproval } from 'mercadopago';
import crypto from 'crypto';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { METODO_PAGAMENTO, MODELO_PAGAMENTO, STATUS_PAGAMENTO, StatusVaga, PlanoParceiro } from '@prisma/client';

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function setVagasToDraft(usuarioId: string) {
  await prisma.vaga.updateMany({
    where: { usuarioId, status: { in: [StatusVaga.PUBLICADO, StatusVaga.EM_ANALISE] } },
    data: { status: StatusVaga.RASCUNHO },
  });
}

export const assinaturasService = {
  async startCheckout(params: {
    usuarioId: string;
    planoEmpresarialId: string;
    metodoPagamento: METODO_PAGAMENTO;
    modeloPagamento?: MODELO_PAGAMENTO;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }) {
    assertMercadoPagoConfigured();

    // Cria (ou atualiza) vínculo local do plano com status pendente
    const inicio = new Date();
    const proximaCobranca = addMonths(inicio, 1);

    const plano = await prisma.empresaPlano.create({
      data: {
        usuarioId: params.usuarioId,
        planoEmpresarialId: params.planoEmpresarialId,
        tipo: PlanoParceiro.PARCEIRO,
        modeloPagamento: params.modeloPagamento ?? MODELO_PAGAMENTO.ASSINATURA,
        metodoPagamento: params.metodoPagamento,
        statusPagamento: STATUS_PAGAMENTO.PENDENTE,
        inicio,
        proximaCobranca,
        observacao: 'Aguardando confirmação de pagamento (Mercado Pago)'
      },
      include: { plano: true },
    });

    const mp = mpClient!;
    let initPoint: string | null = null;
    try {
      const valor = parseFloat(plano.plano.valor);
      const titulo = plano.plano.nome;
      const success = params.successUrl || mercadopagoConfig.returnUrls.success;
      const failure = params.failureUrl || mercadopagoConfig.returnUrls.failure;
      const pending = params.pendingUrl || mercadopagoConfig.returnUrls.pending;

      // Busca email do usuário (payer_email exigido em preapproval)
      const usuario = await prisma.usuario.findUnique({ where: { id: params.usuarioId }, select: { email: true } });
      const payerEmail = usuario?.email || undefined;

      if (params.metodoPagamento === METODO_PAGAMENTO.CARTAO_CREDITO || params.metodoPagamento === METODO_PAGAMENTO.CARTAO_DEBITO) {
        // Assinatura recorrente real com cartão
        const preapproval = new PreApproval(mp);
        const result = await preapproval.create({
          body: {
            reason: titulo,
            external_reference: plano.id,
            back_url: success,
            payer_email: payerEmail,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: valor,
              currency_id: 'BRL',
              start_date: inicio.toISOString(),
            },
          },
        });
        initPoint = (result as any)?.sandbox_init_point || (result as any)?.init_point || null;
        // Persistir ID da assinatura
        await prisma.empresaPlano.update({ where: { id: plano.id }, data: { mpSubscriptionId: (result as any)?.id || null } });
      } else {
        // Checkout Pro (PIX/BOLETO ou cartão via preference) - recorrência assistida
        const preference = new Preference(mp);
        const pref = await preference.create({
          body: {
            external_reference: plano.id,
            auto_return: 'approved',
            back_urls: { success, failure, pending },
            items: [{ id: plano.plano.id, title: titulo, quantity: 1, unit_price: valor, currency_id: 'BRL' }],
            payer: payerEmail ? { email: payerEmail } : undefined,
          },
        });
        initPoint = (pref as any)?.sandbox_init_point || (pref as any)?.init_point || null;
      }
    } catch (e) {
      // Log da falha ficará a cargo do middleware de erro global/log
    }

    return { plano, initPoint };
  },

  async handleWebhook(event: { type?: string; action?: string; data?: any }) {
    // Estrutura genérica; ajuste para payload real do MP
    const { type, action, data } = event;

    // Exemplos: pagamentos aprovados
    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated')) {
      const mpPaymentId = String(data?.id ?? data?.payment?.id ?? '');
      if (!mpPaymentId) return;

      // Buscamos plano por payment ID ou via referência (custom data)
      // Supondo que enviamos "external_reference" como id do empresaPlano
      const externalRef = String(data?.external_reference ?? '');
      if (!externalRef) return;

      const plano = await prisma.empresaPlano.findUnique({ where: { id: externalRef } });
      if (!plano) return;

      const aprovado = ['approved', 'accredited'].includes(String(data?.status ?? '').toLowerCase());
      const pendente = ['pending', 'in_process'].includes(String(data?.status ?? '').toLowerCase());
      const recusado = ['rejected', 'cancelled'].includes(String(data?.status ?? '').toLowerCase());

      if (aprovado) {
        await prisma.empresaPlano.update({
          where: { id: plano.id },
          data: {
            statusPagamento: STATUS_PAGAMENTO.APROVADO,
            mpPaymentId,
            ativo: true,
            // Atualiza próxima cobrança
            proximaCobranca: addMonths(new Date(), 1),
            graceUntil: null,
          },
        });
      } else if (pendente) {
        await prisma.empresaPlano.update({
          where: { id: plano.id },
          data: {
            statusPagamento: STATUS_PAGAMENTO.EM_PROCESSAMENTO,
            mpPaymentId,
          },
        });
      } else if (recusado) {
        const grace = new Date();
        grace.setDate(grace.getDate() + 5);
        await prisma.empresaPlano.update({
          where: { id: plano.id },
          data: {
            statusPagamento: STATUS_PAGAMENTO.RECUSADO,
            mpPaymentId,
            graceUntil: grace,
          },
        });
      }
    }
  },

  async cancel(usuarioId: string, motivo?: string) {
    // Desativa plano atual e aplica regra de RASCUNHO nas vagas
    const planoAtivo = await prisma.empresaPlano.findFirst({ where: { usuarioId, ativo: true } });
    if (!planoAtivo) return { cancelled: false };

    await prisma.empresaPlano.update({
      where: { id: planoAtivo.id },
      data: {
        ativo: false,
        fim: new Date(),
        statusPagamento: STATUS_PAGAMENTO.CANCELADO,
        observacao: motivo ?? 'Cancelado pelo cliente',
      },
    });

    await setVagasToDraft(usuarioId);
    return { cancelled: true };
  },

  async downgrade(usuarioId: string, novoPlanoEmpresarialId: string) {
    // Cria nova vinculação com downgrade e coloca vagas em rascunho
    const result = await clientesService.assign({
      usuarioId,
      planoEmpresarialId: novoPlanoEmpresarialId,
      tipo: 'parceiro',
      observacao: 'Downgrade de plano via Mercado Pago',
    } as any);

    await setVagasToDraft(usuarioId);
    return result;
  },

  async upgrade(usuarioId: string, novoPlanoEmpresarialId: string) {
    // Cria nova vinculação sem alterar status das vagas
    const result = await clientesService.assign({
      usuarioId,
      planoEmpresarialId: novoPlanoEmpresarialId,
      tipo: 'parceiro',
      observacao: 'Upgrade de plano via Mercado Pago',
    } as any);
    return result;
  },

  async reconcile() {
    // Encerra planos vencidos além da tolerância e coloca vagas em rascunho
    const now = new Date();
    const overdue = await prisma.empresaPlano.findMany({
      where: {
        ativo: true,
        OR: [
          { graceUntil: { lt: now } },
          { proximaCobranca: { lt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    for (const plano of overdue) {
      await prisma.empresaPlano.update({
        where: { id: plano.id },
        data: { ativo: false, fim: now, statusPagamento: STATUS_PAGAMENTO.CANCELADO },
      });
      await setVagasToDraft(plano.usuarioId);
    }

    return { processed: overdue.length };
  },
};

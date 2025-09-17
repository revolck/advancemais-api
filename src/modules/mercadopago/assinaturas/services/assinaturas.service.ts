import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig } from '@/config/env';
import { Preference, PreApproval, PreApprovalPlan } from 'mercadopago';
import crypto from 'crypto';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { METODO_PAGAMENTO, MODELO_PAGAMENTO, STATUS_PAGAMENTO, StatusVaga, PlanoParceiro } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';

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
  async logEvent(data: {
    usuarioId?: string | null;
    empresaPlanoId?: string | null;
    tipo: string;
    status?: string | null;
    externalRef?: string | null;
    mpResourceId?: string | null;
    payload?: any;
    mensagem?: string | null;
  }) {
    try {
      await prisma.logPagamento.create({
        data: {
          usuarioId: data.usuarioId ?? null,
          empresaPlanoId: data.empresaPlanoId ?? null,
          tipo: data.tipo,
          status: data.status ?? null,
          externalRef: data.externalRef ?? null,
          mpResourceId: data.mpResourceId ?? null,
          payload: data.payload ?? undefined,
          mensagem: data.mensagem ?? null,
        },
      });
    } catch {}
  },
  async ensurePlanPreapproval(planId: string) {
    assertMercadoPagoConfigured();
    const plan = await prisma.planoEmpresarial.findUnique({ where: { id: planId }, select: { id: true, nome: true, valor: true, mpPreapprovalPlanId: true } });
    if (!plan) throw new Error('PlanoEmpresarial não encontrado');
    if (plan.mpPreapprovalPlanId) return plan.mpPreapprovalPlanId;

    const mp = mpClient!;
    const valor = parseFloat(plan.valor);
    const prePlan = new PreApprovalPlan(mp);
    const created = await prePlan.create({
      body: {
        reason: plan.nome,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: valor,
          currency_id: mercadopagoConfig.settings.defaultCurrency,
        },
      },
    });
    const id = (created as any)?.id as string | undefined;
    if (id) {
      await prisma.planoEmpresarial.update({ where: { id: plan.id }, data: { mpPreapprovalPlanId: id } });
      return id;
    }
    throw new Error('Falha ao criar PreApprovalPlan no Mercado Pago');
  },
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
    const inicio: Date | null = null; // será definido após aprovação
    const proximaCobranca: Date | null = null;

    const plano = await prisma.empresaPlano.create({
      data: {
        usuarioId: params.usuarioId,
        planoEmpresarialId: params.planoEmpresarialId,
        // Para assinatura mensal recorrente usamos o marcador ASSINATURA_MENSAL
        tipo: PlanoParceiro.ASSINATURA_MENSAL,
        modeloPagamento: params.modeloPagamento ?? MODELO_PAGAMENTO.ASSINATURA,
        metodoPagamento: params.metodoPagamento,
        statusPagamento: STATUS_PAGAMENTO.PENDENTE,
        inicio,
        proximaCobranca,
        observacao: 'Aguardando confirmação de pagamento (Mercado Pago)'
      },
      include: { plano: true },
    });

    await this.logEvent({ usuarioId: params.usuarioId, empresaPlanoId: plano.id, tipo: 'CHECKOUT_START', status: 'PENDENTE', externalRef: plano.id, payload: { metodo: params.metodoPagamento } });

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
        const preapprovalPlanId = await this.ensurePlanPreapproval(plano.planoEmpresarialId);
        const result = await preapproval.create({
          body: {
            reason: titulo,
            external_reference: plano.id,
            back_url: success,
            payer_email: payerEmail,
            preapproval_plan_id: preapprovalPlanId,
          },
        });
        initPoint = (result as any)?.sandbox_init_point || (result as any)?.init_point || null;
        // Persistir ID da assinatura
        await prisma.empresaPlano.update({ where: { id: plano.id }, data: { mpSubscriptionId: (result as any)?.id || null } });
        await this.logEvent({ usuarioId: params.usuarioId, empresaPlanoId: plano.id, tipo: 'PREAPPROVAL_CREATED', status: 'CRIADO', externalRef: plano.id, mpResourceId: (result as any)?.id || null });
      } else {
        // Checkout Pro (PIX/BOLETO ou cartão via preference) - recorrência assistida
        const preference = new Preference(mp);
        const payment_methods = ((): any => {
          const excludeCards = { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }] };
          if (params.metodoPagamento === METODO_PAGAMENTO.PIX) {
            return { ...excludeCards, excluded_payment_types: [...excludeCards.excluded_payment_types, { id: 'ticket' }] , default_payment_method_id: 'pix' };
          }
          if (params.metodoPagamento === METODO_PAGAMENTO.BOLETO) {
            return { ...excludeCards, default_payment_type_id: 'ticket' } as any;
          }
          return undefined;
        })();
        const pref = await preference.create({
          body: {
            external_reference: plano.id,
            auto_return: 'approved',
            back_urls: { success, failure, pending },
            items: [{ id: plano.plano.id, title: titulo, quantity: 1, unit_price: valor, currency_id: mercadopagoConfig.settings.defaultCurrency }],
            payer: payerEmail ? { email: payerEmail } : undefined,
            ...(payment_methods ? { payment_methods } : {}),
          },
        });
        initPoint = (pref as any)?.sandbox_init_point || (pref as any)?.init_point || null;
        await this.logEvent({ usuarioId: params.usuarioId, empresaPlanoId: plano.id, tipo: 'PREFERENCE_CREATED', status: 'CRIADO', externalRef: plano.id, mpResourceId: (pref as any)?.id || null });
      }
      if (!initPoint) {
        await this.logEvent({ usuarioId: params.usuarioId, empresaPlanoId: plano.id, tipo: 'CHECKOUT_NO_INITPOINT', status: 'ERRO', externalRef: plano.id });
        throw new Error('Não foi possível gerar o link de pagamento para o método selecionado');
      }
    } catch (e) {
      // Log da falha ficará a cargo do middleware de erro global/log
      await this.logEvent({ usuarioId: params.usuarioId, empresaPlanoId: plano.id, tipo: 'CHECKOUT_ERROR', status: 'ERRO', externalRef: plano.id, mensagem: e instanceof Error ? e.message : 'erro desconhecido' });
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
        await this.logEvent({ usuarioId: plano.usuarioId, empresaPlanoId: plano.id, tipo: 'PAYMENT_STATUS_UPDATE', status: 'APROVADO', externalRef, mpResourceId: mpPaymentId, payload: data });
        if (mercadopagoConfig.settings.emailsEnabled) {
          const usuario = await prisma.usuario.findUnique({ where: { id: plano.usuarioId }, select: { id: true, email: true, nomeCompleto: true, tipoUsuario: true } });
          if (usuario?.email) {
            const emailService = new EmailService();
            await emailService.sendAssinaturaNotificacao(
              { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
              { subject: '✅ Assinatura ativada', html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Sua assinatura foi ativada com sucesso.</p>`, text: `Olá, ${usuario.nomeCompleto}! Sua assinatura foi ativada com sucesso.` },
            );
          }
        }
      } else if (pendente) {
        await prisma.empresaPlano.update({
          where: { id: plano.id },
          data: {
            statusPagamento: STATUS_PAGAMENTO.EM_PROCESSAMENTO,
            mpPaymentId,
          },
        });
        await this.logEvent({ usuarioId: plano.usuarioId, empresaPlanoId: plano.id, tipo: 'PAYMENT_STATUS_UPDATE', status: 'EM_PROCESSAMENTO', externalRef, mpResourceId: mpPaymentId, payload: data });
      } else if (recusado) {
        const grace = new Date();
        grace.setDate(grace.getDate() + (mercadopagoConfig.settings.graceDays || 5));
        await prisma.empresaPlano.update({
          where: { id: plano.id },
          data: {
            statusPagamento: STATUS_PAGAMENTO.RECUSADO,
            mpPaymentId,
            graceUntil: grace,
          },
        });
        await this.logEvent({ usuarioId: plano.usuarioId, empresaPlanoId: plano.id, tipo: 'PAYMENT_STATUS_UPDATE', status: 'RECUSADO', externalRef, mpResourceId: mpPaymentId, payload: data });
        if (mercadopagoConfig.settings.emailsEnabled) {
          const usuario = await prisma.usuario.findUnique({ where: { id: plano.usuarioId }, select: { id: true, email: true, nomeCompleto: true } });
          if (usuario?.email) {
            const url = mercadopagoConfig.settings.billingPortalUrl || mercadopagoConfig.returnUrls.failure;
            const emailService = new EmailService();
            await emailService.sendAssinaturaNotificacao(
              { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
              { subject: '⚠️ Problema na cobrança da sua assinatura', html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Não foi possível cobrar seu método de pagamento. Seu acesso será mantido por enquanto. Por favor, atualize seus dados de pagamento: <a href="${url}">${url}</a>.</p>`, text: `Olá, ${usuario.nomeCompleto}! Não foi possível cobrar seu método de pagamento. Atualize seus dados de pagamento: ${url}.` },
            );
          }
        }
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
    await this.logEvent({ usuarioId, empresaPlanoId: planoAtivo.id, tipo: 'CANCEL', status: 'CANCELADO', mensagem: motivo || null });

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

  async remindPayment(usuarioId: string) {
    assertMercadoPagoConfigured();
    const plano = await prisma.empresaPlano.findFirst({
      where: { usuarioId, ativo: true },
      include: { plano: true },
      orderBy: { criadoEm: 'desc' },
    });
    if (!plano) throw new Error('Plano ativo não encontrado para o usuário');

    // Gera nova cobrança (Preference) e envia email com link
    const mp = mpClient!;
    const preference = new Preference(mp);
    const valor = parseFloat(plano.plano.valor);
    const titulo = plano.plano.nome + ' - Renovação';
    const success = mercadopagoConfig.returnUrls.success;
    const failure = mercadopagoConfig.returnUrls.failure;
    const pending = mercadopagoConfig.returnUrls.pending;

    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, nomeCompleto: true } });
    const payerEmail = usuario?.email || undefined;

    const pref = await preference.create({
      body: {
        external_reference: plano.id,
        auto_return: 'approved',
        back_urls: { success, failure, pending },
        items: [{ id: plano.plano.id, title: titulo, quantity: 1, unit_price: valor, currency_id: mercadopagoConfig.settings.defaultCurrency }],
        payer: payerEmail ? { email: payerEmail } : undefined,
      },
    });

    const link = (pref as any)?.sandbox_init_point || (pref as any)?.init_point || '';

    if (usuario?.email && mercadopagoConfig.settings.emailsEnabled) {
      const emailService = new EmailService();
      await emailService.sendGeneric(
        usuario.email,
        usuario.nomeCompleto || 'Cliente',
        '🔔 Lembrete de pagamento da sua assinatura',
        `<p>Olá, ${usuario.nomeCompleto}!</p><p>Segue o link para pagamento da sua assinatura: <a href="${link}">${link}</a>.</p>`,
        `Olá, ${usuario.nomeCompleto}! Link para pagamento: ${link}`,
      );
    }

    await this.logEvent({ usuarioId, empresaPlanoId: plano.id, tipo: 'REMINDER_SENT', status: 'ENVIADO', externalRef: plano.id, mpResourceId: (pref as any)?.id || null });

    return { initPoint: link };
  },

  async adminRemindPaymentForPlan(params: {
    usuarioId: string;
    planoEmpresarialId: string;
    metodoPagamento?: METODO_PAGAMENTO;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }) {
    // Reutiliza fluxo do checkout para criar um vínculo pendente e preference
    return this.startCheckout({
      usuarioId: params.usuarioId,
      planoEmpresarialId: params.planoEmpresarialId,
      metodoPagamento: params.metodoPagamento || METODO_PAGAMENTO.PIX,
      modeloPagamento: MODELO_PAGAMENTO.ASSINATURA,
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      pendingUrl: params.pendingUrl,
    });
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
      await this.logEvent({ usuarioId: plano.usuarioId, empresaPlanoId: plano.id, tipo: 'RECONCILE_CANCEL', status: 'CANCELADO' });
      if (mercadopagoConfig.settings.emailsEnabled) {
        const usuario = await prisma.usuario.findUnique({ where: { id: plano.usuarioId }, select: { email: true, nomeCompleto: true } });
        if (usuario?.email) {
          const emailService = new EmailService();
          await emailService.sendGeneric(
            usuario.email,
            usuario.nomeCompleto,
            '❌ Assinatura cancelada por falta de pagamento',
            `<p>Olá, ${usuario.nomeCompleto}!</p><p>Sua assinatura foi cancelada após ${mercadopagoConfig.settings.graceDays} dias sem pagamento. Caso queira reativar, contrate um plano novamente.</p>`,
            `Olá, ${usuario.nomeCompleto}! Sua assinatura foi cancelada após ${mercadopagoConfig.settings.graceDays} dias sem pagamento.`,
          );
        }
      }
    }

    return { processed: overdue.length };
  },
};

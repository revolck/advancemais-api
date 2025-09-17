import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig, serverConfig } from '@/config/env';
import { Preference, PreApproval, PreApprovalPlan } from 'mercadopago';
import crypto from 'crypto';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { METODO_PAGAMENTO, MODELO_PAGAMENTO, STATUS_PAGAMENTO, StatusVaga, PlanoParceiro } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';

type MercadoPagoResponse<T = any> = {
  body?: T;
  [key: string]: any;
};

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function extractInitPoint(result: MercadoPagoResponse): string | null {
  if (!result) return null;
  const body = result.body ?? result;
  return (
    body?.init_point ||
    body?.initPoint ||
    result?.init_point ||
    result?.initPoint ||
    body?.sandbox_init_point ||
    body?.sandboxInitPoint ||
    result?.sandbox_init_point ||
    result?.sandboxInitPoint ||
    null
  );
}

function extractResourceId(result: MercadoPagoResponse): string | null {
  if (!result) return null;
  const body = result.body ?? result;
  return (
    body?.id ||
    body?.preapproval_id ||
    body?.preference_id ||
    result?.id ||
    null
  );
}

function firstNonEmptyUrl(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    if (typeof url === 'string') {
      const trimmed = url.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

export function resolveCheckoutReturnUrls(params?: {
  successUrl?: string;
  failureUrl?: string;
  pendingUrl?: string;
}) {
  const overrides = params ?? {};
  const fallbackBase =
    firstNonEmptyUrl(
      mercadopagoConfig.returnUrls.success,
      mercadopagoConfig.returnUrls.pending,
      mercadopagoConfig.returnUrls.failure,
      serverConfig.frontendUrl,
    ) || serverConfig.frontendUrl;

  const success =
    firstNonEmptyUrl(overrides.successUrl, mercadopagoConfig.returnUrls.success, fallbackBase) || fallbackBase;
  const failure =
    firstNonEmptyUrl(overrides.failureUrl, mercadopagoConfig.returnUrls.failure, success, fallbackBase) || success;
  const pending =
    firstNonEmptyUrl(overrides.pendingUrl, mercadopagoConfig.returnUrls.pending, success, failure, fallbackBase) || success;

  return { success, failure, pending };
}

function normalizeMercadoPagoError(error: unknown): { message: string; payload?: any } {
  if (error instanceof Error) {
    return { message: error.message, payload: { name: error.name, message: error.message, stack: error.stack } };
  }

  if (error && typeof error === 'object') {
    const errObj = error as any;
    const message =
      errObj?.message ||
      errObj?.description ||
      errObj?.error ||
      errObj?.status_detail ||
      errObj?.response?.data?.message ||
      errObj?.response?.data?.error ||
      errObj?.response?.message ||
      'erro desconhecido';

    const payload = errObj?.response?.data ?? errObj;

    return { message: String(message), payload };
  }

  return { message: String(error ?? 'erro desconhecido'), payload: error };
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
    } catch (error) {
      // Ignoramos falhas de logging para não interromper o fluxo principal
      void error;
    }
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
  async ensureEmpresaPlanoFromCheckout(externalRef: string) {
    const existing = await prisma.empresaPlano.findUnique({ where: { id: externalRef } });
    if (existing) return existing;

    const checkoutLog = await prisma.logPagamento.findFirst({
      where: { externalRef, tipo: 'CHECKOUT_START' },
      orderBy: { criadoEm: 'desc' },
    });

    if (!checkoutLog?.usuarioId) return null;
    const payload = (checkoutLog.payload as any) || {};
    const planoEmpresarialId = payload.planoEmpresarialId as string | undefined;
    if (!planoEmpresarialId) return null;

    const modeloPagamento = (payload.modeloPagamento as MODELO_PAGAMENTO | undefined) ?? MODELO_PAGAMENTO.ASSINATURA;
    const metodoPagamento = payload.metodoPagamento as METODO_PAGAMENTO | undefined;
    const observacao = typeof payload.observacao === 'string' ? payload.observacao : 'Aguardando confirmação de pagamento (Mercado Pago)';

    const created = await prisma.empresaPlano.create({
      data: {
        id: externalRef,
        usuarioId: checkoutLog.usuarioId,
        planoEmpresarialId,
        tipo: PlanoParceiro.ASSINATURA_MENSAL,
        modeloPagamento,
        metodoPagamento: metodoPagamento ?? null,
        statusPagamento: STATUS_PAGAMENTO.PENDENTE,
        observacao,
        inicio: null,
        proximaCobranca: null,
        graceUntil: null,
        ativo: false,
      },
    });

    const subscriptionLog = await prisma.logPagamento.findFirst({
      where: { externalRef, tipo: 'PREAPPROVAL_CREATED' },
      orderBy: { criadoEm: 'desc' },
    });

    let updated = created;
    if (subscriptionLog?.mpResourceId) {
      updated = await prisma.empresaPlano.update({ where: { id: created.id }, data: { mpSubscriptionId: subscriptionLog.mpResourceId } });
    }

    await prisma.logPagamento.updateMany({ where: { externalRef }, data: { empresaPlanoId: created.id } });

    return updated;
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

    const planoBase = await prisma.planoEmpresarial.findUnique({ where: { id: params.planoEmpresarialId } });
    if (!planoBase) {
      throw new Error('PlanoEmpresarial não encontrado');
    }

    const checkoutId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const modeloPagamento = params.modeloPagamento ?? MODELO_PAGAMENTO.ASSINATURA;

    await this.logEvent({
      usuarioId: params.usuarioId,
      tipo: 'CHECKOUT_START',
      status: 'PENDENTE',
      externalRef: checkoutId,
      payload: {
        planoEmpresarialId: params.planoEmpresarialId,
        metodoPagamento: params.metodoPagamento,
        modeloPagamento,
        observacao: 'Aguardando confirmação de pagamento (Mercado Pago)',
      },
    });

    const mp = mpClient!;
    let initPoint: string | null = null;
    try {
      const valor = parseFloat(planoBase.valor);
      const titulo = planoBase.nome;
      const { success, failure, pending } = resolveCheckoutReturnUrls({
        successUrl: params.successUrl,
        failureUrl: params.failureUrl,
        pendingUrl: params.pendingUrl,
      });

      // Busca email do usuário (payer_email exigido em preapproval)
      const usuario = await prisma.usuario.findUnique({ where: { id: params.usuarioId }, select: { email: true } });
      const payerEmail = usuario?.email || undefined;

      if (params.metodoPagamento === METODO_PAGAMENTO.CARTAO_CREDITO || params.metodoPagamento === METODO_PAGAMENTO.CARTAO_DEBITO) {
        // Assinatura recorrente real com cartão
        const preapproval = new PreApproval(mp);
        const preapprovalPlanId = await this.ensurePlanPreapproval(params.planoEmpresarialId);
        const result = (await preapproval.create({
          body: {
            reason: titulo,
            external_reference: checkoutId,
            back_url: success,
            payer_email: payerEmail,
            preapproval_plan_id: preapprovalPlanId,
          },
        })) as MercadoPagoResponse;
        initPoint = extractInitPoint(result);
        // Persistir ID da assinatura
        await this.logEvent({
          usuarioId: params.usuarioId,
          tipo: 'PREAPPROVAL_CREATED',
          status: 'CRIADO',
          externalRef: checkoutId,
          mpResourceId: extractResourceId(result),
          payload: result.body ?? result,
        });
      } else {
        // Checkout Pro (PIX/BOLETO ou cartão via preference) - recorrência assistida
        const preference = new Preference(mp);
        const payment_methods = ((): Record<string, unknown> | undefined => {
          const excludedPaymentTypesBase = [{ id: 'credit_card' }, { id: 'debit_card' }];
          if (params.metodoPagamento === METODO_PAGAMENTO.PIX) {
            return {
              excluded_payment_types: [...excludedPaymentTypesBase, { id: 'ticket' }],
              default_payment_type_id: 'bank_transfer',
            };
          }
          if (params.metodoPagamento === METODO_PAGAMENTO.BOLETO) {
            return {
              excluded_payment_types: [...excludedPaymentTypesBase, { id: 'bank_transfer' }],
              default_payment_type_id: 'ticket',
            };
          }
          if (excludedPaymentTypesBase.length) {
            return { excluded_payment_types: excludedPaymentTypesBase };
          }
          return undefined;
        })();
        const pref = (await preference.create({
          body: {
            external_reference: checkoutId,
            auto_return: 'approved',
            back_urls: { success, failure, pending },
            items: [{ id: planoBase.id, title: titulo, quantity: 1, unit_price: valor, currency_id: mercadopagoConfig.settings.defaultCurrency }],
            payer: payerEmail ? { email: payerEmail } : undefined,
            ...(payment_methods ? { payment_methods } : {}),
          },
        })) as MercadoPagoResponse;
        initPoint = extractInitPoint(pref);
        await this.logEvent({
          usuarioId: params.usuarioId,
          tipo: 'PREFERENCE_CREATED',
          status: 'CRIADO',
          externalRef: checkoutId,
          mpResourceId: extractResourceId(pref),
          payload: pref.body ?? pref,
        });
      }
      if (!initPoint) {
        await this.logEvent({ usuarioId: params.usuarioId, tipo: 'CHECKOUT_NO_INITPOINT', status: 'ERRO', externalRef: checkoutId });
        throw new Error('Não foi possível gerar o link de pagamento para o método selecionado');
      }
    } catch (e) {
      const normalized = normalizeMercadoPagoError(e);
      await this.logEvent({
        usuarioId: params.usuarioId,
        tipo: 'CHECKOUT_ERROR',
        status: 'ERRO',
        externalRef: checkoutId,
        mensagem: normalized.message,
        payload: normalized.payload,
      });
      throw new Error(`Erro ao iniciar checkout no Mercado Pago: ${normalized.message}`);
    }

    const planoSnapshot = {
      id: checkoutId,
      usuarioId: params.usuarioId,
      planoEmpresarialId: params.planoEmpresarialId,
      tipo: PlanoParceiro.ASSINATURA_MENSAL,
      inicio: null as Date | null,
      fim: null as Date | null,
      ativo: false,
      observacao: 'Aguardando confirmação de pagamento (Mercado Pago)',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      modeloPagamento,
      metodoPagamento: params.metodoPagamento,
      statusPagamento: STATUS_PAGAMENTO.PENDENTE,
      mpPreapprovalId: null as string | null,
      mpSubscriptionId: null as string | null,
      mpPayerId: null as string | null,
      mpPaymentId: null as string | null,
      proximaCobranca: null as Date | null,
      graceUntil: null as Date | null,
      plano: planoBase,
    };

    return { plano: planoSnapshot, initPoint, checkoutId };
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

      let plano = await prisma.empresaPlano.findUnique({ where: { id: externalRef } });
      if (!plano) {
        plano = await this.ensureEmpresaPlanoFromCheckout(externalRef);
      }
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
    const { success, failure, pending } = resolveCheckoutReturnUrls();

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

    const link =
      (pref as any)?.init_point ||
      (pref as any)?.initPoint ||
      (pref as any)?.sandbox_init_point ||
      (pref as any)?.sandboxInitPoint ||
      '';

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

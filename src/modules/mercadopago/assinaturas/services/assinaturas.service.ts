import { prisma } from '@/config/prisma';
import { mpClient, assertMercadoPagoConfigured } from '@/config/mercadopago';
import { mercadopagoConfig, serverConfig } from '@/config/env';
import { PreApproval, PreApprovalPlan, Payment, Preference } from 'mercadopago';
import crypto from 'crypto';
import { clientesService } from '@/modules/empresas/clientes/services/clientes.service';
import { METODO_PAGAMENTO, MODELO_PAGAMENTO, STATUS_PAGAMENTO, StatusDeVagas, TiposDePlanos } from '@prisma/client';
import type { PlanosEmpresariais } from '@prisma/client';
import { EmailService } from '@/modules/brevo/services/email-service';
import type { StartCheckoutInput } from '@/modules/mercadopago/assinaturas/validators/assinaturas.schema';

type MercadoPagoResponse<T = any> = {
  body?: T;
  [key: string]: any;
};

type CheckoutPagamento = NonNullable<StartCheckoutInput['pagamento']>;

type PlanosEmpresariaisSnapshot = {
  id: string;
  usuarioId: string;
  planosEmpresariaisId: string;
  tipo: TiposDePlanos;
  inicio: Date | null;
  fim: Date | null;
  ativo: boolean;
  observacao: string;
  criadoEm: Date;
  atualizadoEm: Date;
  modeloPagamento: MODELO_PAGAMENTO;
  metodoPagamento: METODO_PAGAMENTO;
  statusPagamento: STATUS_PAGAMENTO;
  mpPreapprovalId: string | null;
  mpSubscriptionId: string | null;
  mpPayerId: string | null;
  mpPaymentId: string | null;
  proximaCobranca: Date | null;
  graceUntil: Date | null;
  plano: PlanosEmpresariais;
};

const pagamentoToMetodo: Record<CheckoutPagamento, METODO_PAGAMENTO> = {
  pix: METODO_PAGAMENTO.PIX,
  card: METODO_PAGAMENTO.CARTAO_CREDITO,
  boleto: METODO_PAGAMENTO.BOLETO,
};

const PAYMENT_APPROVED_STATUSES = new Set(['approved', 'accredited', 'authorized', 'authorized_for_collect', 'active']);
const PAYMENT_PENDING_STATUSES = new Set(['pending', 'in_process']);
const PAYMENT_REJECTED_STATUSES = new Set(['rejected', 'charged_back', 'chargeback']);
const PAYMENT_CANCELLED_STATUSES = new Set(['cancelled', 'cancelled_by_collector', 'cancelled_by_user', 'expired']);

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function sanitizeDigits(value?: string | null) {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

function splitName(fullName?: string | null) {
  if (!fullName) return { firstName: undefined, lastName: undefined };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.length ? rest.join(' ') : undefined };
}

function mapToStatusPagamento(status: string | null | undefined): STATUS_PAGAMENTO {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (PAYMENT_APPROVED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.APROVADO;
  if (PAYMENT_PENDING_STATUSES.has(normalized)) return STATUS_PAGAMENTO.EM_PROCESSAMENTO;
  if (PAYMENT_CANCELLED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.CANCELADO;
  if (PAYMENT_REJECTED_STATUSES.has(normalized)) return STATUS_PAGAMENTO.RECUSADO;
  return STATUS_PAGAMENTO.PENDENTE;
}

async function createOrUpdateCheckoutEmpresasPlano(params: {
  checkoutId: string;
  usuarioId: string;
  planosEmpresariaisId: string;
  metodoPagamento: METODO_PAGAMENTO;
  modeloPagamento: MODELO_PAGAMENTO;
  statusPagamento: STATUS_PAGAMENTO;
  observacao?: string;
  ativo?: boolean;
  inicio?: Date | null;
  fim?: Date | null;
  proximaCobranca?: Date | null;
  graceUntil?: Date | null;
  mpPreapprovalId?: string | null;
  mpSubscriptionId?: string | null;
  mpPayerId?: string | null;
  mpPaymentId?: string | null;
}) {
  const data = {
    usuarioId: params.usuarioId,
    planosEmpresariaisId: params.planosEmpresariaisId,
    tipo: TiposDePlanos.ASSINATURA_MENSAL,
    observacao: params.observacao ?? 'Aguardando confirmação de pagamento (Mercado Pago)',
    modeloPagamento: params.modeloPagamento,
    metodoPagamento: params.metodoPagamento,
    statusPagamento: params.statusPagamento,
    ativo: params.ativo ?? false,
    inicio: params.inicio ?? null,
    fim: params.fim ?? null,
    proximaCobranca: params.proximaCobranca ?? null,
    graceUntil: params.graceUntil ?? null,
    mpPreapprovalId: params.mpPreapprovalId ?? null,
    mpSubscriptionId: params.mpSubscriptionId ?? null,
    mpPayerId: params.mpPayerId ?? null,
    mpPaymentId: params.mpPaymentId ?? null,
  };

  return prisma.empresasPlano.upsert({
    where: { id: params.checkoutId },
    create: {
      id: params.checkoutId,
      ...data,
    },
    update: {
      ...data,
      atualizadoEm: new Date(),
    },
  });
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

function firstNonEmptyUrl(...urls: (string | null | undefined)[]): string | null {
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
  await prisma.empresasVagas.updateMany({
    where: { usuarioId, status: { in: [StatusDeVagas.PUBLICADO, StatusDeVagas.EM_ANALISE] } },
    data: { status: StatusDeVagas.RASCUNHO },
  });
}

export const assinaturasService = {
  async logEvent(data: {
    usuarioId?: string | null;
    empresasPlanoId?: string | null;
    tipo: string;
    status?: string | null;
    externalRef?: string | null;
    mpResourceId?: string | null;
    payload?: any;
    mensagem?: string | null;
  }) {
    try {
      await prisma.logsPagamentosDeAssinaturas.create({
        data: {
          usuarioId: data.usuarioId ?? null,
          empresasPlanoId: data.empresasPlanoId ?? null,
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
    const plan = await prisma.planosEmpresariais.findUnique({ where: { id: planId }, select: { id: true, nome: true, valor: true, mpPreapprovalPlanId: true } });
    if (!plan) throw new Error('PlanosEmpresariais não encontrado');
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
      await prisma.planosEmpresariais.update({ where: { id: plan.id }, data: { mpPreapprovalPlanId: id } });
      return id;
    }
    throw new Error('Falha ao criar PreApprovalPlan no Mercado Pago');
  },
  async ensureEmpresasPlanoFromCheckout(externalRef: string) {
    const existing = await prisma.empresasPlano.findUnique({ where: { id: externalRef } });
    if (existing) return existing;

    const checkoutLog = await prisma.logsPagamentosDeAssinaturas.findFirst({
      where: { externalRef, tipo: 'CHECKOUT_START' },
      orderBy: { criadoEm: 'desc' },
    });

    if (!checkoutLog?.usuarioId) return null;
    const payload = (checkoutLog.payload as any) || {};
    const planosEmpresariaisId = payload.planosEmpresariaisId as string | undefined;
    if (!planosEmpresariaisId) return null;

    const modeloPagamento = (payload.modeloPagamento as MODELO_PAGAMENTO | undefined) ?? MODELO_PAGAMENTO.ASSINATURA;
    const metodoPagamento = payload.metodoPagamento as METODO_PAGAMENTO | undefined;
    const observacao = typeof payload.observacao === 'string' ? payload.observacao : 'Aguardando confirmação de pagamento (Mercado Pago)';

    const created = await prisma.empresasPlano.create({
      data: {
        id: externalRef,
        usuarioId: checkoutLog.usuarioId,
        planosEmpresariaisId,
        tipo: TiposDePlanos.ASSINATURA_MENSAL,
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

    const subscriptionLog = await prisma.logsPagamentosDeAssinaturas.findFirst({
      where: { externalRef, tipo: 'PREAPPROVAL_CREATED' },
      orderBy: { criadoEm: 'desc' },
    });

    let updated = created;
    if (subscriptionLog?.mpResourceId) {
      updated = await prisma.empresasPlano.update({ where: { id: created.id }, data: { mpSubscriptionId: subscriptionLog.mpResourceId } });
    }

    await prisma.logsPagamentosDeAssinaturas.updateMany({ where: { externalRef }, data: { empresasPlanoId: created.id } });

    return updated;
  },
  async startCheckout(params: StartCheckoutInput) {
    assertMercadoPagoConfigured();

    const planoBase = await prisma.planosEmpresariais.findUnique({ where: { id: params.planosEmpresariaisId } });
    if (!planoBase) {
      throw new Error('PlanosEmpresariais não encontrado');
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: params.usuarioId },
      include: { enderecos: { take: 1, orderBy: { criadoEm: 'asc' } } },
    });
    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    const checkoutId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const isAssinatura = params.metodo === 'assinatura';
    const pagamentoSelecionado: CheckoutPagamento = isAssinatura
      ? (params.pagamento ?? 'card')
      : (params.pagamento as CheckoutPagamento);
    const metodoPagamento = isAssinatura
      ? METODO_PAGAMENTO.CARTAO_CREDITO
      : pagamentoToMetodo[pagamentoSelecionado];
    const modeloPagamento = isAssinatura
      ? MODELO_PAGAMENTO.ASSINATURA
      : pagamentoSelecionado === 'card' && params.card?.installments && params.card.installments > 1
        ? MODELO_PAGAMENTO.PAGAMENTO_PARCELADO
        : MODELO_PAGAMENTO.PAGAMENTO_UNICO;
    const paymentMode = isAssinatura
      ? params.card?.token
        ? 'DIRECT'
        : 'CHECKOUT_PRO'
      : 'DIRECT';

    await this.logEvent({
      usuarioId: params.usuarioId,
      tipo: 'CHECKOUT_START',
      status: 'PENDENTE',
      externalRef: checkoutId,
      payload: {
        planosEmpresariaisId: params.planosEmpresariaisId,
        metodo: params.metodo,
        pagamento: pagamentoSelecionado,
        modeloPagamento,
        paymentMode,
        observacao: 'Aguardando confirmação de pagamento (Mercado Pago)',
      },
    });

    const mp = mpClient!;
    const valor = parseFloat(planoBase.valor);
    const titulo = planoBase.nome;
    const { success } = resolveCheckoutReturnUrls({
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      pendingUrl: params.pendingUrl,
    });

    const { firstName, lastName } = splitName(usuario.nomeCompleto);
    const documento = (() => {
      const cnpj = sanitizeDigits(usuario.cnpj);
      if (cnpj) return { type: 'CNPJ', number: cnpj };
      const cpf = sanitizeDigits(usuario.cpf);
      if (cpf) return { type: 'CPF', number: cpf };
      return undefined;
    })();
    const endereco = usuario.enderecos?.[0];
    const payerAddress = endereco
      ? {
          zip_code: sanitizeDigits(endereco.cep),
          street_name: endereco.logradouro,
          street_number: endereco.numero,
          neighborhood: endereco.bairro,
          city: endereco.cidade,
          federal_unit: endereco.estado,
        }
      : undefined;
    const phoneDigits = sanitizeDigits(usuario.telefone);
    const payerPhone = phoneDigits.length >= 10
      ? {
          area_code: phoneDigits.slice(0, 2),
          number: phoneDigits.slice(2),
        }
      : undefined;

    const payerBase = {
      email: usuario.email,
      first_name: firstName,
      last_name: lastName,
      identification: documento && documento.number ? documento : undefined,
      address: payerAddress && payerAddress.zip_code ? payerAddress : undefined,
      phone: payerPhone,
    };

    const planoSnapshot: PlanosEmpresariaisSnapshot = {
      id: checkoutId,
      usuarioId: params.usuarioId,
      planosEmpresariaisId: params.planosEmpresariaisId,
      tipo: TiposDePlanos.ASSINATURA_MENSAL,
      inicio: null,
      fim: null,
      ativo: false,
      observacao: 'Aguardando confirmação de pagamento (Mercado Pago)',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      modeloPagamento,
      metodoPagamento,
      statusPagamento: STATUS_PAGAMENTO.PENDENTE,
      mpPreapprovalId: null,
      mpSubscriptionId: null,
      mpPayerId: null,
      mpPaymentId: null,
      proximaCobranca: null,
      graceUntil: null,
      plano: planoBase,
    };

    try {
      if (isAssinatura) {
        const preapproval = new PreApproval(mp);
        const preapprovalPlanId = await this.ensurePlanPreapproval(params.planosEmpresariaisId);
        const requestBody: Record<string, any> = {
          reason: titulo,
          external_reference: checkoutId,
          back_url: success,
          payer_email: usuario.email,
          preapproval_plan_id: preapprovalPlanId,
        };
        if (params.card?.token) {
          requestBody.status = 'authorized';
          requestBody.card_token_id = params.card.token;
          if (documento?.number) {
            requestBody.payer_identification = documento;
          }
        }

        const result = (await preapproval.create({ body: requestBody })) as MercadoPagoResponse;
        const body = result.body ?? result;
        const subscriptionId = extractResourceId(result);
        const mpPayerId = body?.payer_id ? String(body.payer_id) : body?.payer?.id ? String(body.payer.id) : null;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
        const inicio = ativo ? new Date() : null;
        const proximaCobranca = ativo ? addMonths(new Date(), 1) : null;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          ativo,
          inicio,
          proximaCobranca,
          mpPreapprovalId: subscriptionId,
          mpSubscriptionId: subscriptionId,
          mpPayerId,
          observacao: ativo
            ? 'Assinatura confirmada com cartão via Mercado Pago'
            : 'Assinatura aguardando confirmação de cartão via Mercado Pago',
        });

        if (ativo) {
          await prisma.empresasPlano.updateMany({
            where: { usuarioId: params.usuarioId, ativo: true, NOT: { id: checkoutId } },
            data: { ativo: false, fim: new Date() },
          });
        }

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.ativo = ativo;
        planoSnapshot.inicio = inicio;
        planoSnapshot.proximaCobranca = proximaCobranca;
        planoSnapshot.mpPreapprovalId = subscriptionId;
        planoSnapshot.mpSubscriptionId = subscriptionId;
        planoSnapshot.mpPayerId = mpPayerId;
        planoSnapshot.observacao = ativo
          ? 'Assinatura confirmada com cartão via Mercado Pago'
          : 'Assinatura aguardando confirmação de cartão via Mercado Pago';

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PREAPPROVAL_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: subscriptionId,
          payload: body,
        });

        return {
          checkoutId,
          plano: planoSnapshot,
          assinatura: {
            preapprovalId: subscriptionId,
            status: body?.status ?? null,
            initPoint: extractInitPoint(result),
            requiresRedirect: !params.card?.token,
          },
        };
      }

      const paymentApi = new Payment(mp);
      if (pagamentoSelecionado === 'pix') {
        const payment = (await paymentApi.create({
          body: {
            transaction_amount: valor,
            description: titulo,
            payment_method_id: 'pix',
            external_reference: checkoutId,
            payer: payerBase,
          },
        })) as MercadoPagoResponse;
        const body = payment.body ?? payment;
        const mpPaymentId = body?.id ? String(body.id) : undefined;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
        const expiration = body?.date_of_expiration ? new Date(body.date_of_expiration) : null;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          ativo,
          mpPaymentId: mpPaymentId ?? null,
          proximaCobranca: expiration,
          graceUntil: expiration,
          observacao: 'Pagamento PIX aguardando confirmação via Mercado Pago',
        });

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.ativo = ativo;
        planoSnapshot.mpPaymentId = mpPaymentId ?? null;
        planoSnapshot.proximaCobranca = expiration;
        planoSnapshot.graceUntil = expiration;
        planoSnapshot.observacao = 'Pagamento PIX aguardando confirmação via Mercado Pago';

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PAYMENT_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: mpPaymentId ?? null,
          payload: body,
        });

        const transactionData = body?.point_of_interaction?.transaction_data || {};
        return {
          checkoutId,
          plano: planoSnapshot,
          pagamento: {
            tipo: 'pix',
            status: body?.status ?? null,
            paymentId: mpPaymentId ?? null,
            qrCode: transactionData.qr_code || null,
            qrCodeBase64: transactionData.qr_code_base64 || null,
            expiresAt: body?.date_of_expiration || null,
          },
        };
      }

      if (pagamentoSelecionado === 'card') {
        const cardData = params.card;
        if (!cardData?.token) {
          throw new Error('Token do cartão é obrigatório para pagamentos com cartão');
        }
        const installments = cardData.installments ?? 1;
        const payment = (await paymentApi.create({
          body: {
            transaction_amount: valor,
            description: titulo,
            token: cardData.token,
            installments,
            external_reference: checkoutId,
            payer: payerBase,
          },
        })) as MercadoPagoResponse;
        const body = payment.body ?? payment;
        const mpPaymentId = body?.id ? String(body.id) : undefined;
        const statusPagamento = mapToStatusPagamento(body?.status);
        const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;

        await createOrUpdateCheckoutEmpresasPlano({
          checkoutId,
          usuarioId: params.usuarioId,
          planosEmpresariaisId: params.planosEmpresariaisId,
          metodoPagamento,
          modeloPagamento,
          statusPagamento,
          ativo,
          inicio: ativo ? new Date() : null,
          observacao: ativo
            ? 'Pagamento aprovado com cartão via Mercado Pago'
            : 'Pagamento com cartão aguardando confirmação via Mercado Pago',
          mpPaymentId: mpPaymentId ?? null,
        });

        if (ativo) {
          await prisma.empresasPlano.updateMany({
            where: { usuarioId: params.usuarioId, ativo: true, NOT: { id: checkoutId } },
            data: { ativo: false, fim: new Date() },
          });
        }

        planoSnapshot.statusPagamento = statusPagamento;
        planoSnapshot.ativo = ativo;
        planoSnapshot.inicio = ativo ? new Date() : null;
        planoSnapshot.mpPaymentId = mpPaymentId ?? null;
        planoSnapshot.observacao = ativo
          ? 'Pagamento aprovado com cartão via Mercado Pago'
          : 'Pagamento com cartão aguardando confirmação via Mercado Pago';

        await this.logEvent({
          usuarioId: params.usuarioId,
          empresasPlanoId: checkoutId,
          tipo: 'PAYMENT_CREATED',
          status: statusPagamento,
          externalRef: checkoutId,
          mpResourceId: mpPaymentId ?? null,
          payload: body,
        });

        return {
          checkoutId,
          plano: planoSnapshot,
          pagamento: {
            tipo: 'card',
            status: body?.status ?? null,
            paymentId: mpPaymentId ?? null,
            installments,
          },
        };
      }

      const payment = (await paymentApi.create({
        body: {
          transaction_amount: valor,
          description: titulo,
          payment_method_id: 'bolbradesco',
          external_reference: checkoutId,
          payer: {
            ...payerBase,
            identification: documento && documento.number ? documento : undefined,
          },
        },
      })) as MercadoPagoResponse;
      const body = payment.body ?? payment;
      const mpPaymentId = body?.id ? String(body.id) : undefined;
      const statusPagamento = mapToStatusPagamento(body?.status);
      const ativo = statusPagamento === STATUS_PAGAMENTO.APROVADO;
      const expiration = body?.date_of_expiration ? new Date(body.date_of_expiration) : null;
      const graceUntil = (() => {
        const grace = new Date();
        grace.setDate(grace.getDate() + (mercadopagoConfig.settings.boletoGraceDays || 5));
        return grace;
      })();

      await createOrUpdateCheckoutEmpresasPlano({
        checkoutId,
        usuarioId: params.usuarioId,
        planosEmpresariaisId: params.planosEmpresariaisId,
        metodoPagamento,
        modeloPagamento,
        statusPagamento,
        ativo,
        mpPaymentId: mpPaymentId ?? null,
        proximaCobranca: expiration,
        graceUntil,
        observacao: 'Boleto aguardando compensação via Mercado Pago',
      });

      planoSnapshot.statusPagamento = statusPagamento;
      planoSnapshot.ativo = ativo;
      planoSnapshot.mpPaymentId = mpPaymentId ?? null;
      planoSnapshot.proximaCobranca = expiration;
      planoSnapshot.graceUntil = graceUntil;
      planoSnapshot.observacao = 'Boleto aguardando compensação via Mercado Pago';

      await this.logEvent({
        usuarioId: params.usuarioId,
        empresasPlanoId: checkoutId,
        tipo: 'PAYMENT_CREATED',
        status: statusPagamento,
        externalRef: checkoutId,
        mpResourceId: mpPaymentId ?? null,
        payload: body,
      });

      const barcode = body?.barcode?.content || body?.barcode || body?.transaction_details?.external_resource_url || null;
      const boletoUrl = body?.transaction_details?.external_resource_url || body?.point_of_interaction?.transaction_data?.ticket_url || null;

      return {
        checkoutId,
        plano: planoSnapshot,
        pagamento: {
          tipo: 'boleto',
          status: body?.status ?? null,
          paymentId: mpPaymentId ?? null,
          barcode,
          boletoUrl,
          expiresAt: body?.date_of_expiration || null,
        },
      };
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
  },

  async updatePaymentStatusFromNotification(params: {
    externalRef: string;
    status?: string | null;
    mpPaymentId?: string | null;
    data?: any;
  }) {
    const { externalRef, status, mpPaymentId, data } = params;
    if (!externalRef) return;

    let plano = await prisma.empresasPlano.findUnique({ where: { id: externalRef } });
    if (!plano) {
      plano = await this.ensureEmpresasPlanoFromCheckout(externalRef);
    }
    if (!plano) return;

    const normalized = typeof status === 'string' ? status.toLowerCase() : '';
    const statusPagamento = mapToStatusPagamento(normalized);
    const mpPaymentIdResolved = mpPaymentId ?? plano.mpPaymentId ?? null;

    const updateData: any = {
      statusPagamento,
      mpPaymentId: mpPaymentIdResolved,
    };

    if (data?.preapproval_id || data?.id) {
      const subscriptionId = String(data?.preapproval_id ?? data?.id ?? '');
      if (subscriptionId) {
        updateData.mpPreapprovalId = subscriptionId;
        updateData.mpSubscriptionId = subscriptionId;
      }
    }

    if (PAYMENT_APPROVED_STATUSES.has(normalized)) {
      updateData.ativo = true;
      updateData.inicio = plano.inicio ?? new Date();
      updateData.proximaCobranca = addMonths(new Date(), 1);
      updateData.graceUntil = null;
      await prisma.empresasPlano.updateMany({
        where: { usuarioId: plano.usuarioId, ativo: true, NOT: { id: plano.id } },
        data: { ativo: false, fim: new Date() },
      });
    } else if (PAYMENT_PENDING_STATUSES.has(normalized)) {
      updateData.statusPagamento = STATUS_PAGAMENTO.EM_PROCESSAMENTO;
    } else if (PAYMENT_REJECTED_STATUSES.has(normalized)) {
      const grace = new Date();
      grace.setDate(grace.getDate() + (mercadopagoConfig.settings.graceDays || 5));
      updateData.graceUntil = grace;
      updateData.ativo = false;
    } else if (PAYMENT_CANCELLED_STATUSES.has(normalized)) {
      updateData.statusPagamento = STATUS_PAGAMENTO.CANCELADO;
      updateData.ativo = false;
      updateData.fim = new Date();
      updateData.graceUntil = null;
    }

    await prisma.empresasPlano.update({ where: { id: plano.id }, data: updateData });

    const finalStatus: STATUS_PAGAMENTO = updateData.statusPagamento ?? statusPagamento;
    const statusChanged = plano.statusPagamento !== finalStatus;

    await this.logEvent({
      usuarioId: plano.usuarioId,
      empresasPlanoId: plano.id,
      tipo: 'PAYMENT_STATUS_UPDATE',
      status: statusPagamento,
      externalRef,
      mpResourceId: mpPaymentIdResolved,
      payload: data,
    });

    if (!mercadopagoConfig.settings.emailsEnabled || !statusChanged) {
      return;
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: plano.usuarioId },
      select: { id: true, email: true, nomeCompleto: true, tipoUsuario: true },
    });
    if (!usuario?.email) {
      return;
    }

    const emailService = new EmailService();

    if (PAYMENT_APPROVED_STATUSES.has(normalized)) {
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '✅ Assinatura ativada',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Sua assinatura foi ativada com sucesso.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Sua assinatura foi ativada com sucesso.`,
        },
      );
      return;
    }

    if (PAYMENT_PENDING_STATUSES.has(normalized)) {
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '🕒 Pagamento em processamento',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Recebemos sua solicitação de pagamento. Assim que houver confirmação, avisaremos por aqui.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Recebemos sua solicitação de pagamento. Avisaremos assim que for confirmado.`,
        },
      );
      return;
    }

    if (PAYMENT_REJECTED_STATUSES.has(normalized)) {
      const url = mercadopagoConfig.settings.billingPortalUrl || mercadopagoConfig.returnUrls.failure;
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '⚠️ Problema na cobrança da sua assinatura',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Não foi possível cobrar seu método de pagamento. Seu acesso será mantido por enquanto. Por favor, atualize seus dados de pagamento: <a href="${url}">${url}</a>.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Não foi possível cobrar seu método de pagamento. Atualize seus dados: ${url}.`,
        },
      );
      return;
    }

    if (PAYMENT_CANCELLED_STATUSES.has(normalized)) {
      await emailService.sendAssinaturaNotificacao(
        { id: usuario.id, email: usuario.email, nomeCompleto: usuario.nomeCompleto },
        {
          subject: '❌ Assinatura cancelada',
          html: `<p>Olá, ${usuario.nomeCompleto}!</p><p>Seu pagamento não foi confirmado no prazo e a assinatura foi cancelada. Caso deseje reativar, realize uma nova contratação.</p>`,
          text: `Olá, ${usuario.nomeCompleto}! Seu pagamento não foi confirmado no prazo e a assinatura foi cancelada. Para reativar, contrate novamente.`,
        },
      );
    }
  },

  async handleWebhook(event: { type?: string; action?: string; data?: any }) {
    // Estrutura genérica; ajuste para payload real do MP
    const { type, action, data } = event;

    // Exemplos: pagamentos aprovados
    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated')) {
      const mpPaymentId = String(data?.id ?? data?.payment?.id ?? '');
      if (!mpPaymentId) return;

      // Buscamos plano por payment ID ou via referência (custom data)
      // Supondo que enviamos "external_reference" como id do EmpresasPlano
      const externalRef = String(data?.external_reference ?? '');
      if (!externalRef) return;
      await this.updatePaymentStatusFromNotification({ externalRef, status: data?.status, mpPaymentId, data });
    }

    if (type === 'subscription' || type === 'preapproval') {
      const body = (data as any) || {};
      const externalRef = String(body?.external_reference ?? body?.externalReference ?? '');
      if (!externalRef) return;

      await this.updatePaymentStatusFromNotification({ externalRef, status: body?.status, data: body });
    }
  },

  async cancel(usuarioId: string, motivo?: string) {
    // Desativa plano atual e aplica regra de RASCUNHO nas vagas
    const planoAtivo = await prisma.empresasPlano.findFirst({ where: { usuarioId, ativo: true } });
    if (!planoAtivo) return { cancelled: false };

    await prisma.empresasPlano.update({
      where: { id: planoAtivo.id },
      data: {
        ativo: false,
        fim: new Date(),
        statusPagamento: STATUS_PAGAMENTO.CANCELADO,
        observacao: motivo ?? 'Cancelado pelo cliente',
      },
    });
    await this.logEvent({ usuarioId, empresasPlanoId: planoAtivo.id, tipo: 'CANCEL', status: 'CANCELADO', mensagem: motivo || null });

    await setVagasToDraft(usuarioId);
    return { cancelled: true };
  },

  async downgrade(usuarioId: string, novoPlanosEmpresariaisId: string) {
    // Cria nova vinculação com downgrade e coloca vagas em rascunho
    const result = await clientesService.assign({
      usuarioId,
      planosEmpresariaisId: novoPlanosEmpresariaisId,
      tipo: 'parceiro',
      observacao: 'Downgrade de plano via Mercado Pago',
    } as any);

    await setVagasToDraft(usuarioId);
    return result;
  },

  async upgrade(usuarioId: string, novoPlanosEmpresariaisId: string) {
    // Cria nova vinculação sem alterar status das vagas
    const result = await clientesService.assign({
      usuarioId,
      planosEmpresariaisId: novoPlanosEmpresariaisId,
      tipo: 'parceiro',
      observacao: 'Upgrade de plano via Mercado Pago',
    } as any);
    return result;
  },

  async remindPayment(usuarioId: string) {
    assertMercadoPagoConfigured();
    const plano = await prisma.empresasPlano.findFirst({
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

    const usuario = await prisma.usuarios.findUnique({ where: { id: usuarioId }, select: { email: true, nomeCompleto: true } });
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

    await this.logEvent({ usuarioId, empresasPlanoId: plano.id, tipo: 'REMINDER_SENT', status: 'ENVIADO', externalRef: plano.id, mpResourceId: (pref as any)?.id || null });

    return { initPoint: link };
  },

  async adminRemindPaymentForPlan(params: {
    usuarioId: string;
    planosEmpresariaisId: string;
    metodoPagamento?: METODO_PAGAMENTO;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
  }) {
    // Reutiliza fluxo do checkout para criar um vínculo pendente e preference
    const metodoPagamento = params.metodoPagamento || METODO_PAGAMENTO.PIX;
    let pagamento: CheckoutPagamento = 'pix';
    if (metodoPagamento === METODO_PAGAMENTO.BOLETO) {
      pagamento = 'boleto';
    } else if (metodoPagamento !== METODO_PAGAMENTO.PIX) {
      throw new Error('Remissão administrativa suporta apenas PIX ou Boleto');
    }

    return this.startCheckout({
      usuarioId: params.usuarioId,
      planosEmpresariaisId: params.planosEmpresariaisId,
      metodo: 'pagamento',
      pagamento,
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      pendingUrl: params.pendingUrl,
    });
  },

  async reconcile() {
    // Encerra planos vencidos além da tolerância e coloca vagas em rascunho
    const now = new Date();
    const overdue = await prisma.empresasPlano.findMany({
      where: {
        ativo: true,
        OR: [
          { graceUntil: { lt: now } },
          { proximaCobranca: { lt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    for (const plano of overdue) {
      await prisma.empresasPlano.update({
        where: { id: plano.id },
        data: { ativo: false, fim: now, statusPagamento: STATUS_PAGAMENTO.CANCELADO },
      });
      await setVagasToDraft(plano.usuarioId);
      await this.logEvent({ usuarioId: plano.usuarioId, empresasPlanoId: plano.id, tipo: 'RECONCILE_CANCEL', status: 'CANCELADO' });
      if (mercadopagoConfig.settings.emailsEnabled) {
        const usuario = await prisma.usuarios.findUnique({ where: { id: plano.usuarioId }, select: { email: true, nomeCompleto: true } });
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

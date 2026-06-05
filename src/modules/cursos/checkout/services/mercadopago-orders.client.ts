import { logger } from '@/utils/logger';
import type { MercadoPagoMode } from '@/modules/configuracoes-gerais/services/runtime-config.service';

type OrdersPaymentMethodType = 'bank_transfer' | 'ticket' | 'credit_card' | 'debit_card';

type OrdersPayer = {
  email?: string;
  first_name?: string;
  last_name?: string;
  identification?: { type: 'CPF' | 'CNPJ'; number: string };
  address?: {
    zip_code?: string;
    street_name?: string;
    street_number?: string | number;
    neighborhood?: string;
    city?: string;
    federal_unit?: string;
    state?: string;
  };
  phone?: { area_code?: string; number?: string };
};

type CreateOrderBaseInput = {
  accessToken: string;
  activeMode: MercadoPagoMode;
  tokenFingerprint: string | null;
  idempotencyKey: string;
  externalReference: string;
  description: string;
  amount: number;
  payer: OrdersPayer;
};

type CreatePixOrderInput = CreateOrderBaseInput & {
  payment: { kind: 'pix'; expirationTime?: string };
};

type CreateBoletoOrderInput = CreateOrderBaseInput & {
  payment: { kind: 'boleto'; expirationTime?: string };
};

type CreateCardOrderInput = CreateOrderBaseInput & {
  payment: {
    kind: 'card';
    token: string;
    paymentMethodId: string;
    paymentMethodType: 'credit_card' | 'debit_card';
    installments: number;
  };
};

export type CreateMercadoPagoOrderInput =
  | CreatePixOrderInput
  | CreateBoletoOrderInput
  | CreateCardOrderInput;

export type MercadoPagoOrdersPayment = {
  id: string | null;
  status: string | null;
  statusDetail: string | null;
  paymentMethod: Record<string, any>;
  raw: any;
};

export type MercadoPagoOrderResult = {
  orderId: string | null;
  status: string | null;
  statusDetail: string | null;
  payment: MercadoPagoOrdersPayment | null;
  raw: any;
};

const ORDERS_API_URL = 'https://api.mercadopago.com/v1/orders';

function formatAmount(value: number): string {
  return Number(value || 0).toFixed(2);
}

function redactMercadoPagoPayload(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactMercadoPagoPayload);

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes('token') ||
        lower.includes('authorization') ||
        lower.includes('secret') ||
        lower.includes('access')
      ) {
        return [key, '[REDACTED]'];
      }
      return [key, redactMercadoPagoPayload(entry)];
    }),
  );
}

function paymentMethodFor(input: CreateMercadoPagoOrderInput): {
  id: string;
  type: OrdersPaymentMethodType;
  token?: string;
  installments?: number;
} {
  if (input.payment.kind === 'pix') {
    return { id: 'pix', type: 'bank_transfer' };
  }

  if (input.payment.kind === 'boleto') {
    return { id: 'bolbradesco', type: 'ticket' };
  }

  return {
    id: input.payment.paymentMethodId,
    type: input.payment.paymentMethodType,
    token: input.payment.token,
    installments: input.payment.installments,
  };
}

function buildOrderBody(input: CreateMercadoPagoOrderInput): Record<string, any> {
  const payment: Record<string, any> = {
    amount: formatAmount(input.amount),
    payment_method: paymentMethodFor(input),
  };

  if (input.payment.kind === 'pix' && input.payment.expirationTime) {
    payment.expiration_time = input.payment.expirationTime;
  }

  if (input.payment.kind === 'boleto' && input.payment.expirationTime) {
    payment.expiration_time = input.payment.expirationTime;
  }

  const payerAddress = input.payer.address
    ? {
        zip_code: input.payer.address.zip_code,
        street_name: input.payer.address.street_name,
        street_number: input.payer.address.street_number,
        neighborhood: input.payer.address.neighborhood,
        city: input.payer.address.city,
        state: input.payer.address.state ?? input.payer.address.federal_unit,
      }
    : undefined;

  return {
    type: 'online',
    total_amount: formatAmount(input.amount),
    external_reference: input.externalReference,
    description: input.description,
    processing_mode: 'automatic',
    transactions: { payments: [payment] },
    payer: {
      email: input.payer.email,
      first_name: input.payer.first_name,
      last_name: input.payer.last_name,
      identification: input.payer.identification,
      address: payerAddress,
      phone: input.payer.phone,
    },
  };
}

export function normalizeMercadoPagoOrder(order: any): MercadoPagoOrderResult {
  const rawPayments = order?.transactions?.payments;
  const payment = Array.isArray(rawPayments) ? rawPayments[0] : null;
  const paymentMethod = payment?.payment_method ?? {};

  return {
    orderId: order?.id ? String(order.id) : null,
    status: order?.status ? String(order.status) : null,
    statusDetail: order?.status_detail ? String(order.status_detail) : null,
    payment: payment
      ? {
          id: payment?.id ? String(payment.id) : null,
          status: payment?.status ? String(payment.status) : null,
          statusDetail: payment?.status_detail ? String(payment.status_detail) : null,
          paymentMethod,
          raw: payment,
        }
      : null,
    raw: order,
  };
}

async function parseMercadoPagoResponse(response: Awaited<ReturnType<typeof fetch>>): Promise<any> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function createMercadoPagoOrder(
  input: CreateMercadoPagoOrderInput,
): Promise<MercadoPagoOrderResult> {
  const body = buildOrderBody(input);

  logger.info('[MERCADOPAGO_ORDERS] Criando order', {
    activeMode: input.activeMode,
    tokenFingerprint: input.tokenFingerprint,
    requestId: input.idempotencyKey,
    externalReference: input.externalReference,
    paymentKind: input.payment.kind,
    amount: body.total_amount,
  });

  const response = await fetch(ORDERS_API_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
      'X-Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  const payload = await parseMercadoPagoResponse(response);
  if (!response.ok) {
    logger.error('[MERCADOPAGO_ORDERS] Falha ao criar order', {
      activeMode: input.activeMode,
      tokenFingerprint: input.tokenFingerprint,
      requestId: input.idempotencyKey,
      status: response.status,
      apiResponse: redactMercadoPagoPayload(payload),
    });

    throw Object.assign(
      new Error(payload?.message || payload?.error || 'Falha ao criar order no Mercado Pago.'),
      {
        code: 'MERCADOPAGO_ORDERS_ERROR',
        statusCode: response.status >= 500 ? 502 : 503,
        status: response.status,
        apiResponse: payload,
      },
    );
  }

  const order = normalizeMercadoPagoOrder(payload);
  logger.info('[MERCADOPAGO_ORDERS] Order criada', {
    activeMode: input.activeMode,
    tokenFingerprint: input.tokenFingerprint,
    requestId: input.idempotencyKey,
    orderId: order.orderId,
    paymentId: order.payment?.id,
    status: order.status,
    paymentStatus: order.payment?.status,
  });

  return order;
}

export async function getMercadoPagoOrder(params: {
  accessToken: string;
  activeMode: MercadoPagoMode;
  tokenFingerprint: string | null;
  orderId: string;
}): Promise<MercadoPagoOrderResult> {
  const response = await fetch(`${ORDERS_API_URL}/${encodeURIComponent(params.orderId)}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  const payload = await parseMercadoPagoResponse(response);
  if (!response.ok) {
    logger.error('[MERCADOPAGO_ORDERS] Falha ao consultar order', {
      activeMode: params.activeMode,
      tokenFingerprint: params.tokenFingerprint,
      orderId: params.orderId,
      status: response.status,
      apiResponse: redactMercadoPagoPayload(payload),
    });

    throw Object.assign(
      new Error(payload?.message || payload?.error || 'Falha ao consultar order no Mercado Pago.'),
      {
        code: 'MERCADOPAGO_ORDERS_ERROR',
        statusCode: response.status >= 500 ? 502 : 503,
        status: response.status,
        apiResponse: payload,
      },
    );
  }

  return normalizeMercadoPagoOrder(payload);
}

export async function cancelMercadoPagoOrder(params: {
  accessToken: string;
  activeMode: MercadoPagoMode;
  tokenFingerprint: string | null;
  orderId: string;
  idempotencyKey: string;
}): Promise<MercadoPagoOrderResult> {
  const response = await fetch(`${ORDERS_API_URL}/${encodeURIComponent(params.orderId)}/cancel`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
      'X-Idempotency-Key': params.idempotencyKey,
    },
  });

  const payload = await parseMercadoPagoResponse(response);
  if (!response.ok) {
    logger.error('[MERCADOPAGO_ORDERS] Falha ao cancelar order', {
      activeMode: params.activeMode,
      tokenFingerprint: params.tokenFingerprint,
      orderId: params.orderId,
      requestId: params.idempotencyKey,
      status: response.status,
      apiResponse: redactMercadoPagoPayload(payload),
    });

    throw Object.assign(
      new Error(payload?.message || payload?.error || 'Falha ao cancelar order no Mercado Pago.'),
      {
        code: 'MERCADOPAGO_ORDERS_CANCEL_ERROR',
        statusCode: response.status >= 500 ? 502 : 409,
        status: response.status,
        apiResponse: payload,
      },
    );
  }

  const order = normalizeMercadoPagoOrder(payload);
  logger.info('[MERCADOPAGO_ORDERS] Order cancelada', {
    activeMode: params.activeMode,
    tokenFingerprint: params.tokenFingerprint,
    orderId: params.orderId,
    requestId: params.idempotencyKey,
    status: order.status,
    paymentStatus: order.payment?.status,
  });

  return order;
}

/**
 * Tipos e interfaces para Orders do MercadoPago
 * Baseado na API de Orders v2
 */

import {
  ProcessingMode,
  OrderStatus,
  PaymentStatus,
  PaymentMethodType,
  CurrencyId,
  IdentificationType,
  FrequencyType,
  SubscriptionStatus,
} from "../enums";

/**
 * Interface para dados do pagador
 */
export interface Payer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: {
    area_code: string;
    number: string;
  };
  identification?: {
    type: IdentificationType;
    number: string;
  };
  address?: {
    zip_code: string;
    street_name: string;
    street_number: string;
    neighborhood: string;
    city: string;
    federal_unit: string;
  };
}

/**
 * Interface para dados do cartão
 */
export interface CardData {
  token: string;
  security_code?: string;
  cardholder?: {
    name: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}

/**
 * Interface para item da order
 */
export interface OrderItem {
  id: string;
  title: string;
  description?: string;
  picture_url?: string;
  category_id?: string;
  quantity: number;
  unit_price: number;
  currency_id: CurrencyId;
}

/**
 * Interface para dados de pagamento
 */
export interface PaymentData {
  payment_method_id: string;
  payment_type_id: PaymentMethodType;
  token?: string;
  installments?: number;
  issuer_id?: string;
  card?: CardData;
  payer: Payer;
  external_reference?: string;
  description?: string;
  metadata?: Record<string, any>;
  additional_info?: {
    items?: OrderItem[];
    payer?: {
      first_name?: string;
      last_name?: string;
      phone?: {
        area_code: string;
        number: string;
      };
      address?: {
        zip_code: string;
        street_name: string;
        street_number: string;
      };
    };
  };
}

/**
 * Interface para criar uma order
 */
export interface CreateOrderRequest {
  type: "online" | "offline";
  processing_mode: ProcessingMode;
  external_reference?: string;
  notification_url?: string;
  total_amount: number;
  items: OrderItem[];
  payments: PaymentData[];
  marketplace?: string;
  marketplace_fee?: number;
  coupon_amount?: number;
  campaign_id?: string;
  differential_pricing_id?: string;
  application_id?: string;
  capture?: boolean;
  binary_mode?: boolean;
}

/**
 * Interface para transação dentro de uma order
 */
export interface Transaction {
  id: string;
  type: string;
  payment_method: {
    id: string;
    type: PaymentMethodType;
  };
  status: PaymentStatus;
  status_detail: string;
  transaction_amount: number;
  installments: number;
  payment_type_id: PaymentMethodType;
  currency_id: CurrencyId;
  date_created: string;
  date_approved?: string;
  date_last_updated: string;
  payer: Payer;
  external_reference?: string;
  description?: string;
  metadata?: Record<string, any>;
  fee_details?: Array<{
    type: string;
    amount: number;
    fee_payer: string;
  }>;
}

/**
 * Interface para resposta de order criada
 */
export interface OrderResponse {
  id: string;
  type: "online" | "offline";
  processing_mode: ProcessingMode;
  status: OrderStatus;
  external_reference?: string;
  preference_id?: string;
  payments?: Transaction[];
  shipments?: any[];
  items: OrderItem[];
  payer?: Payer;
  total_amount: number;
  paid_amount: number;
  refunded_amount: number;
  shipping_amount: number;
  cancelled_amount: number;
  date_created: string;
  date_closed?: string;
  date_last_updated: string;
  marketplace?: string;
  marketplace_fee?: number;
  coupon_amount?: number;
  application_id?: string;
  is_test: boolean;
}

/**
 * Interface para reembolso
 */
export interface RefundRequest {
  amount?: number;
  reason?: string;
  external_reference?: string;
  metadata?: Record<string, any>;
  transaction_id?: string;
}

/**
 * Interface para resposta de reembolso
 */
export interface RefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  metadata?: Record<string, any>;
  source: {
    id: string;
    name: string;
    type: string;
  };
  date_created: string;
  unique_sequence_number?: string;
  refund_mode: string;
  adjustment_amount: number;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  external_reference?: string;
}

/**
 * Interface para erro do MercadoPago
 */
export interface MercadoPagoError {
  message: string;
  error: string;
  status: number;
  cause: Array<{
    code: string;
    description: string;
    data?: string;
  }>;
}

/**
 * Interface para resposta padronizada do serviço
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: any;
    code?: string;
  };
}

/**
 * Interface para webhook/notificação
 */
export interface WebhookNotification {
  id: string;
  live_mode: boolean;
  type:
    | "payment"
    | "plan"
    | "subscription"
    | "invoice"
    | "point_integration_wh";
  date_created: string;
  application_id: string;
  user_id: string;
  version: string;
  api_version: string;
  action: "payment.created" | "payment.updated" | "order.updated" | string;
  data: {
    id: string;
  };
}

/**
 * Interface para configurações de ambiente
 */
export interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  environment: "sandbox" | "production";
  locale: "pt-BR" | "es-AR" | "en-US";
  integrator_id?: string;
  platform_id?: string;
  corporation_id?: string;
  timeout?: number;
}

/**
 * Interface para dados de assinatura/subscription
 */
export interface SubscriptionData {
  preapproval_plan_id?: string;
  reason: string;
  external_reference?: string;
  payer_email: string;
  card_token_id?: string;
  /** Token do cartão secundário */
  card_token_id_secondary?: string;
  /** ID do meio de pagamento secundário */
  payment_method_id_secondary?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: FrequencyType;
    transaction_amount: number;
    currency_id: CurrencyId;
    repetitions?: number;
    debit_date?: string;
    /** Dia fixo para cobrança mensal (1-28) */
    billing_day?: number;
    /** Define se o valor é proporcional ao primeiro mês */
    billing_day_proportional?: boolean;
    start_date?: string;
    end_date?: string;
    free_trial?: {
      frequency: number;
      frequency_type: FrequencyType;
    };
  };
  back_url?: string;
  status?: SubscriptionStatus;
}

/**
 * Interface para resposta de assinatura
 */
export interface SubscriptionResponse {
  id: string;
  payer_id: string;
  payer_email: string;
  back_url?: string;
  collector_id: string;
  application_id: string;
  status: SubscriptionStatus;
  reason: string;
  external_reference?: string;
  date_created: string;
  last_modified: string;
  init_point?: string;
  preapproval_plan_id?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: FrequencyType;
    transaction_amount: number;
    currency_id: CurrencyId;
    repetitions?: number;
    debit_date?: string;
    free_trial?: {
      frequency: number;
      frequency_type: FrequencyType;
    };
  };
  summarized: {
    quotas?: number;
    charged_quantity?: number;
    pending_charge_quantity?: number;
    charged_amount?: number;
    pending_charge_amount?: number;
    semaphore?: string;
    last_charged_date?: string;
    last_charged_amount?: number;
  };
  next_payment_date?: string;
  payment_method_id?: string;
  payment_method_id_secondary?: string;
  first_invoice_offset?: number;
}
